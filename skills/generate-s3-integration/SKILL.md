---
name: generate-s3-integration
description: Use when a Pricefx Integration Manager route reads from or writes to an AWS S3 bucket — says "poll S3 for inbound CSVs", "export to S3", "upload to S3", "bridge S3 to SFTP", or "S3 integration", and needs a consumer (poll/delete), producer (upload), or S3-to-SFTP bridge.
---

# Generate S3 Integration

You are generating an AWS S3 integration for a Pricefx Integration Manager project. Follow the steps below. Never hardcode AWS credentials — always use encrypted property placeholders.

## Step 1: Gather Information

Ask the user for the following (or read from `$ARGUMENTS` if already provided):

1. **Integration type** — choose one:
   - `inbound` — S3 consumer: poll bucket, process files, load into Pricefx
   - `outbound` — S3 producer: export data from Pricefx, upload to S3
   - `bridge` — S3-to-SFTP: read from S3, write to SFTP server
2. **Route name** — descriptive kebab-case name (e.g., `inbound-from-s3`, `export-to-s3`, `s3-to-sftp-bridge`). Used as file name and route ID.
3. **S3 bucket name** — the AWS bucket to consume from or write to.
4. **S3 prefix** (inbound/bridge only) — key prefix to filter objects (e.g., `inbound/products/`). Leave empty to poll the entire bucket.
5. **AWS region** — e.g., `us-east-1`, `eu-west-1`.
6. **AWS credentials** — confirm that credentials will be stored as encrypted values (`{ENC}...`) in `application.properties`. Never ask for the actual values.
7. **Delete after read?** (inbound/bridge) — default `true`. Set to `false` only if an idempotency repository is configured.
8. **Poll interval** (inbound/bridge) — how often to check for new files, in milliseconds. Default: `30000` (30 seconds).
9. **Max files per poll** (inbound/bridge) — `0` for unlimited, or a specific number to throttle ingestion rate.
10. **S3 object key pattern** (outbound) — how to name files in S3 (e.g., `{subdir}/{partitionCode}/Export/{filename}.csv`).
11. **SFTP connection name** (bridge only) — the IM-configured SFTP connection name. SFTP directory path.
12. **Write .done marker file?** (bridge only) — write an empty `.done` file after the main file to signal completion to the downstream system.
13. **What happens after reading the file?** (inbound) — e.g., load into Pricefx DMDS, load into Product Master, transform and route elsewhere.

## Step 2: Plan Route Structure

| Integration type | Files to create |
|---|---|
| `inbound` | `{route-name}.xml`, mapper (if loading to Pricefx), properties |
| `outbound` | `{route-name}.xml`, properties |
| `bridge` | `{route-name}.xml`, properties |

## Step 3a: Generate Inbound Route (S3 Consumer)

File: `src/main/resources/repo/routes/{route-name}.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="{route-name}">
    <from uri="aws2-s3://{{s3.bucket.name}}?prefix={{s3.prefix}}&amp;{{pfx:s3.inbound.common}}&amp;secretKey=RAW({{s3.secretKey}})"/>

    <log message="[{route-name}] Received S3 object: ${header.CamelAwsS3Key}" loggingLevel="INFO"/>

    <!-- Preserve S3 object key as the file name for downstream processing -->
    <setHeader name="CamelFileName">
      <simple>${header.CamelAwsS3Key}</simple>
    </setHeader>

    <!-- Process the file: parse CSV, map, load to Pricefx -->
    <!-- Adapt the steps below to the actual processing logic -->
    <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true&amp;delimiter=,"/>
    <to uri="pfx-api:loaddataFile?objectType={OBJECT_TYPE}&amp;mapper={route-name}.mapper&amp;batchSize=20000"/>

    <log message="[{route-name}] Completed processing: ${header.CamelFileName}" loggingLevel="INFO"/>
  </route>
</routes>
```

> ⚠️ **Heads-up — observability trade-off for the inbound load:**
>
> `streamingUnmarshal` + `loaddataFile` streams the S3 object to Pricefx as a single opaque upload. IM logs show only the start and end of the load — **no per-batch progress, no row counts mid-stream, no per-batch timings**. If the load takes hours or partially fails, you cannot tell from IM logs how far it got.
>
> Before generating, **ask the user**:
>
> > **The default S3 inbound template uses `loaddataFile` (fast, but no per-batch progress in IM logs). For large or long-running S3 imports, would you prefer the split/tokenize+`loaddata` pattern with batch-level logging instead?**
>
> If they want per-batch logging, replace the unmarshal+loaddataFile pair with a `<split aggregationStrategy="recordsCountAggregation" streaming="true">` containing `<tokenize group="N" token="\n"/>` + `pfx-csv:unmarshal` + a batch log + `pfx-api:loaddata` (see `generate-import-integration` for the full template).

