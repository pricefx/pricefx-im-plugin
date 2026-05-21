---
name: generate-inbound-rest-endpoint
description: Use when the user wants to expose an HTTP endpoint from Pricefx Integration Manager — says "create a REST API", "add a health check", "build a webhook receiver", "accept incoming POST/GET requests", "expose endpoint from IM", or "let an external system call into IM". For an OUTBOUND call to an external API use `generate-rest-outbound-integration` instead.
---

# Generate Inbound REST Endpoint

You are generating an inbound REST endpoint for a Pricefx Integration Manager project. This exposes an HTTP endpoint that external systems can call into IM over HTTP.

Common use cases:
- Health check / readiness probe (`GET /ping`)
- Real-time pricing endpoint called by an order-entry system
- Webhook receiver that accepts JSON/XML payloads and triggers a Pricefx data load or formula
- Data lookup endpoint that fetches from Pricefx and returns results

## Step 1: Gather Information

Ask the user for:

1. **Endpoint name** - kebab-case (e.g., `get-pricing`, `submit-order`). Used as route ID and file name.
2. **HTTP method** - `GET` or `POST`
3. **Path** - the URL path segment (e.g., `ping`, `pricing`, `api/v1/customers`). The full URL will be `https://{host}:{port}{context-path}/{path}`.
4. **What should the endpoint do?**
   - Return a static response (health check)
   - Execute a Pricefx formula (`pfx-api:execute`)
   - Fetch data from Pricefx (`pfx-api:fetch`)
   - Trigger an import or other route (`direct:{route-name}`)
5. **Response format** - JSON (default) or XML
6. **Validation** - any mandatory fields in POST body?

If the user already provided some of these, skip asking.

## Step 2: Check and Configure REST DSL Properties

REST DSL requires `integration.rest.enabled=true` in **every profile-specific** properties file. Putting it only in `repo/config/application.properties` does NOT work because Spring Boot profile properties take precedence and `RestAutoConfiguration` is `@ConditionalOnProperty`.

### Action: Find ALL environment property files and add REST config to each

1. Glob for all profile-specific property files:
   - `src/main/resources/application-local.properties` (local dev)
   - `src/main/resources/application-app_*.properties` (deployed environments)

2. For EACH file found, check if `integration.rest.enabled=true` already exists. If not, append this block:

```properties
###############################################################################
# REST DSL - inbound REST endpoints
###############################################################################
integration.rest.enabled=true
integration.rest.endpoints.secured=false
integration.rest.endpoints.path=/custom
```

3. You MUST update ALL files, not just one. Missing it in any environment means the endpoint won't work there.

Never use em dash or other non-ASCII characters in property comments.

The context path (`integration.rest.endpoints.path`) determines the URL prefix. With `/custom`, a route `rest:get:ping` listens at `https://{host}:8080/custom/ping`.

Do NOT use `camel.rest.component`, `camel.rest.binding-mode`, or `camel.rest.context-path` - IM manages these internally via `RestAutoConfiguration`.

## Step 3: Generate the Route

File: `src/main/resources/repo/routes/{endpoint-name}.xml`

### GET - Health Check (simplest form)

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{endpoint-name}">
        <from uri="rest:get:{path}"/>

        <log loggingLevel="INFO" message="[${routeId}] Health check called, breadcrumbId=${header[breadcrumbId]}"/>

        <removeHeaders pattern="*" excludePattern="breadcrumbId"/>
        <setHeader name="Exchange.CONTENT_TYPE">
            <constant>application/json</constant>
        </setHeader>
        <setBody>
            <constant>{"status":"ok"}</constant>
        </setBody>
    </route>
</routes>
```

### POST - With Validation and Error Handling

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{endpoint-name}">
        <from uri="rest:post:{path}"/>

        <log loggingLevel="INFO" message="[${routeId}] Received request, breadcrumbId=${header[breadcrumbId]}"/>

        <doTry>
            <!-- 1. Unmarshal JSON payload -->
            <unmarshal><json/></unmarshal>

            <!-- 2. Validate mandatory fields -->
            <setHeader name="mandatoryErrors">
                <groovy>
                    ['{field1}', '{field2}'].findAll {
                        org.apache.commons.lang3.StringUtils.isBlank(body.get(it)?.toString())
                    }
                </groovy>
            </setHeader>
            <choice>
                <when>
                    <simple>${header.mandatoryErrors.size()} > 0</simple>
                    <throwException exceptionType="java.lang.IllegalArgumentException"
                                    message="Missing mandatory fields: ${header.mandatoryErrors}"/>
                </when>
            </choice>

            <!-- 3. Business logic (adapt per use case) -->

            <!-- 4. Build success response -->
            <setBody>
                <groovy>
                    groovy.json.JsonOutput.toJson([
                        status: 'accepted',
                        timestamp: java.time.Instant.now().toString()
                    ])
                </groovy>
            </setBody>

            <removeHeaders pattern="*" excludePattern="breadcrumbId"/>
            <setHeader name="Exchange.CONTENT_TYPE">
                <constant>application/json</constant>
            </setHeader>

            <doCatch>
                <exception>java.lang.Exception</exception>
                <removeHeaders pattern="*" excludePattern="breadcrumbId"/>
                <setHeader name="Exchange.HTTP_RESPONSE_CODE">
                    <constant>400</constant>
                </setHeader>
                <setHeader name="Exchange.CONTENT_TYPE">
                    <constant>application/json</constant>
                </setHeader>
                <log loggingLevel="ERROR" message="[${routeId}] Error: ${exception.message}"/>
                <setBody>
                    <groovy>
                        def ex = exchange.getProperty(org.apache.camel.Exchange.EXCEPTION_CAUGHT, Exception.class)
                        groovy.json.JsonOutput.toJson([
                            status: 'error',
                            message: ex.message,
                            timestamp: java.time.Instant.now().toString()
                        ])
                    </groovy>
                </setBody>
            </doCatch>

            <doFinally>
                <log loggingLevel="INFO" message="[${routeId}] Done, breadcrumbId=${header[breadcrumbId]}"/>
            </doFinally>
        </doTry>
    </route>
</routes>
```

