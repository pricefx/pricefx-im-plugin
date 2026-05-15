---
name: generate-rest-outbound-integration
description: Generate a Pricefx Integration Manager route that calls an external REST API (POST, PUT, PATCH) as the outbound leg of an integration. Use this skill whenever IM must push data to an external system via HTTP — e.g., after a Pricefx event, on a schedule, or as part of an export pipeline. Covers OAuth 2.0 client-credentials, API-key, and HTTP Basic auth, with error classification, dry-run toggle, throttling, and retry.
---

# Generate REST Outbound Integration

You are generating an outbound REST API integration for a Pricefx Integration Manager project. Follow the steps below precisely. Never hardcode credentials or customer-specific values.

## Step 1: Gather Information

Ask the user for the following (or read from `$ARGUMENTS` if already provided):

1. **Route name** — descriptive kebab-case name (e.g., `export-approvals-to-erp`). Used as the file name and route ID.
2. **Trigger** — how this route is activated:
   - `event:` a Pricefx event (provide event name, e.g., `ITEM_APPROVED_PL`)
   - `scheduled:` Quartz cron (provide cron expression and timezone)
   - `direct:` called from another route
   - `timer:` one-shot or polling timer
3. **Target API URL** — full base URL (e.g., `https://api.example.com/v1/endpoint`). Will be stored in a property, not hardcoded.
4. **HTTP method** — `POST`, `PUT`, or `PATCH`
5. **Request content type** — `application/json` (default), `text/xml`, or other
6. **Auth type**:
   - `oauth2` — client credentials grant, token fetched per call (needs token URL, client ID/secret, scope)
   - `oauth2-cached` — OAuth 2.0 with token caching via `simpleCache` bean and periodic refresh timer (preferred for high-volume callers, or when the token endpoint is slow/rate-limited)
   - `apikey` — API key header (needs header name, e.g., `X-Api-Key`)
   - `basic` — HTTP Basic (username/password via URI options)
   - `mtls` — mutual TLS / client certificate from JKS keystore (needs identity.jks, truststore.jks, keystore passwords)
   - `sap-jwt-csrf` — SAP-style: JWT bearer + CSRF token fetch + session cookies (needs OAuth token URL, subscription key, SAP API base URL)
   - `none` — no auth
7. **Request payload** — how the body is built:
   - Groovy transformation of the trigger payload
   - FreeMarker template
   - Pass through as-is
8. **Throttling needed?** — yes/no. If yes, how many requests per second?
9. **Retry on transient errors?** — yes/no. If yes, use exponential backoff (default: 3 retries, 5 s initial delay).
10. **Dry-run toggle needed?** — yes/no (default: yes — always safe to include).

If the user has already provided some of these in `$ARGUMENTS`, skip those questions.

## Step 2: Choose Simple or Complex Mode

Evaluate the complexity based on Step 1 answers:

| Criteria | Mode |
|----------|------|
| Auth = `none` or `apikey`, single route, no dry-run needed | **Simple** — everything in one route file |
| Auth = `oauth2`, `basic`, OR multiple outbound routes in project, OR dry-run/throttling needed | **Complex** — business route + shared outbound + optional auth sub-route (Steps 3b–5) |
| Auth = `oauth2-cached`, `mtls`, or `sap-jwt-csrf` | **Complex+** — use the dedicated pattern in Step 5b / 5c / 5d (cache bean + refresh timer, or SSL context bean, or JWT+CSRF flow) |

**Simple mode** generates a single self-contained route file with inline HTTP call and error handling.
**Complex mode** generates the shared `rest-outbound-shared.xml` + `rest-auth-shared.xml` pattern for reuse across multiple routes.
**Complex+ mode** combines the shared business-route skeleton (Step 3b) with the dedicated auth pattern (Step 5b/5c/5d) and the optional error-extraction + writeback hooks (Steps 5e–5f).

Check whether `rest-outbound-shared.xml` already exists in `src/main/resources/repo/routes/`. If it does, use Complex mode and reference the existing `direct:rest_outbound_call`.

## Step 3a: Generate Simple Inline Route

Use this when mode is **Simple**. Everything in one file: `src/main/resources/repo/routes/{route-name}.xml`

### Trigger options

**Event-driven trigger:**
```xml
<from uri="direct:{eventName}"/>
```

**Scheduled trigger:**
```xml
<from uri="quartz://{route-name}?cron={{ext.api.schedule.cron}}&amp;trigger.timeZone={{ext.api.schedule.timezone}}&amp;stateful=true"/>
```

**Timer (one-shot) trigger:**
```xml
<from uri="timer://{route-name}?repeatCount=1"/>
```

