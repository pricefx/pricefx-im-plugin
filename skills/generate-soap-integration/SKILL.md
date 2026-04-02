---
name: generate-soap-integration
description: Generate a Pricefx Integration Manager integration that calls an external SOAP/XML web service. Use this skill when the target system requires a SOAP envelope and returns an XML response — e.g., pushing approved contracts or price lists to an ERP, or sending batch updates to a legacy system via WSDL-defined operations. Covers three-layer separation (business route, FreeMarker template, shared SOAP call route), request/response archiving, application-level fault detection, and auth options.
---

# Generate SOAP Integration

You are generating a SOAP outbound integration for a Pricefx Integration Manager project. Follow the steps below. Never hardcode credentials or customer-specific data.

This skill uses a three-layer pattern:
1. **Business route** — fetches data, prepares the model, splits into batches, delegates to the shared SOAP call route
2. **FreeMarker template** — renders the SOAP XML envelope from the model
3. **Shared SOAP call route** (`soap_call.xml`) — handles the HTTP POST, archives request/response files, detects application-level faults

## Step 1: Gather Information

Ask the user for the following (or read from `$ARGUMENTS` if already provided):

1. **Integration name** — descriptive kebab-case name (e.g., `export-contracts-to-erp`). Used as file names and route IDs.
2. **SOAP endpoint URL** — full URL of the target WSDL/web service (e.g., `https://erp.example.com/services/ContractService`). Will be stored in a property.
3. **SOAP operation name** — the XML element name of the operation (e.g., `SubmitContracts`, `UpdatePriceList`). Used in the FreeMarker template.
4. **SOAPAction header** — the `SOAPAction` HTTP header value (from the WSDL `<soap:operation soapAction="..."/>`). Empty if not required by the service.
5. **XML namespace** — the target namespace for the service elements (e.g., `http://www.example.com/myservice`).
6. **Auth type**:
   - `none` — no auth (default if the URL is intranet/trusted network)
   - `basic` — HTTP Basic (credentials in URL or via Camel URI options)
   - `mutual-tls` — client certificate (requires keystore configuration)
7. **Trigger** — how the business route is activated:
   - `event:` a Pricefx event (provide event name, e.g., `ITEM_APPROVED_PL`)
   - `direct:` called from another route
   - `scheduled:` Quartz cron (provide cron expression and timezone)
8. **Data source** — what data to fetch and send:
   - Pricefx fetch (objectType, filter ID)
   - Data already in the trigger event payload
   - External REST API call
9. **Batch size** — how many records to include per SOAP request. Default: `500`.
10. **Fault detection keywords** — strings that indicate a SOAP application-level fault in the response body. Default: `FAULTCODE,ERRORTEXT`. Adjust per the actual service's fault vocabulary.

## Step 2: Design the Route Structure

Plan the following files to create:

- `src/main/resources/repo/routes/{integration-name}.xml` — the business route
- `src/main/resources/repo/resources/{IntegrationName}_SOAP_{Operation}.ftl` — the FreeMarker SOAP envelope template (deployed to `${integration.data}/repository/resources/` at startup)
- `src/main/resources/repo/routes/soap-call-shared.xml` — the shared SOAP call route (only if not already present)
- Properties in `application.properties`

Check whether `soap-call-shared.xml` already exists in `src/main/resources/repo/routes/`. If it does, skip regenerating it and reference the existing `direct:soap_call` endpoint.

## Step 3: Generate the Business Route

File: `src/main/resources/repo/routes/{integration-name}.xml`