## Step 3b: Generate Outbound Route (S3 Producer)

File: `src/main/resources/repo/routes/{route-name}.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="{route-name}">
    <from uri="direct:{route-name}"/>

    <!-- Build the S3 producer endpoint URI and store in a header.
         Using a header avoids creating a new S3 client on every exchange. -->
    <setHeader name="s3Endpoint">
      <simple>aws2-s3://{{s3.bucket.name}}?region={{s3.region}}&amp;accessKey={{s3.accessKeyId}}&amp;secretKey={{s3.secretKey}}</simple>
    </setHeader>

    <!-- Set the S3 object key (full path inside the bucket) -->
    <setHeader name="CamelAwsS3Key">
      <simple>{{s3.bucket.subdir}}/${header.partitionCode}/Export/${header.interfaceFileName}.csv</simple>
    </setHeader>

    <!-- Body must contain the file content before this step -->
    <log message="[{route-name}] Uploading to S3: ${header.CamelAwsS3Key}" loggingLevel="INFO"/>
    <toD uri="${header.s3Endpoint}"/>
    <log message="[{route-name}] Upload complete: ${header.CamelAwsS3Key}" loggingLevel="INFO"/>
  </route>
</routes>
```

## Step 3c: Generate S3-to-SFTP Bridge Route

File: `src/main/resources/repo/routes/{route-name}.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="{route-name}">
    <from uri="aws2-s3://{{s3.bucket.name}}?prefix={{s3.prefix}}&amp;{{pfx:s3.inbound.common}}&amp;secretKey=RAW({{s3.secretKey}})"/>

    <log message="[{route-name}] Received from S3: ${header.CamelAwsS3Key}" loggingLevel="INFO"/>

    <!-- Carry the S3 object key forward as the SFTP destination file name -->
    <setHeader name="CamelFileName">
      <simple>${header.CamelAwsS3Key}</simple>
    </setHeader>

    <!-- Write the file to the SFTP server -->
    <to uri="pfx-sftp:parameters?connection={{s3.sftp.connection}}&amp;directory={{s3.sftp.directory}}&amp;fileName=/${header.CamelFileName}&amp;useUserKnownHostsFile=false&amp;fileExist=Override"/>
    <log message="[{route-name}] Saved to SFTP: ${header.CamelFileName}" loggingLevel="INFO"/>

    <!-- Write an empty .done marker to signal the file is fully written (remove if not needed) -->
    <setHeader name="CamelFileName">
      <simple>${header.CamelFileName}.done</simple>
    </setHeader>
    <setBody><constant/></setBody>
    <to uri="pfx-sftp:parameters?connection={{s3.sftp.connection}}&amp;directory={{s3.sftp.directory}}&amp;fileName=/${header.CamelFileName}&amp;useUserKnownHostsFile=false&amp;fileExist=Override"/>
    <log message="[{route-name}] Wrote .done marker: ${header.CamelFileName}" loggingLevel="INFO"/>
  </route>
</routes>
```

Remove the `.done` marker block if the downstream system does not expect it.

## Step 4: Generate Properties

Add to `src/main/resources/repo/config/application.properties`:

```properties
# === AWS S3 Integration: {route-name} ===

# AWS IAM credentials (encrypt with IM keystore — NEVER store as plain text)
s3.accessKeyId=AKIA...
s3.secretKey={ENC}...encryptedValue...

# Bucket coordinates
s3.bucket.name=my-company-bucket
s3.bucket.subdir=Production
s3.region=us-east-1

# S3 key prefix for inbound polling (leave empty to poll the whole bucket)
s3.prefix=inbound/{entity}/

# Composite inbound poll settings (referenced as {{pfx:s3.inbound.common}})
# Escape = and & inside composite values with \= and \& (Java .properties rules)
pfx\:s3.inbound.common=maxMessagesPerPoll\=0&includeFolders\=false&region\=us-east-1&accessKey\={{s3.accessKeyId}}&delay\=30000&initialDelay\=2000&deleteAfterRead\=true

# S3-to-SFTP bridge: SFTP connection and target directory
s3.sftp.connection=my-sftp-connection
s3.sftp.directory=/inbound/{entity}
```

