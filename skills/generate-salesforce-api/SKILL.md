---
name: generate-salesforce-api
description: Generate a Pricefx Integration Manager route that calls the Salesforce REST API — fetching SObject records via SOQL into Pricefx (Customer/Product master, PA Data Sources) or pushing data back to Salesforce via the SObject REST endpoints. Use this skill when the source or target system is Salesforce. Covers the OAuth2 client-credentials connection JSON, API-version discovery, SOQL queries with cursor-based pagination (`done` / `nextRecordsUrl`), `Sforce-Query-Options` batch size override, and bearer-token re-auth on 401.
---

# Generate Salesforce API Integration

You are generating a Salesforce REST API integration for a Pricefx Integration Manager project. Salesforce is a REST source/target with quirks that justify a dedicated skill: cursor-paginated query responses, a versioned path segment, an inflexible default page size, and a token endpoint that the generic `generate-rest-outbound-integration` skill does not preconfigure.

Common use cases:
- Import Salesforce **Accounts → Pricefx Customer Master**
- Import Salesforce **Opportunities → Pricefx PA Data Source** (DMDS)
- Import Salesforce **Products → Pricefx Product Master**
- Push Pricefx-calculated prices/quotes **back to Salesforce** via PATCH on `/sobjects/{Type}/{Id}`

## Step 1: Gather Information

Ask the user for the following (or read from `$ARGUMENTS` if already provided):