### Event-triggered business route template

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="{integration-name}">
    <from uri="direct:{integration-name}"/>

    <!-- Capture trigger payload -->
    <setProperty name="DATA_event"><groovy>body</groovy></setProperty>
    <setProperty name="DATA_event_uniqueName">
      <groovy>exchange.properties.DATA_event?.data[0]?.uniqueName</groovy>
    </setProperty>

    <!-- Timestamp for logging and archive file naming -->
    <setProperty name="DATA_JOB_NAME"><groovy>'{INTEGRATION_LABEL}'</groovy></setProperty>
    <setProperty name="DATA_executionDate">
      <groovy>java.time.format.DateTimeFormatter.ofPattern('yyyyMMddHHmmssSSSSSS')
              .withZone(java.time.ZoneId.of('UTC'))
              .format(java.time.Instant.now())</groovy>
    </setProperty>
    <log loggingLevel="INFO"
         message="[${exchangeProperty.DATA_JOB_NAME}][${exchangeProperty.DATA_executionDate}][STARTED]"/>

    <!-- Fetch source data from Pricefx (adapt objectType and filter) -->
    <toD uri="pfx-api:fetch?objectType={OBJECT_TYPE}&amp;filter={filter-id}&amp;sortBy={sortField}"/>
    <setProperty name="DATA_source"><groovy>body</groovy></setProperty>

    <!-- Prepare the FreeMarker model (inline Groovy or a registered Spring bean) -->
    <setProperty name="DATA_ftl_model">
      <groovy>
        [
          referenceId: exchange.properties.DATA_event_uniqueName,
          timestamp:   exchange.properties.DATA_executionDate,
          items:       exchange.properties.DATA_source
        ]
      </groovy>
    </setProperty>

    <!-- Split into batches of {BATCH_SIZE} before rendering the SOAP envelope -->
    <setProperty name="DATA_batches">
      <groovy>exchange.properties.DATA_ftl_model?.items?.collate({{soap.{integration-name}.batchSize}})</groovy>
    </setProperty>

    <split streaming="true" stopOnException="false">
      <groovy>exchange.properties.DATA_batches</groovy>
      <log loggingLevel="INFO"
           message="[${exchangeProperty.DATA_JOB_NAME}][BATCH][${headers.CamelSplitIndex}] size=${body.size()}"/>

      <!-- Render SOAP envelope from FreeMarker template -->
      <setHeader name="CamelFreemarkerDataModel">
        <groovy>exchange.properties.DATA_ftl_model + [items: body]</groovy>
      </setHeader>
      <setBody>
        <groovy>exchange.properties.DATA_ftl_model + [items: body]</groovy>
      </setBody>
      <to uri="freemarker:file://{{integration.data}}/repository/resources/{IntegrationName}_SOAP_{Operation}.ftl"/>

      <!-- Set routing headers for the shared SOAP call route -->
      <setHeader name="sourceId">
        <groovy>'' + exchange.properties.DATA_event_uniqueName + '__{Operation}__batch' + headers.CamelSplitIndex</groovy>
      </setHeader>
      <setHeader name="serviceURL"><simple>{{soap.{integration-name}.wsUrl}}</simple></setHeader>
      <setHeader name="CamelHttpMethod"><constant>POST</constant></setHeader>
      <setHeader name="Content-Type"><constant>application/xml</constant></setHeader>
      <!-- SOAPAction header (include only if required by the service) -->
      <!-- <setHeader name="SOAPAction"><constant>{{soap.{integration-name}.soapAction}}</constant></setHeader> -->

      <to uri="direct:soap_call"/>

      <!-- Reset body between split iterations to avoid stale XML bleed -->
      <setBody><constant/></setBody>
    </split>

    <onCompletion onCompleteOnly="true">
      <log loggingLevel="INFO"
           message="[${exchangeProperty.DATA_JOB_NAME}][${exchangeProperty.DATA_executionDate}][ENDED]"/>
    </onCompletion>
  </route>
</routes>
```

## Step 4: Generate the FreeMarker SOAP Envelope Template

File: `src/main/resources/repo/resources/{IntegrationName}_SOAP_{Operation}.ftl`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:tns="{xml.namespace}">
  <soapenv:Header/>
  <soapenv:Body>
    <tns:{Operation}>
      <tns:header>
        <tns:referenceId>${referenceId}</tns:referenceId>
        <tns:timestamp>${timestamp}</tns:timestamp>
      </tns:header>
      <tns:items>
        <#list items as item>
        <tns:item>
          <tns:id>${item.id!""}</tns:id>
          <tns:name>${item.name!""}</tns:name>
          <tns:value>${item.value!""}</tns:value>
          <!-- Add fields matching the actual WSDL element definitions -->
        </tns:item>
        </#list>
      </tns:items>
    </tns:{Operation}>
  </soapenv:Body>
</soapenv:Envelope>
```

**FreeMarker rules:**
- Use `${field!""}` for all optional fields — prevents `null` rendering literally in XML
- Use `<#list collection as item>` for repeating elements
- The `CamelFreemarkerDataModel` header and the body are both set to the same Groovy map — the template can reference top-level map keys directly (e.g., `${referenceId}`, `${items}`)
- Adapt the namespace, operation name, and item fields to match the actual WSDL

## Step 5: Generate the Shared SOAP Call Route

File: `src/main/resources/repo/routes/soap-call-shared.xml`