### Simple route template (no auth)

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}">
        <from uri="{trigger-uri}"/>

        <log loggingLevel="INFO" message="[{route-name}] Starting outbound call"/>

        <!-- Build request body if needed (omit for GET) -->
        <setBody>
            <groovy>/* transform to target API payload */</groovy>
        </setBody>
        <setHeader name="CamelHttpMethod"><constant>{GET|POST|PUT|PATCH}</constant></setHeader>
        <setHeader name="Content-Type"><constant>application/json</constant></setHeader>

        <doTry>
            <toD uri="{{ext.api.url}}?bridgeEndpoint=true&amp;throwExceptionOnFailure=true&amp;socketTimeout=60000&amp;connectTimeout=30000&amp;connectionClose=true"/>

            <convertBodyTo type="java.lang.String" charset="UTF-8"/>
            <log loggingLevel="INFO" message="[{route-name}] Response: ${body}"/>

            <doCatch>
                <exception>java.lang.Exception</exception>
                <log loggingLevel="ERROR"
                     message="[{route-name}] Failed: ${exception.message}"/>
            </doCatch>
        </doTry>
    </route>
</routes>
```

### Simple route template (API key auth)

Same as above, but add before the `<toD>`:
```xml
<setHeader name="{api-key-header-name}"><simple>{{ext.api.apiKey}}</simple></setHeader>
```

After generating the simple route, skip to **Step 6: Generate Properties**.

## Step 3b: Generate Complex Business Route

Use this when mode is **Complex**. File: `src/main/resources/repo/routes/{route-name}.xml`

### Full business route template

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="{route-name}">
    <from uri="{trigger-uri}"/>

    <log loggingLevel="INFO" message="[{route-name}] Starting outbound call"/>

    <!-- Build the request payload (adapt as needed) -->
    <setBody>
      <groovy>/* transform body/event to the target API payload */</groovy>
    </setBody>
    <marshal><json/></marshal>

    <!-- Set call headers for the shared outbound route -->
    <setHeader name="CamelHttpMethod"><constant>{POST|PUT|PATCH}</constant></setHeader>
    <setHeader name="Content-Type"><constant>{application/json|text/xml}</constant></setHeader>
    <setHeader name="serviceURL"><simple>{{ext.api.url}}</simple></setHeader>
    <setHeader name="call_is_DISABLED"><simple>{{ext.api.call_is_DISABLED}}</simple></setHeader>
    <setHeader name="correlationId">
      <groovy>java.util.UUID.randomUUID().toString()</groovy>
    </setHeader>

    <!-- Delegate to the shared REST outbound call route -->
    <to uri="direct:rest_outbound_call"/>

    <!-- Handle response -->
    <convertBodyTo type="java.lang.String" charset="UTF-8"/>
    <log loggingLevel="INFO" message="[{route-name}] Response: ${body}"/>
  </route>
</routes>
```

## Step 4: Generate the Shared Outbound Call Route

File: `src/main/resources/repo/routes/rest-outbound-shared.xml`

Only generate this file if it does not already exist.