Adjust `maxMessagesPerPoll` and `delay` to match the required throughput. Remove unused properties.

### Minimum IAM permissions required

| Permission | Required for |
|---|---|
| `s3:GetObject` | Inbound consumer, bridge |
| `s3:DeleteObject` | Inbound/bridge with `deleteAfterRead=true` |
| `s3:PutObject` | Outbound producer |
| `s3:ListBucket` | Prefix-based polling |

Include this table as a comment in the generated README or ticket description so the infrastructure team can configure IAM correctly.

## Step 5: Generate Mapper (Inbound only, if loading to Pricefx)

If the inbound route loads into a Pricefx object, generate a mapper:

File: `src/main/resources/repo/mappers/{route-name}.mapper.xml`

```xml
<mappers>
  <loadMapper id="{route-name}.mapper" convertEmptyStringToNull="true">
    <!-- Map S3 CSV columns to Pricefx fields -->
    <!-- Adapt field names from the actual CSV header -->
    <body in="{csv-key-column}" out="sku"/>
    <body in="{csv-name-column}" out="label"/>
    <body in="{csv-numeric-column}" out="attribute1" converterExpression="stringToDecimal"/>
    <!-- Add all remaining fields -->
  </loadMapper>
</mappers>
```

Ask the user for a sample CSV header or the field mapping to complete this file.

## Step 6: Self-Check

After generating all files, verify automatically:

1. Every `{{placeholder}}` has a corresponding entry in `application.properties`.
2. Route file name matches route `id` attribute exactly.
3. `secretKey=RAW({{s3.secretKey}})` — `RAW(...)` wrapper is present on ALL consumer `<from>` URIs that include `secretKey`.
4. The S3 producer uses `toD uri="${header.s3Endpoint}"` (header-based) — NOT a literal URI with credentials directly in `<toD>`.
5. `deleteAfterRead=true` is in the composite property (inbound) unless the user explicitly requested `false`.
6. `CamelAwsS3Key` is set before every `<toD>` producer call.
7. No raw AWS credentials in route XML or plain text in properties.
8. `&amp;` used for all `&` in XML URI attributes.

Fix any issues silently and report corrections.

## Important Rules

- ALWAYS wrap `secretKey` in `RAW(...)` on the consumer `<from>` URI — Camel parses the URI at startup and misinterprets special characters (`+`, `/`, `=`, `&`) in the key value without `RAW(...)`
- Do NOT use `RAW(...)` on the producer when the endpoint URI is stored in a header — header values are not URI-parsed by Camel
- NEVER store raw AWS credentials in `application.properties` or route XML — always use `{ENC}...` encrypted values
- NEVER hardcode the bucket name, region, or key prefix in the route XML — always use `{{property}}` placeholders so environment-specific values can be swapped without touching the route file
- Store the S3 producer endpoint URI in a header and use `toD uri="${header.s3Endpoint}"` — building it inline in `<toD>` forces Camel to create a new S3 client on every exchange, causing a connection pool leak
- Set `CamelAwsS3Key` explicitly before every producer `<toD>` call — S3 has no real directories; the full object key (including any folder prefix) must be set
- Use `deleteAfterRead=true` (default) unless an idempotency repository is configured — without deletion, the same file is re-consumed on every poll
- `includeFolders=false` must be set — S3 "folder" pseudo-objects (keys ending in `/`) have an empty body and will corrupt unmarshal steps if not excluded
- `s3.prefix` must end with `/` if filtering a virtual folder — e.g., `inbound/products/` not `inbound/products`
- Route IDs must match file names without `.xml`: file `inbound-from-s3.xml` → `id="inbound-from-s3"`
- All `&` in URI parameters must be escaped as `&amp;` in XML attributes; in composite property values use `\&` (Java properties escaping)

## References

- [Import Integration Skill](../generate-import-integration/SKILL.md) — for the Pricefx load steps after reading the S3 file
- [Multi-Tenant Route Skill](../generate-multi-tenant-route/SKILL.md) — for partition-specific S3 key paths in multi-tenant setups