Only generate this file if it does not already exist.

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="soap_call">
    <from uri="direct:soap_call"/>

    <!-- Save the rendered request body for archiving -->
    <setProperty name="requestBody"><groovy>body</groovy></setProperty>
    <setProperty name="DATA_Instant_now"><groovy>java.time.Instant.now()</groovy></setProperty>
    <setProperty name="DATA_ZoneId"><groovy>java.time.ZoneId.of('UTC')</groovy></setProperty>
    <setProperty name="DATA_executionDateTime">
      <groovy>java.time.format.DateTimeFormatter.ofPattern('yyyyMMdd_HHmmssSSS')
              .withZone(exchange.properties.DATA_ZoneId)
              .format(exchange.properties.DATA_Instant_now)</groovy>
    </setProperty>
    <setProperty name="DATA_folderDate">
      <groovy>java.time.format.DateTimeFormatter.ofPattern('yyyyMMdd')
              .withZone(exchange.properties.DATA_ZoneId)
              .format(exchange.properties.DATA_Instant_now)</groovy>
    </setProperty>

    <!-- Archive the outgoing request -->
    <setProperty name="DATA_RequestFileName">
      <groovy>headers.sourceId + '__' + exchange.properties.DATA_executionDateTime + '__REQUEST.xml'</groovy>
    </setProperty>
    <setHeader name="CamelFileNameOnly"><groovy>exchange.properties.DATA_RequestFileName</groovy></setHeader>
    <setProperty name="DATA_archiveFolder">
      <groovy>'{{data.directory}}/export/soap_calls/' + exchange.properties.DATA_folderDate</groovy>
    </setProperty>
    <to uri="direct:populateDataToFiles"/>

    <doTry>
      <!-- Execute the SOAP HTTP POST -->
      <setHeader name="Content-Type"><constant>text/xml;charset=UTF-8</constant></setHeader>
      <setHeader name="CamelHttpMethod"><constant>POST</constant></setHeader>
      <setBody><groovy>exchange.properties.requestBody</groovy></setBody>

      <log loggingLevel="INFO" message="[soap_call][REQUEST][SENDING] ${headers.serviceURL}"/>
      <toD uri="${header[serviceURL]}?bridgeEndpoint=true&amp;throwExceptionOnFailure=true&amp;socketTimeout=600000&amp;connectTimeout=600000&amp;connectionClose=true"/>
      <convertBodyTo charset="UTF-8" type="java.lang.String"/>

      <log loggingLevel="INFO"
           message="[soap_call][RESPONSE][HTTP ${headers.CamelHttpResponseCode}] ${headers.serviceURL}"/>
      <setProperty name="responseBody"><groovy>body</groovy></setProperty>

      <!-- Detect application-level SOAP faults (HTTP 200 with fault payload) -->
      <choice>
        <when>
          <groovy>exchange.properties.responseBody != null
              &amp;&amp; (exchange.properties.responseBody.toString().toUpperCase().contains('FAULTCODE')
                   || exchange.properties.responseBody.toString().toUpperCase().contains('ERRORTEXT'))</groovy>

          <log loggingLevel="ERROR"
               message="[soap_call][RESPONSE][APPLICATION_ERROR] HTTP ${headers.CamelHttpResponseCode} from ${headers.serviceURL}"/>
          <setProperty name="DATA_ResponseFileName">
            <groovy>headers.sourceId + '__' + exchange.properties.DATA_executionDateTime + '__RESPONSE_' + headers.CamelHttpResponseCode + '_ERROR_.xml'</groovy>
          </setProperty>
          <setHeader name="CamelFileNameOnly"><groovy>exchange.properties.DATA_ResponseFileName</groovy></setHeader>
          <to uri="direct:populateDataToFiles"/>
          <wireTap copy="true" uri="direct:populateBadStatus"/>
        </when>
        <otherwise>
          <log loggingLevel="INFO"
               message="[soap_call][RESPONSE][OK] HTTP ${headers.CamelHttpResponseCode} from ${headers.serviceURL}"/>
          <setProperty name="DATA_ResponseFileName">
            <groovy>headers.sourceId + '__' + exchange.properties.DATA_executionDateTime + '__RESPONSE_' + headers.CamelHttpResponseCode + '_.xml'</groovy>
          </setProperty>
          <setHeader name="CamelFileNameOnly"><groovy>exchange.properties.DATA_ResponseFileName</groovy></setHeader>
          <to uri="direct:populateDataToFiles"/>
          <wireTap uri="direct:populateGoodStatus"/>
        </otherwise>
      </choice>

      <doCatch>
        <exception>java.lang.Exception</exception>
        <log loggingLevel="ERROR"
             message="[soap_call][EXCEPTION] ${headers.serviceURL} --> ${exchangeProperty.CamelExceptionCaught}"/>
        <setProperty name="DATA_ResponseFileName">
          <groovy>headers.sourceId + '__' + exchange.properties.DATA_executionDateTime + '__RESPONSE_' + headers.CamelHttpResponseCode + '_EXCEPTION_.xml'</groovy>
        </setProperty>
        <setHeader name="CamelFileNameOnly"><groovy>exchange.properties.DATA_ResponseFileName</groovy></setHeader>
        <setBody><groovy>exchange.properties.CamelExceptionCaught.toString()</groovy></setBody>
        <to uri="direct:populateDataToFiles"/>
        <wireTap copy="true" uri="direct:populateBadStatusAndException"/>
        <throwException exceptionType="java.lang.IllegalArgumentException"
                        message="${exchangeProperty.CamelExceptionCaught}"/>
      </doCatch>
    </doTry>

    <!-- Release large properties to avoid memory leaks -->
    <removeProperty name="requestBody"/>
    <removeProperty name="responseBody"/>
  </route>