```xml
<routes xmlns="http://camel.apache.org/schema/spring">

  <!-- Generic REST outbound call.
       Required headers set by caller:
         serviceURL          — fully-qualified endpoint URL
         CamelHttpMethod     — POST | PUT | PATCH
         Content-Type        — application/json | text/xml | etc.
         call_is_DISABLED    — 'true' to suppress actual HTTP call (dry-run)
       Optional headers:
         correlationId       — passed through for log correlation
  -->
  <route id="rest_outbound_call">
    <from uri="direct:rest_outbound_call"/>

    <onException useOriginalMessage="true">
      <exception>org.apache.camel.http.base.HttpOperationFailedException</exception>
      <onWhen><simple>${exception.statusCode} == 401</simple></onWhen>
      <redeliveryPolicy maximumRedeliveries="0"/>
      <handled><constant>true</constant></handled>
      <log loggingLevel="ERROR"
           message="[REST_OUTBOUND][401] correlationId=${headers.correlationId} url=${headers.serviceURL} body=${exception.responseBody}"/>
    </onException>

    <onException useOriginalMessage="true">
      <exception>javax.net.ssl.SSLHandshakeException</exception>
      <redeliveryPolicy maximumRedeliveries="0"/>
      <handled><constant>true</constant></handled>
      <log loggingLevel="ERROR"
           message="[REST_OUTBOUND][SSL_HANDSHAKE] correlationId=${headers.correlationId} url=${headers.serviceURL} ${exception.message}"/>
    </onException>

    <!-- Preserve the request body so we can restore it after auth sub-route -->
    <setProperty name="REST_requestBody"><simple>${body}</simple></setProperty>
    <setProperty name="REST_isDryRun">
      <groovy>org.apache.commons.lang3.StringUtils.equalsIgnoreCase(headers.call_is_DISABLED, 'true')</groovy>
    </setProperty>

    <doTry>

      <filter>
        <groovy>!exchange.properties.REST_isDryRun</groovy>

        <!-- Acquire auth token (OAuth 2.0) — remove this step for API-key or Basic auth -->
        <to uri="direct:rest_auth_get_token"/>

        <!-- Restore body after auth sub-route consumed it -->
        <setBody><groovy>exchange.properties.REST_requestBody</groovy></setBody>

        <log loggingLevel="INFO"
             message="[REST_OUTBOUND][SENDING] correlationId=${headers.correlationId} method=${headers.CamelHttpMethod} url=${headers.serviceURL}"/>

        <toD uri="${headers.serviceURL}?bridgeEndpoint=true&amp;throwExceptionOnFailure=true&amp;socketTimeout=60000&amp;connectTimeout=30000&amp;connectionClose=true"/>

        <log loggingLevel="INFO"
             message="[REST_OUTBOUND][RECEIVED] correlationId=${headers.correlationId} httpStatus=${headers.CamelHttpResponseCode}"/>
      </filter>

      <filter>
        <groovy>exchange.properties.REST_isDryRun</groovy>
        <log loggingLevel="WARN"
             message="[REST_OUTBOUND][DRY_RUN] Call suppressed. correlationId=${headers.correlationId} url=${headers.serviceURL}"/>
      </filter>

      <doCatch>
        <exception>org.apache.camel.http.base.HttpOperationFailedException</exception>
        <log loggingLevel="ERROR"
             message="[REST_OUTBOUND][HTTP_ERROR] correlationId=${headers.correlationId} url=${headers.serviceURL} httpStatus=${exchangeProperty.CamelExceptionCaught.statusCode} responseBody=${exchangeProperty.CamelExceptionCaught.responseBody}"/>
        <setProperty name="REST_callFailed"><constant>true</constant></setProperty>
        <setProperty name="REST_errorDetail">
          <groovy>exchangeProperty.CamelExceptionCaught.statusCode + ' ' + exchangeProperty.CamelExceptionCaught.responseBody</groovy>
        </setProperty>
        <rethrow/>
      </doCatch>

      <doCatch>
        <exception>javax.net.ssl.SSLException</exception>
        <log loggingLevel="ERROR"
             message="[REST_OUTBOUND][SSL_ERROR] correlationId=${headers.correlationId} url=${headers.serviceURL} ${exception.message}"/>
        <setProperty name="REST_callFailed"><constant>true</constant></setProperty>
        <rethrow/>
      </doCatch>

      <doCatch>
        <exception>java.security.cert.CertificateException</exception>
        <log loggingLevel="ERROR"
             message="[REST_OUTBOUND][CERT_ERROR] correlationId=${headers.correlationId} url=${headers.serviceURL} ${exception.message}"/>
        <setProperty name="REST_callFailed"><constant>true</constant></setProperty>
        <rethrow/>
      </doCatch>

      <doCatch>
        <exception>java.lang.Exception</exception>
        <log loggingLevel="ERROR"
             message="[REST_OUTBOUND][ERROR] correlationId=${headers.correlationId} url=${headers.serviceURL} ${exception.message}"/>
        <setProperty name="REST_callFailed"><constant>true</constant></setProperty>
        <rethrow/>
      </doCatch>

      <doFinally>
        <log loggingLevel="INFO"
             message="[REST_OUTBOUND][DONE] correlationId=${headers.correlationId} failed=${exchangeProperty.REST_callFailed}"/>
      </doFinally>

    </doTry>
  </route>

</routes>
```

## Step 5: Generate the Auth Sub-Route (OAuth 2.0 only)

File: `src/main/resources/repo/routes/rest-auth-shared.xml`

Only generate if auth type is `oauth2` and the file does not already exist.

```xml
<routes xmlns="http://camel.apache.org/schema/spring">

  <!-- Obtain a Bearer token via OAuth 2.0 client-credentials grant.
       On success: sets Authorization header on the exchange.
       On failure: clears Authorization header and logs an error. -->
  <route id="rest_auth_get_token">
    <from uri="direct:rest_auth_get_token"/>

    <setHeader name="Content-Type">
      <constant>application/x-www-form-urlencoded</constant>
    </setHeader>
    <setBody>
      <simple>grant_type={{ext.api.auth.grantType}}&amp;client_id={{ext.api.auth.clientId}}&amp;client_secret={{ext.api.auth.clientSecret}}&amp;scope={{ext.api.auth.scope}}</simple>
    </setBody>

    <toD uri="{{ext.api.auth.url}}?httpMethod=POST&amp;bridgeEndpoint=true&amp;throwExceptionOnFailure=false&amp;connectionClose=true&amp;connectTimeout=30000&amp;socketTimeout=30000"/>

    <convertBodyTo type="java.lang.String" charset="UTF-8"/>
    <setProperty name="AUTH_rawResponse"><simple>${body}</simple></setProperty>

    <choice>
      <when>
        <simple><![CDATA[${header.CamelHttpResponseCode} >= 200 && ${header.CamelHttpResponseCode} < 300]]></simple>
        <setBody>
          <groovy>new groovy.json.JsonSlurper().parseText(exchange.properties.AUTH_rawResponse)</groovy>
        </setBody>
        <setHeader name="Authorization">
          <groovy>'Bearer ' + (body?.access_token ?: '')</groovy>
        </setHeader>
        <log loggingLevel="INFO"
             message="[AUTH][OK] route=${routeId} tokenType=${body?.token_type} expiresIn=${body?.expires_in}"/>
      </when>
      <otherwise>
        <log loggingLevel="ERROR"
             message="[AUTH][FAILED][${header.CamelHttpResponseCode}] route=${routeId} url={{ext.api.auth.url}} body=${exchangeProperty.AUTH_rawResponse}"/>
        <removeHeader name="Authorization"/>
      </otherwise>
    </choice>
  </route>

</routes>
```