1. **Direction** — `inbound` (Salesforce → Pricefx) or `outbound` (Pricefx → Salesforce).
2. **Salesforce SObject** — `Account`, `Contact`, `Opportunity`, `Product2`, a custom object like `MyCustomObj__c`, etc.
3. **Pricefx target/source object** — `C` (Customer), `P` (Product), `DM` (Data Mart / DMDS), `LTV`, etc., plus any required `dsUniqueName`, `pricingParameterName`, `businessKeys`.
4. **Route name** — kebab- or PascalCase (e.g., `import-Salesforce-Accounts`, `export-Pricefx-Quotes-to-Salesforce`). Used as file name and route ID.
5. **SOQL fields** (inbound) — list of columns from the SObject. The route's SOQL becomes `SELECT {fields} FROM {SObject} WHERE ... ORDER BY LastModifiedDate`.
6. **Filter / WHERE clause** (inbound) — e.g., `Name != null`, `IsActive = true`, or a `LastModifiedDate >= :lastSync` for incremental loads.
7. **Salesforce environment** — production (`https://{org}.my.salesforce.com`) or sandbox (`https://{org}--{sandbox}.sandbox.my.salesforce.com`). Determines both `url` and `authUrl` in the connection JSON.
8. **Auth flow** — `client_credentials` (recommended for server-to-server), `password` (legacy, requires the user's security token), or `jwt_bearer` (for keypair-based integrations). The sample uses `client_credentials`.
9. **Connection ID** — typically `salesforce`. Multiple Salesforce orgs in the same project should use distinct IDs (`salesforce-prod`, `salesforce-sbx`).
10. **Connected App credentials** — confirm the user has created a Salesforce Connected App with OAuth enabled. Don't ask for the values; tell the user to put them in `application-local.properties` and into encrypted (`{ENC}...`) form for deployed environments.
11. **Schedule** — one-shot via `timer:`, recurring via `quartz:`, or `direct:` for orchestration by another route. Most production imports use Quartz.

If the user provided some of these, skip asking.

## Step 2: Plan Files

| Direction | Files to create |
|---|---|
| `inbound` | `connections/salesforce.json`, `routes/{route-name}.xml`, `mappers/{route-name}.mapper.xml`, properties for SOQL/batch/connection |
| `outbound` | `connections/salesforce.json` (if not already present), `routes/{route-name}.xml`, `mappers/{route-name}.mapper.xml` (Pricefx → Salesforce field mapping) |
| Discovery (one-off) | `routes/import-Salesforce-get-available-api-versions.xml` to print the supported API versions and pick one for the SOQL query path |

The mapper file id must match the file name without `.xml` (per the IM convention). The connection id (`"id":"salesforce"`) must match the file name (`salesforce.json`).

## Step 3: Generate the Salesforce Connection

File: `src/main/resources/repo/connections/salesforce.json`

Salesforce uses an OAuth2 connection with a custom `authRequestTemplate` because Salesforce's token endpoint expects form-encoded grant parameters under specific names.

### `client_credentials` (recommended for server-to-server)

```json
{
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.OAuth2Connection",
  "id": "salesforce",
  "url": "https://{org}.my.salesforce.com/",
  "authUrl": "https://{org}.my.salesforce.com/services/oauth2/token",
  "authRequestHeaderBearer": "Bearer",
  "authRequestHeader": "Authorization",
  "authRequestContentType": "application/x-www-form-urlencoded",
  "authResponseTokenKey": "access_token",
  "authResponseExpirationKey": "expires_in",
  "authResponseExpirationKeyLocation": "body_json",
  "reAuthOnCodes": "400,401,404",
  "authExpirationMultiplier": 1,
  "username": "",
  "password": "",
  "clientId": "{ENC}...",
  "clientSecret": "{ENC}...",
  "authRequestTemplate": "{\"grant_type\": \"client_credentials\",\"client_id\": \"::clientId\",\"client_secret\": \"::clientSecret\"}"
}
```

### `password` grant (legacy)

Same fields, but with the password grant template. Requires the integration user's security token concatenated with the password:

```json
"username": "integration@example.com",
"password": "{password}{securityToken}",
"authRequestTemplate": "{\"grant_type\": \"password\",\"client_id\": \"::clientId\",\"client_secret\": \"::clientSecret\",\"username\": \"::username\",\"password\": \"::password\"}"
```

Critical notes on the connection:
- `url` is the **base** for SObject calls. SOQL queries go to `/services/data/v{N}.0/query`, individual records to `/services/data/v{N}.0/sobjects/{Type}/{Id}`.
- `authUrl` is the token endpoint. Production: `https://{org}.my.salesforce.com/services/oauth2/token`. Sandbox: `https://{org}--{sandbox}.sandbox.my.salesforce.com/services/oauth2/token`. Do NOT use `https://login.salesforce.com` once the org has My Domain enabled (which all modern orgs do).
- `reAuthOnCodes: "400,401,404"` — Salesforce returns 401 for an expired token; the IM OAuth2 connection refreshes and retries automatically.
- `authResponseExpirationKeyLocation: "body_json"` — Salesforce puts `expires_in` in the JSON response body, not in a header.
- Real values for `clientId` / `clientSecret` belong in `{ENC}...` form for non-local environments. `application-local.properties` can hold plaintext but the file must be gitignored.

## Step 4: Discover the API Version (one-off)

Salesforce SOQL queries require a versioned URL path (`/services/data/v{N}.0/query`). Versions go end-of-life, so the integration should pin a version that the org supports.

File: `src/main/resources/repo/routes/import-Salesforce-get-available-api-versions.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-Salesforce-get-available-api-versions" autoStartup="false">
    <from uri="timer:import-Salesforce-get-available-api-versions?repeatCount=1"/>
    <log message="Fetching API versions from Salesforce..." loggingLevel="INFO"/>
    <toD uri="pfx-rest:get?uri=/services/data&amp;connection=salesforce"/>
    <log message="Got:\n${body}"/>
  </route>
</routes>
```

`autoStartup="false"` keeps it dormant by default; start it from the management UI when needed. The output is a JSON array of `{label, url, version}` objects — pick the highest `version` ≤ the org's max and bake it into the SOQL route.

## Step 5: Inbound — Account → Customer (SOQL with Cursor Pagination)

File: `src/main/resources/repo/routes/import-Salesforce-{SObject}.xml`

Salesforce caps SOQL responses at 2000 rows by default (min 200, max 2000). When the result exceeds the page size, the response includes `done: false` and `nextRecordsUrl` — the route must follow these links until `done: true`.

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-Salesforce-{SObject}" autoStartup="true">
    <from uri="timer:import-Salesforce-{SObject}?repeatCount=1"/>

    <log message="Fetching {SObject} data from Salesforce..." loggingLevel="INFO"/>

    <setHeader name="sfQuery">
      <constant>SELECT Id,LastModifiedDate,Name FROM {SObject} WHERE Name != null ORDER BY LastModifiedDate</constant>
    </setHeader>

    <!-- Override Salesforce default page size. Min 200, max 2000.
         Header MUST be prefixed `pfx-rest.` so the pfx-rest component forwards it as a real HTTP header.
         https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_changing_batch_size.htm -->
    <setHeader name="pfx-rest.Sforce-Query-Options">
      <constant>batchSize=200</constant>
    </setHeader>

    <!-- First page -->
    <toD uri="pfx-rest:get?uri=/services/data/v61.0/query&amp;q=${header.sfQuery}&amp;connection=salesforce"/>
    <unmarshal><json/></unmarshal>

    <setProperty name="totalSize"><groovy>body.totalSize</groovy></setProperty>
    <setProperty name="importedRecords"><groovy>0</groovy></setProperty>

    <filter>
      <groovy>exchange.properties.totalSize == 0</groovy>
      <log message="Nothing to load, stopping..." loggingLevel="INFO"/>
      <stop/>
    </filter>

    <setProperty name="importedRecords"><groovy>body?.records?.size() + exchange.properties.importedRecords.toInteger()</groovy></setProperty>
    <log message="About to import records: ${exchangeProperty.totalSize}" loggingLevel="INFO"/>
    <log message="Importing {SObject} records: ${exchangeProperty.importedRecords}/${exchangeProperty.totalSize}" loggingLevel="INFO"/>

    <!-- `done`/`nextRecordsUrl` drive the pagination loop -->
    <setProperty name="sfDone"><groovy>body.done</groovy></setProperty>
    <setProperty name="nextUrl"><groovy>body.nextRecordsUrl</groovy></setProperty>

    <!-- The records array is what `loaddata` consumes -->
    <setBody><groovy>body.records</groovy></setBody>
    <to uri="pfx-api:loaddata?mapper={SObject}DataMapper&amp;objectType=C&amp;businessKeys=customerId"/>

    <!-- Subsequent pages -->
    <loop doWhile="true">
      <simple>${exchangeProperty.sfDone} == false</simple>

      <toD uri="pfx-rest:get?uri=${exchangeProperty.nextUrl}&amp;connection=salesforce"/>
      <unmarshal><json/></unmarshal>

      <setProperty name="nextUrl"><groovy>body.nextRecordsUrl</groovy></setProperty>
      <setProperty name="sfDone"><groovy>body.done</groovy></setProperty>
      <setProperty name="importedRecords"><groovy>body?.records?.size() + exchange.properties.importedRecords.toInteger()</groovy></setProperty>
      <log message="Importing {SObject} records: ${exchangeProperty.importedRecords}/${exchangeProperty.totalSize}" loggingLevel="INFO"/>

      <setBody><groovy>body.records</groovy></setBody>
      <to uri="pfx-api:loaddata?mapper={SObject}DataMapper&amp;objectType=C&amp;businessKeys=customerId"/>
    </loop>

    <log message="Import of {SObject}. Records count: ${exchangeProperty.importedRecords}" loggingLevel="INFO"/>
  </route>
</routes>
```

Key points:
- `pfx-rest.Sforce-Query-Options` — the `pfx-rest.` prefix is required for the `pfx-rest` component to forward the header as a real outgoing HTTP header. Without the prefix the header is treated as a Camel-internal header and never reaches Salesforce.
- `nextRecordsUrl` already starts with `/services/data/...` — pass it to `pfx-rest:get?uri=...` as-is, no concatenation with the base URL.
- `body.records` is the JSON array of SObjects. `loaddata` maps each element through `{SObject}DataMapper`.
- For DMDS targets, replace the `loaddata` calls with `pfx-api:loaddata?objectType=DM&dsUniqueName={Name}&mapper=...` and add a `pfx-api:flush` after the loop.

For incremental loads, parameterize the WHERE clause with a `pfx-config:get`-driven `lastSync` timestamp:

```xml
<to uri="pfx-config:get?name=Integration.Salesforce.{SObject}.LastSync&amp;toHeader=lastSync&amp;defaultValue=1900-01-01T00:00:00Z"/>
<setHeader name="sfQuery">
  <simple>SELECT Id,LastModifiedDate,Name FROM {SObject} WHERE LastModifiedDate &gt;= ${header.lastSync} ORDER BY LastModifiedDate</simple>
</setHeader>
...
<!-- After the loop, persist the high-water mark -->
<toD uri="pfx-config:set?name=Integration.Salesforce.{SObject}.LastSync&amp;value=${header.startTimestamp}"/>
```

## Step 6: Generate the Mapper

File: `src/main/resources/repo/mappers/{SObject}DataMapper.xml`

Salesforce JSON fields use PascalCase (`Name`, `LastModifiedDate`, `Id`); Pricefx attribute names are camelCase (`name`, `customerId`, `attribute1`). Use `<body>` for direct field copies and `<groovy>` when a transformation is needed.

```xml
<mappers>
  <loadMapper id="{SObject}DataMapper" convertEmptyStringToNull="true">
    <body in="Name" out="name"/>
    <body in="Id"   out="customerId"/>
    <body in="Id"   out="attribute24"/>

    <!-- Date trim — Salesforce returns full ISO-8601 timestamps; Pricefx date attributes need yyyy-MM-dd -->
    <groovy expression="body.LastModifiedDate.take(10)" out="attribute25" converterExpression="stringToDate(yyyy-MM-dd)"/>

    <!-- Custom field — note the __c suffix in the SOQL response key -->
    <body in="Segment__c" out="attribute1"/>
    <body in="Country__c" out="attribute9"/>
  </loadMapper>
</mappers>
```

`convertEmptyStringToNull="true"` is essential — Salesforce returns `""` for unset string fields, and Pricefx will store the empty string verbatim unless this is set.

For nested relationships (`Account.Owner.Name` style), the mapper must use Groovy because the field key contains a dot:

```xml
<groovy expression="body.Owner?.Name" out="attribute10"/>
```

## Step 7: Outbound — Pricefx → Salesforce (PATCH SObject)

For pushing data back to Salesforce — e.g., writing a Pricefx-calculated price to a custom field on the Account or creating a Quote in Salesforce — use `pfx-rest:patch` (update existing) or `pfx-rest:post` (create new) against `/services/data/v{N}.0/sobjects/{Type}/{Id}`.

```xml
<route id="export-Pricefx-Prices-to-Salesforce">
  <from uri="direct:export-Pricefx-Prices-to-Salesforce"/>

  <!-- Fetch records to push (filter selects only what changed since last run) -->
  <toD uri="pfx-api:fetch?objectType=PX&amp;filter=salesforce-export-filter&amp;batchedMode=true&amp;batchSize=200"/>

  <split stopOnException="false">
    <simple>${body}</simple>

    <toD uri="pfx-api:fetchIterator"/>
    <toD uri="pfx-model:transform?mapper=salesforce-export.mapper"/>
    <marshal><json/></marshal>

    <setHeader name="sfId"><groovy>request.headers.{businessKey}</groovy></setHeader>

    <!-- PATCH a single SObject record. Salesforce returns 204 No Content on success. -->
    <toD uri="pfx-rest:patch?uri=/services/data/v61.0/sobjects/Account/${header.sfId}&amp;connection=salesforce"/>
  </split>

  <log message="Done. Pushed updates to Salesforce."/>
</route>
```

For high-volume writes (>1000 records), use the **Composite REST API** instead of per-record PATCH to stay under Salesforce's API call quota:

```xml
<!-- Build a composite request with up to 25 sub-requests -->
<setBody>
  <groovy>
    [allOrNone: false, compositeRequest: records.collect { rec ->
      [method: 'PATCH',
       url: "/services/data/v61.0/sobjects/Account/${rec.Id}",
       referenceId: rec.Id,
       body: [Pricing_Tier__c: rec.attribute1, Last_Calculated__c: rec.attribute2]]
    }]
  </groovy>
</setBody>
<marshal><json/></marshal>
<toD uri="pfx-rest:post?uri=/services/data/v61.0/composite&amp;connection=salesforce"/>
```

Composite caps at 25 sub-requests per call but counts as a single API call against the daily quota — a 25× reduction in call cost.

## Step 8: Properties

Per-environment in `application-app_{env}.properties`, plus dev-only in `application-local.properties`:

```properties
###############################################################################
# Salesforce
###############################################################################
salesforce.url=https://{org}.my.salesforce.com/
salesforce.authUrl=https://{org}.my.salesforce.com/services/oauth2/token
salesforce.clientId={ENC}...
salesforce.clientSecret={ENC}...
salesforce.api.version=v61.0
salesforce.batch-size=2000
```

If `connections/salesforce.json` references these via property placeholders (`"clientId": "${salesforce.clientId}"`), IM resolves them at startup. Otherwise the JSON file holds the values directly — fine for the sandbox sample, but for deployed environments encrypted placeholders are mandatory.

## Important Rules

- **Header prefix `pfx-rest.`** — any Salesforce-specific header (`Sforce-Query-Options`, `Sforce-Auto-Assign`, `Sforce-Call-Options`) must be set with the `pfx-rest.` prefix to be forwarded. Without it the value never leaves IM.
- **Always set `Sforce-Query-Options` batch size** when the SObject has > 2000 rows. The default page size is 2000 but pages of 200 are typically faster end-to-end because the deserializer/loaddata pipeline overlaps with the next page fetch.
- **`nextRecordsUrl` is a path, not a full URL** — pass it directly to `pfx-rest:get?uri=...`. The connection's `url` provides the host.
- **Pin the API version explicitly** in the route (`v61.0` not `latest`). Salesforce decommissions versions on a published schedule; pinning makes upgrades a deliberate, tested change.
- **`reAuthOnCodes` must include 401** — Salesforce returns 401 for expired tokens. Without re-auth on 401 the route fails after the first hour.
- **Sandbox vs production hostnames differ** — `https://{org}--{sandbox}.sandbox.my.salesforce.com` for sandboxes, `https://{org}.my.salesforce.com` for production. The token endpoint follows the same host. Do NOT use `login.salesforce.com` or `test.salesforce.com` (those are SAML/web-login endpoints, not the API host).
- **`convertEmptyStringToNull="true"`** on every Salesforce mapper — Salesforce returns `""` for unset strings and Pricefx will silently store the empty string otherwise.
- **Composite API for outbound batches** — single-record PATCH at scale burns the API quota. The org-wide daily limit is ~15k–250k calls depending on edition; composite cuts that 25×.
- **Never log the OAuth token or the `Authorization` header** — if you need to debug a request, log the URI and body but mask `${header.Authorization}`.
- **`stop/>` on empty result sets** — when `totalSize` is 0, exit the route before the load step. Empty `loaddata` calls succeed but emit confusing logs.
- **Re-auth latency**: the first call after a token expiry pays an extra round-trip to the token endpoint. For tight cron schedules (under 30 minutes) this is fine; for sub-minute polling, the connection layer caches the token until `expires_in`.

## References

- Salesforce REST API Reference: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
- SOQL `query` resource: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm
- Changing the SOQL batch size: https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_changing_batch_size.htm
- Composite Resources: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite.htm
- Provisioned sample: `provisioned-integration-samples/salesforce-inbound-and-outbound`