</routes>
```

## Step 6: Generate Properties

Add to `src/main/resources/repo/config/application.properties`:

```properties
# === SOAP Integration: {integration-name} ===

# SOAP endpoint URL
soap.{integration-name}.wsUrl=https://erp.example.com/services/{ServiceName}

# SOAPAction HTTP header (check WSDL soap:operation/@soapAction; leave empty if not required)
# soap.{integration-name}.soapAction=http://www.example.com/{Operation}

# Batch size: number of records per SOAP request
soap.{integration-name}.batchSize=500

# Archive base directory (must be writable inside the IM pod)
data.directory=/opt/im/data

# Auth: Basic (use environment variables for credentials — never commit plain text)
# soap.{integration-name}.username={{env:SOAP_USERNAME}}
# soap.{integration-name}.password={{env:SOAP_PASSWORD}}
```

For Basic auth via URI options:
```
&amp;authUsername={{soap.{integration-name}.username}}&amp;authPassword={{soap.{integration-name}.password}}&amp;authenticationPreemptive=true
```
Add these options to the `<toD>` in the shared SOAP call route.

## Step 7: Self-Check

After generating all files, verify automatically:

1. Every `{{placeholder}}` has a corresponding entry in `application.properties`.
2. Route file names match route `id` attributes exactly.
3. `&amp;` used for all `&` in XML URI attributes.
4. No credentials hardcoded in route XML or properties.
5. The FreeMarker template uses `${field!""}` for all optional fields.
6. `<setBody><constant/></setBody>` appears after `<to uri="direct:soap_call"/>` inside the `<split>` to reset body between iterations.
7. `throwExceptionOnFailure=true` is set on the SOAP HTTP call in the shared route.
8. The `SOAPAction` header is included if the user specified one.
9. Fault detection keywords in the shared route match the actual service's fault vocabulary.

Fix any issues silently and report corrections.

## Important Rules

- NEVER call the SOAP endpoint directly with `<toD>` in the business route — always delegate to `direct:soap_call` to guarantee archiving, fault detection, and consistent timeout behavior
- ALWAYS archive both the outgoing request and the response — critical for debugging and auditing
- ALWAYS reset the body after each split iteration with `<setBody><constant/></setBody>` — stale XML from a previous batch will corrupt the next batch's FreeMarker rendering
- Use `${field!""}` in FreeMarker for ALL optional fields — `null` renders as the literal string `null` in XML without the default operator
- `socketTimeout=600000` (10 minutes) is intentionally long for SOAP — some ERP services are slow; reduce it if the target SLA allows
- NEVER hardcode credentials in route XML or properties committed to source control — use `{ENC}...` encrypted values or `{{env:VAR_NAME}}` environment variable references
- The `SOAPAction` header is mandatory for many SOAP 1.1 services — always check the WSDL `<soap:operation soapAction="..."/>` before omitting it
- The shared `direct:soap_call` route is reused across all SOAP integrations in the project — do not duplicate it per business route
- `<split streaming="true">` is required for large datasets — without it the entire batch list is held in memory
- Route IDs must match file names without `.xml`: file `export-contracts-to-erp.xml` → `id="export-contracts-to-erp"`
- **FreeMarker templates** go to `src/main/resources/repo/resources/` (without `ftl/` subdirectory). IM's `ResourcesService` deploys them to `${integration.data}/repository/resources/` on the filesystem at startup. The route URI MUST use `file://` protocol: `freemarker:file://{{integration.data}}/repository/resources/{TemplateName}.ftl`. Do NOT use classpath resolution — templates are NOT on the classpath.

## References

- [SOAP Outbound Pattern](../../../integration-manager/docs/patterns/soap-outbound.md)
- [Chained Routes Pattern](../../../integration-manager/docs/patterns/chained-routes-direct.md)
- [REST Outbound Skill](../generate-rest-outbound-integration/SKILL.md) — for REST/JSON target APIs