**For API-key auth** — omit the auth sub-route. In the business route, add instead:
```xml
<setHeader name="X-Api-Key"><simple>{{ext.api.apiKey}}</simple></setHeader>
```

**For HTTP Basic auth** — omit the auth sub-route. On the `<toD>` in `rest_outbound_call`, add:
```
&amp;authUsername={{ext.api.basicUsername}}&amp;authPassword={{ext.api.basicPassword}}&amp;authenticationPreemptive=true
```

## Step 5b: OAuth 2.0 with Token Caching (`oauth2-cached`)

Use this pattern when the same token is reused across many calls — avoids fetching a fresh token per HTTP call. Three pieces are needed:

### Cache bean — `src/main/resources/repo/beans/simpleCache.xml`

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
  <bean id="simpleCache" class="java.util.concurrent.ConcurrentHashMap"/>
</beans>
```

### Token-fetch route — `src/main/resources/repo/routes/get-jwt-token.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="get-jwt-token">
    <description>Fetches an OAuth 2.0 bearer token and stores it in simpleCache under key 'JWT'.</description>
    <from uri="direct:get-jwt-token"/>

    <log message="Refreshing JWT"/>
    <setHeader name="Content-Type"><constant>application/x-www-form-urlencoded</constant></setHeader>
    <setHeader name="Accept"><constant>application/json</constant></setHeader>
    <setHeader name="CamelHttpMethod"><constant>POST</constant></setHeader>
    <setBody>
      <simple>grant_type={{ext.api.auth.grantType}}&amp;client_id={{ext.api.auth.clientId}}&amp;client_secret={{ext.api.auth.clientSecret}}&amp;scope={{ext.api.auth.scope}}</simple>
    </setBody>
    <setHeader name="HttpUri"><simple>{{ext.api.auth.url}}</simple></setHeader>

    <toD uri="${header.HttpUri}?bridgeEndpoint=true&amp;throwExceptionOnFailure=false&amp;connectionClose=true&amp;connectTimeout=30000&amp;socketTimeout=30000"/>

    <log message="Auth response status ${header.CamelHttpResponseCode}"/>
    <choice>
      <when>
        <simple><![CDATA[${header.CamelHttpResponseCode} >= 200 && ${header.CamelHttpResponseCode} < 300]]></simple>
        <setHeader name="jwt"><jsonpath>$.access_token</jsonpath></setHeader>
        <toD uri="bean:simpleCache?method=put('JWT',${header.jwt})"/>
        <log loggingLevel="INFO" message="[AUTH][OK] JWT refreshed"/>
      </when>
      <otherwise>
        <log loggingLevel="ERROR" message="[AUTH][FAILED][${header.CamelHttpResponseCode}] body=${body}"/>
      </otherwise>
    </choice>
  </route>
</routes>
```

### Periodic refresh timer — `src/main/resources/repo/routes/refresh-api-tokens.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="refresh-api-tokens" autoStartup="{{ext.api.tokens.autoStartup:true}}">
    <description>Refresh OAuth tokens periodically to keep simpleCache warm.</description>
    <from uri="timer://refresh-api-tokens?delay=0&amp;period={{ext.api.tokens.refreshPeriodMs}}"/>
    <log message="Refreshing API tokens on interval"/>
    <to uri="direct:get-jwt-token"/>
  </route>
</routes>
```

### Reading the cached token in the business route

Replace the OAuth sub-route call (`<to uri="direct:rest_auth_get_token"/>` and body restore) with:

```xml
<setHeader name="Authorization">
  <simple>Bearer ${bean:simpleCache.getOrDefault('JWT','')}</simple>
</setHeader>
```

When the cached token expires mid-call, an HTTP 401 is returned by the API. Handle by triggering a refresh and retrying once:

```xml
<onException>
  <exception>org.apache.camel.http.base.HttpOperationFailedException</exception>
  <onWhen><simple>${exception.statusCode} == 401</simple></onWhen>
  <redeliveryPolicy maximumRedeliveries="1" redeliveryDelay="0"/>
  <handled><constant>false</constant></handled>
  <log loggingLevel="WARN" message="[AUTH][401] Refreshing token and retrying"/>
  <to uri="direct:get-jwt-token"/>