### Business Logic Variants

Replace the "Business logic" section based on what the endpoint does:

**Execute a Pricefx formula:**
```xml
<setBody>
    <groovy>[inputField1: request.body.field1, inputField2: request.body.field2]</groovy>
</setBody>
<toD uri="pfx-api:execute?formulaName={{pfx.formula.name}}"/>
<choice>
    <when>
        <groovy>request.body?.response?.data?.find { it.resultName == 'ResponseData' }?.result == null</groovy>
        <throwException exceptionType="java.lang.RuntimeException"
                        message="Formula returned no ResponseData"/>
    </when>
</choice>
<setBody>
    <groovy>request.body?.response?.data?.find { it.resultName == 'ResponseData' }?.result</groovy>
</setBody>
```

**Fetch data from Pricefx:**
```xml
<toD uri="pfx-api:fetch?objectType=P&amp;filter={filter-name}"/>
<choice>
    <when>
        <groovy>body == null || body.isEmpty()</groovy>
        <throwException exceptionType="java.lang.RuntimeException"
                        message="No records found"/>
    </when>
</choice>
```

**Trigger another route:**
```xml
<to uri="direct:{target-route-name}"/>
```

### XML Response (instead of JSON)

For XML responses, use a FreeMarker template in `src/main/resources/repo/resources/`:

```xml
<to uri="freemarker:file://{{integration.data}}/repository/resources/{endpoint-name}-response.ftl"/>
<setHeader name="Exchange.CONTENT_TYPE">
    <constant>application/xml</constant>
</setHeader>
```

## Step 4: Test the Endpoint

After generating, tell the user how to test:

```bash
# Health check (GET)
curl -k https://localhost:8080/custom/{path}

# POST with JSON body
curl -k -X POST https://localhost:8080/custom/{path} \
  -H "Content-Type: application/json" \
  -d '{"field1":"value1","field2":"value2"}'

# POST with missing field (expect 400)
curl -k -X POST https://localhost:8080/custom/{path} \
  -H "Content-Type: application/json" \
  -d '{"field1":"value1"}'
```

The `-k` flag is needed for local development because IM uses a self-signed certificate.

## Important Rules

- **Properties location:** `integration.rest.enabled=true` and other `integration.rest.*` properties MUST go in profile-specific files (`application-local.properties`, `application-app_dev.properties`), NOT in `repo/config/application.properties`. Spring Boot profiles override repo config, and `RestAutoConfiguration` is conditional on this property.
- **Always `removeHeaders`** before returning a response - both in success and error paths. Internal Camel headers leak into HTTP responses and can cause serialization errors.
- **Always wrap POST endpoints** in `<doTry>/<doCatch>` - unhandled exceptions expose Java stack traces to callers.
- **Validate mandatory fields** before any Pricefx API call - return a clear error listing missing field names.
- **Use `toD` not `to`** when the URI contains runtime expressions like `${headers.formulaName}` - `to` resolves the URI once at startup.
- **Route ID must match file name** without `.xml`.
- **ASCII only** in `.properties` file comments - no em dash, en dash, or other Unicode characters.
- **Default port** is 8080 with HTTPS (self-signed cert `im-local.p12`).
- **Default context path** is `/custom` (`integration.rest.endpoints.path`).
- Authentication is handled at infrastructure level (API gateway or `integration.rest.endpoints.secured=true` with roles), not inside the route.
- FreeMarker templates for responses go in `src/main/resources/repo/resources/` and are referenced as `freemarker:file://{{integration.data}}/repository/resources/{name}.ftl`.

## References

- [Inbound REST API Pattern](../../../integration-manager/docs/patterns/inbound-rest-api.md)
- [REST Outbound Skill](../generate-rest-outbound-integration/SKILL.md) - for calling external REST APIs from IM
