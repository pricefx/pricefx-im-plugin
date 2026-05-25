# generate-rest-outbound-integration — References

Advanced auth variants and auxiliary features for the rest-outbound skill. The SKILL document handles the common path (no-auth, API-key, OAuth 2.0 client-credentials, HTTP Basic). Reach for this file when the target API needs one of:

- **Token caching** (5b) — reuse a bearer token across many calls instead of fetching per call
- **Mutual TLS** (5c) — X.509 client-certificate authentication
- **SAP-style JWT + CSRF + cookies** (5d) — required for SAP OData / Gateway write operations
- **Detailed error-body extraction** (5e) — structured error parsing for status-writeback flows
- **Status writeback** (5f) — write per-record API success/failure back into a Pricefx DMDS

Each section is self-contained: bean + route + business-route hookup. Pick the auth pattern that matches the target API and drop the corresponding pieces into the project.

---

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

---

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

---

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

---

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

---

## Step 5f: Status Writeback Callback (`pfx-api:massEdit` on DMDS)

When the upstream Pricefx flow needs to know which records succeeded/failed, write the API result back to a DMDS that tracks integration state. The writeback route uses `defaultErrorHandler` to avoid interfering with the caller's redelivery policy.

### Writeback route — `src/main/resources/repo/routes/writeback-api-status.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="writeback-api-status" errorHandler="defaultErrorHandler">
    <description>Update integration-status fields on the source DMDS after an outbound API call. Uses defaultErrorHandler so it does not inherit the caller's redelivery policy.</description>
    <from uri="direct:writeback-api-status"/>

    <log message="Writeback messageID=${id} correlationId=${header.correlationId} status=${header.ApiCallResult}"/>

    <toD uri="pfx-api:massEdit?mapper={{ext.api.writeback.mapper}}&amp;filter={{ext.api.writeback.filter}}&amp;objectType=DMDS&amp;dataSourceName=DMDS.${header.source}"/>

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