</onException>
```

## Step 5c: Mutual TLS / Client Certificate (`mtls`)

Use when the target API authenticates clients with an X.509 certificate (no bearer token). Three pieces are needed:

### SSL context bean — `src/main/resources/repo/beans/sslContext.xml`

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">

  <bean class="org.apache.camel.support.jsse.SSLContextParameters" id="sslContextParameters">
    <property name="keyManagers" ref="routeKeyManagers"/>
    <property name="trustManagers" ref="routeTrustManagers"/>
    <property name="serverParameters" ref="routeSSLContextServerParameters"/>
    <property name="certAlias" value="{{ext.api.mtls.certAlias}}"/>
  </bean>

  <keyStoreParameters id="routeKeystore"
                      password="#{environment['keystore.password']}"
                      resource="#{environment['keystore.filename']}"
                      type="JKS"
                      xmlns="http://camel.apache.org/schema/spring"/>

  <bean class="org.apache.camel.support.jsse.KeyManagersParameters" id="routeKeyManagers">
    <property name="keyStore" ref="routeKeystore"/>
    <property name="keyPassword" value="#{environment['keystore.password']}"/>
  </bean>

  <bean class="org.apache.camel.support.jsse.SSLContextServerParameters" id="routeSSLContextServerParameters">
    <property name="clientAuthentication" value="REQUIRE"/>
  </bean>

  <keyStoreParameters id="routeTruststore"
                      password="#{environment['truststore.password']}"
                      resource="#{environment['truststore.filename']}"
                      type="JKS"
                      xmlns="http://camel.apache.org/schema/spring"/>

  <bean class="org.apache.camel.support.jsse.TrustManagersParameters" id="routeTrustManagers">
    <property name="keyStore" ref="routeTruststore"/>
  </bean>
</beans>
```

### Hostname verifier bean (optional, for wildcard/mismatched certs) — `src/main/resources/repo/beans/noopHostnameVerifier.xml`

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
  <bean id="noopHostnameVerifier" class="org.apache.http.conn.ssl.NoopHostnameVerifier"/>
</beans>
```

### Keystore resources

Place the JKS files as base64-encoded JSON under `src/main/resources/repo/resources/`:

- `identity.jks.json` — client cert + private key
- `truststore.jks.json` — trusted server CAs

Each file looks like:
```json
{
  "name": "identity.jks",
  "filename": "identity.jks",
  "dataBase64": "<base64-encoded JKS bytes>"
}
```

The IM runtime decodes and writes them to the file system at startup; `keystore.filename` / `truststore.filename` env vars point to the resolved paths.

### Calling the API with mTLS

In the business route's `<toD>` (or in `rest_outbound_call`), add the SSL parameters:

```xml
<toD uri="${header.HttpUri}?bridgeEndpoint=true&amp;sslContextParameters=#sslContextParameters&amp;x509HostnameVerifier=#noopHostnameVerifier&amp;throwExceptionOnFailure=true&amp;socketTimeout=60000&amp;connectTimeout=30000&amp;connectionClose=true"/>
```

No auth sub-route is needed — the TLS handshake provides identity.

## Step 5d: SAP-style JWT + CSRF + Cookies (`sap-jwt-csrf`)

SAP OData/Gateway APIs require: (1) an OAuth bearer token, (2) a CSRF token fetched via a GET with `x-csrf-token: fetch`, and (3) a session cookie returned by the CSRF fetch that must be re-sent on the write call. All three are needed for POST/PUT/PATCH. Reuse the [`simpleCache`](#step-5b-oauth-20-with-token-caching-oauth2-cached) bean for both tokens, and add an `instanceCookieHandler` bean.

### Cookie handler bean — `src/main/resources/repo/beans/instanceCookieHandler.xml`

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
  <bean id="instanceCookieHandler" class="org.apache.camel.http.base.cookie.InstanceCookieHandler"/>
</beans>
```

### JWT fetch route

Use the same `get-jwt-token` route from Step 5b. Set the subscription key header if SAP API Management is in front of the OData service:

```xml
<setHeader name="Ocp-Apim-Subscription-Key">
  <simple>{{ext.api.subscriptionKey}}</simple>
</setHeader>
```

### CSRF fetch route — `src/main/resources/repo/routes/get-csrf-token.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="get-csrf-token">
    <description>Fetches a CSRF token from the SAP OData service. Must run after get-jwt-token; uses instanceCookieHandler so the SAP session cookie is reused on the subsequent write.</description>
    <from uri="direct:get-csrf-token"/>

    <log message="Refreshing CSRF token"/>
    <setHeader name="x-nova-sapsid"><simple>{{ext.api.sap.environment}}</simple></setHeader>
    <setHeader name="Ocp-Apim-Subscription-Key"><simple>{{ext.api.subscriptionKey}}</simple></setHeader>
    <setHeader name="Content-Type"><constant>application/json</constant></setHeader>
    <setHeader name="Accept"><constant>application/json</constant></setHeader>
    <setHeader name="x-csrf-token"><constant>fetch</constant></setHeader>
    <setHeader name="CamelHttpMethod"><constant>GET</constant></setHeader>
    <setHeader name="CamelHttpQuery"><constant>$top=1</constant></setHeader>
    <setHeader name="Authorization">
      <simple>Bearer ${bean:simpleCache.getOrDefault('JWT','')}</simple>
    </setHeader>
    <setHeader name="HttpUri"><simple>{{ext.api.sap.serviceUrl}}</simple></setHeader>

    <toD uri="${header.HttpUri}?bridgeEndpoint=true&amp;cookieHandler=#instanceCookieHandler"/>

    <log message="CSRF response status ${header.CamelHttpResponseCode}"/>
    <toD uri="bean:simpleCache?method=put('CSRF',${header.x-csrf-token})"/>
  </route>
</routes>
```

### Combined refresh route — `src/main/resources/repo/routes/refresh-api-tokens.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="refresh-api-tokens" autoStartup="{{ext.api.tokens.autoStartup:true}}">
    <from uri="timer://refresh-api-tokens?delay=0&amp;period={{ext.api.tokens.refreshPeriodMs}}"/>
    <log message="Refreshing JWT + CSRF tokens"/>
    <to uri="direct:get-jwt-token"/>
    <to uri="direct:get-csrf-token"/>
  </route>
</routes>
```

### Business route for write call

```xml
<setHeader name="Content-Type"><constant>application/json</constant></setHeader>
<setHeader name="Accept"><constant>application/json</constant></setHeader>
<setHeader name="CamelHttpMethod"><constant>POST</constant></setHeader>
<setHeader name="Authorization">
  <simple>Bearer ${bean:simpleCache.getOrDefault('JWT','')}</simple>
</setHeader>
<setHeader name="X-CSRF-Token">
  <simple>${bean:simpleCache.getOrDefault('CSRF','')}</simple>
</setHeader>
<setHeader name="Ocp-Apim-Subscription-Key">
  <simple>{{ext.api.subscriptionKey}}</simple>
</setHeader>
<setHeader name="HttpUri"><simple>{{ext.api.sap.serviceUrl}}</simple></setHeader>

<toD uri="${header.HttpUri}?bridgeEndpoint=true&amp;cookieHandler=#instanceCookieHandler&amp;throwExceptionOnFailure=true&amp;socketTimeout=60000&amp;connectTimeout=30000&amp;connectionClose=true"/>
```

The same `instanceCookieHandler` bean must be passed to both the CSRF fetch and the write call — otherwise SAP rejects the CSRF token with HTTP 403.

## Step 5e: Detailed Error Body Extraction

Replace the generic `<doCatch>` body with structured parsing so the failure reason is captured into headers for downstream logic (e.g., status writeback). Use inside the business route's `<onException>` or `<doCatch>`:

```xml
<onException>
  <exception>java.lang.Exception</exception>
  <redeliveryPolicy maximumRedeliveries="{{ext.api.retry.maxRedeliveries}}" redeliveryDelay="{{ext.api.retry.delayMs}}"/>
  <handled><constant>true</constant></handled>

  <setBody><simple>${exception.getResponseBody()}</simple></setBody>
  <log loggingLevel="ERROR" message="[{route-name}][HTTP_ERROR] body=${body}"/>

  <choice>
    <!-- Plain-text error (e.g., 'CSRF token expired') -->
    <when>
      <groovy>body instanceof java.lang.String &amp;&amp; !body.startsWith("{")</groovy>
      <setHeader name="ApiErrorMessage"><simple>${body}</simple></setHeader>
    </when>
    <!-- JSON error with top-level 'message' field -->
    <when>
      <jsonpath suppressExceptions="true">$.message</jsonpath>
      <setHeader name="ApiErrorMessage">
        <jsonpath suppressExceptions="true">$.message</jsonpath>
      </setHeader>
    </when>
    <!-- SAP OData error envelope -->
    <otherwise>
      <setHeader name="ApiErrorMessage">
        <jsonpath suppressExceptions="true">$.error.message.value</jsonpath>
      </setHeader>
    </otherwise>
  </choice>

  <setHeader name="CamelHttpResponseCode"><simple>${exception.getStatusCode()}</simple></setHeader>
  <setHeader name="ApiCallResult"><constant>Failure</constant></setHeader>
  <setBody><simple>${exchangeProperty.originalPayload}</simple></setBody>

  <!-- Optional: write status back to Pricefx -->
  <to uri="direct:writeback-api-status"/>
</onException>
```

The route must stash the original payload before the call so the writeback has access to the business keys:

```xml
<setProperty name="originalPayload"><simple>${body}</simple></setProperty>
```

## Step 5f: Status Writeback Callback (`pfx-api:massedit` on DMDS)

When the upstream Pricefx flow needs to know which records succeeded/failed, write the API result back to a DMDS that tracks integration state. The writeback route uses `defaultErrorHandler` to avoid interfering with the caller's redelivery policy.

### Writeback route — `src/main/resources/repo/routes/writeback-api-status.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="writeback-api-status" errorHandlerRef="defaultErrorHandler">
    <description>Update integration-status fields on the source DMDS after an outbound API call. Uses defaultErrorHandler so it does not inherit the caller's redelivery policy.</description>
    <from uri="direct:writeback-api-status"/>

    <log message="Writeback messageID=${id} correlationId=${header.correlationId} status=${header.ApiCallResult}"/>

    <toD uri="pfx-api:massedit?mapper={{ext.api.writeback.mapper}}&amp;filter={{ext.api.writeback.filter}}&amp;objectType=DMDS&amp;dataSourceName=DMDS.${header.source}"/>

    <log message="${header.source} writeback complete: ${body}"/>
  </route>
</routes>
```

### Mapper — `src/main/resources/repo/mappers/writeback-api-status.mapper.xml`

```xml
<mappers>
  <loadMapper id="writeback-api-status.mapper">
    <header in="ApiCallResult"      out="attribute20"/>
    <header in="CamelHttpResponseCode" out="attribute21"/>
    <header in="ApiErrorMessage"    out="attribute22"/>
    <header in="ExternalRecordId"   out="attribute23"/>
    <simple expression="${date:now:yyyy-MM-dd'T'HH:mm:ss}" out="attribute24"/>
  </loadMapper>
</mappers>
```

### Filter — `src/main/resources/repo/filters/writeback-api-status.filter.xml`

```xml
<filter id="writeback-api-status.filter" sortBy="id">
  <and>
    <criterion fieldName="attribute1" operator="equals" value="simple:${header.recordKey}"/>
  </and>
</filter>
```

Adapt `attribute1`/`attribute20`–`attribute24` to the actual DMDS column layout. On the success path, set `ApiCallResult=Success` and `ExternalRecordId` from the API response (e.g., via `<jsonpath>$.d.ConditionRecord</jsonpath>`), then `<to uri="direct:writeback-api-status"/>`.

## Step 6: Generate Properties

Add to `src/main/resources/repo/config/application.properties`:

```properties
# --- Target endpoint ---
ext.api.url=https://api.example.com/v1/endpoint

# --- Auth: OAuth 2.0 client credentials ---
ext.api.auth.url=https://login.example.com/oauth2/token
ext.api.auth.grantType=client_credentials
ext.api.auth.clientId=my-client-id
ext.api.auth.clientSecret={ENC}encryptedValue==
ext.api.auth.scope=api://my-app/.default

# --- Auth: API key (alternative to OAuth) ---
# ext.api.apiKey={ENC}encryptedValue==

# --- Auth: Basic (alternative — URI options, not stored here) ---
# ext.api.basicUsername=my-user
# ext.api.basicPassword={ENC}encryptedValue==

# --- Auth: OAuth 2.0 with token caching (alternative — see Step 5b) ---
# ext.api.tokens.autoStartup=true
# ext.api.tokens.refreshPeriodMs=1800000

# --- Auth: mTLS (alternative — see Step 5c) ---
# ext.api.mtls.certAlias=client-cert-alias
# keystore.filename=/path/to/identity.jks            # set as env var, not here, in prod
# keystore.password={ENC}encryptedValue==            # set as env var, not here, in prod
# truststore.filename=/path/to/truststore.jks
# truststore.password={ENC}encryptedValue==

# --- Auth: SAP JWT+CSRF (alternative — see Step 5d) ---
# ext.api.subscriptionKey={ENC}encryptedValue==
# ext.api.sap.environment=PRD
# ext.api.sap.serviceUrl=https://sap.example.com/sap/opu/odata/sap/MY_SERVICE/EntitySet

# --- Retry (used by error-handler in Step 5e) ---
ext.api.retry.maxRedeliveries=3
ext.api.retry.delayMs=5000

# --- Writeback (used by Step 5f) ---
# ext.api.writeback.mapper=writeback-api-status.mapper
# ext.api.writeback.filter=writeback-api-status.filter

# --- Throttling ---
ext.api.maxConcurrentConnections=10

# --- Dry-run toggle (set 'true' to suppress HTTP calls during testing) ---
ext.api.call_is_DISABLED=false

# --- Scheduling (if trigger is Quartz) ---
# ext.api.schedule.cron=0+0+*+?+*+*
# ext.api.schedule.timezone=UTC
```

Only include the auth properties matching the chosen auth type. **For `mtls`, `keystore.password` and `truststore.password` should come from environment variables — not from `application.properties`** (the `sslContext.xml` bean reads them via `#{environment['...']}`).

## Step 7: Retry Configuration (optional)

If the user requested retry on transient errors, add a Spring bean file `src/main/resources/repo/routes/rest-outbound-retry-policy.xml`:

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
           http://www.springframework.org/schema/beans/spring-beans.xsd">

  <bean id="restOutboundRedeliveryPolicy" class="org.apache.camel.processor.RedeliveryPolicy">
    <property name="maximumRedeliveries" value="3"/>
    <property name="redeliveryDelay" value="5000"/>
    <property name="backOffMultiplier" value="2"/>
    <property name="useExponentialBackOff" value="true"/>
    <property name="retryAttemptedLogLevel" value="WARN"/>
  </bean>

</beans>
```

Then reference it in the business route's `<onException>`:
```xml
<onException redeliveryPolicyRef="restOutboundRedeliveryPolicy">
  <exception>java.lang.Exception</exception>
  <handled><constant>false</constant></handled>
  <log loggingLevel="ERROR"
       message="[{route-name}][RETRY] correlationId=${headers.correlationId} attempt=${header.CamelRedeliveryCounter} ${exception.message}"/>
</onException>
```

## Step 8: Self-Check

After generating all files, verify automatically:

1. Every `{{placeholder}}` in route XML has a corresponding entry in `application.properties`.
2. Route file name matches route `id` attribute exactly.
3. `&amp;` used for every `&` in XML URI attributes.
4. No credentials hardcoded (no raw passwords, tokens, or keys in route XML or properties).
5. `socketTimeout` and `connectTimeout` are set on all `<toD>` HTTP calls.
6. Auth sub-route (`rest_auth_get_token`) is present if auth type is `oauth2`, absent otherwise.
7. Body is restored after the auth sub-route call (already handled in the shared route template).
8. `throwExceptionOnFailure=false` used ONLY on token/CSRF endpoints; `throwExceptionOnFailure=true` on all business calls.
9. For `oauth2-cached` and `sap-jwt-csrf`: `simpleCache` bean exists, refresh timer is configured, business route reads via `${bean:simpleCache.getOrDefault('JWT','')}`.
10. For `sap-jwt-csrf`: the same `cookieHandler=#instanceCookieHandler` is on both the CSRF fetch `<toD>` and the business write `<toD>`.
11. For `mtls`: `sslContextParameters=#sslContextParameters` is on the business `<toD>`; `keystore.password` / `truststore.password` are NOT in `application.properties` (env vars only).
12. For writeback callback: route uses `errorHandlerRef="defaultErrorHandler"` so it does not inherit the caller's redelivery policy.

Fix any issues silently and report what was corrected.

## Important Rules

- **When a route builds its request body using a FreeMarker template**, store the `.ftl` file in `src/main/resources/repo/resources/` and reference it as `freemarker:file://{{integration.data}}/repository/resources/{filename}.ftl?allowContextMapAll=true`. Do NOT use `classpath:` — templates are not on the classpath after IM startup.
- NEVER hardcode credentials, URLs, or environment-specific values in route XML — always use `{{property}}` placeholders
- NEVER use `throwExceptionOnFailure=false` on the business HTTP call — use it only on the OAuth token endpoint
- ALWAYS set `socketTimeout` and `connectTimeout` on every `<toD>` HTTP call — missing timeouts cause permanent thread blocks
- ALWAYS preserve the request body in `REST_requestBody` before calling the auth sub-route — the auth call overwrites the body
- When splitting large payloads and sending many requests, add `<throttle>` in the calling route (not inside the shared call route)
- `call_is_DISABLED=true` must suppress the actual HTTP call — always include the dry-run toggle for safe testing
- NEVER use `noop=true` — not applicable to HTTP endpoints, but do not carry it over from file patterns
- **Simple mode (no auth / apikey, single route):** Generate everything in one route file. Do NOT create `rest-outbound-shared.xml` — it's unnecessary overhead for simple cases.
- **Complex mode (OAuth2, multiple outbound routes):** The shared `direct:rest_outbound_call` route must be reused across all outbound REST integrations in the project — do not duplicate it per business route
- **Token caching (`oauth2-cached`, `sap-jwt-csrf`):** Reuse a single `simpleCache` bean across all routes — do not declare it twice. The refresh timer route (`refresh-api-tokens`) should be the only entry point that mutates the cache.
- **SAP CSRF + cookies:** The CSRF fetch and the write call MUST share the same `instanceCookieHandler` bean reference. SAP binds the CSRF token to the session cookie returned by the fetch; using a fresh cookie jar (or omitting `cookieHandler=#instanceCookieHandler`) returns HTTP 403.
- **mTLS:** Store `keystore.password` and `truststore.password` as environment variables, never in `application.properties` or the route XML. Use `#{environment['keystore.password']}` in `sslContext.xml`.
- **Status writeback:** The writeback route must use `errorHandlerRef="defaultErrorHandler"`. If it inherits the caller's redelivery policy, a transient `pfx-api:massedit` failure will trigger the caller's retry loop and re-send the outbound API call.
- Route IDs must match file names without `.xml`: file `export-approvals-to-erp.xml` → `id="export-approvals-to-erp"`
- All `&` in URI parameters must be escaped as `&amp;` in XML attributes

## References

- [REST Outbound Pattern](../../../integration-manager/docs/patterns/rest-outbound.md)
- [Chained Routes Pattern](../../../integration-manager/docs/patterns/chained-routes-direct.md)
