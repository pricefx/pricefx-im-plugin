# Plugin trigger evals

Manual test plan for **skill / agent triggering** — does Claude pick the right skill when the user types a given prompt?

This file covers **Vrstva 1** (trigger evals from the eval taxonomy). It does NOT measure whether the picked skill produces correct output (that's Vrstva 2) or whether Claude follows the skill body (Vrstva 3) — those need a different harness.

## What this catches

Trigger evals are the cheapest, highest-ROI test for a skill plugin. They specifically catch:

- **Wrong skill picked** (e.g., "load LTV exchange rates" routes to `generate-import-integration` instead of `generate-ppv-import-integration`)
- **Description regression** (changes to `description:` field break trigger phrases that used to work) — we've had this happen twice in this plugin's history (MR !17, MR !20-21)
- **Missing trigger phrases** (a synonym the user naturally types isn't covered by any skill's description)

They do NOT catch:

- Whether the skill body is correct
- Whether the generated route XML is valid
- Whether Claude actually follows the skill's procedure

## How to run

In a **fresh** Claude Code session with this plugin installed:

1. Type the user prompt verbatim from a row below
2. Observe which skill or agent Claude invokes (or which it offers, or which it announces it will use)
3. Compare to the **Expected** column
4. Mark the row PASS / FAIL

A FAIL means the `description:` field on the expected skill / agent needs work — either the description doesn't trigger on a phrase users naturally use, or another skill's description over-claims.

> **Fresh session** is important — running in a session that just used a skill biases toward that skill in subsequent turns.

## Conventions

- ✅ — positive trigger: the prompt **should** route to the listed skill / agent
- ❌ — negative trigger: the prompt **should NOT** route to the listed skill (it should pick the disambiguating alternative; the expected alternative is in the row)
- ⚠️ — ambiguous: the prompt is genuinely underspecified; the expected behavior is for Claude to **ask a clarifying question** rather than commit to one skill

---

## Generation skills

### generate-import-integration

| Prompt | Expected | Type |
|---|---|---|
| Import products from CSV | `generate-import-integration` | ✅ |
| Load PX Prices table from SFTP | `generate-import-integration` | ✅ |
| Push customer master into Pricefx | `generate-import-integration` | ✅ |
| Ingest CSV with product extension data | `generate-import-integration` | ✅ |
| Load seller master from REST API | `generate-import-integration` | ✅ |
| Load LTV currency rates | `generate-ppv-import-integration` | ❌ (LTV is Pricing Parameter) |
| Load sales history into PA Data Source | `generate-pa-import-integration` | ❌ (DMDS) |
| Import DMDS daily transactions | `generate-pa-import-integration` | ❌ |

### generate-pa-import-integration

| Prompt | Expected | Type |
|---|---|---|
| Import PA Data Source | `generate-pa-import-integration` | ✅ |
| Load transactional data into DMDS | `generate-pa-import-integration` | ✅ |
| Set up Price Analyser data load | `generate-pa-import-integration` | ✅ |
| Import sales history CSV | `generate-pa-import-integration` | ✅ |
| Import product master | `generate-import-integration` | ❌ |

### generate-ppv-import-integration

| Prompt | Expected | Type |
|---|---|---|
| Load exchange rates LTV | `generate-ppv-import-integration` | ✅ |
| Import discount matrix MLTV2 | `generate-ppv-import-integration` | ✅ |
| Set up pricing parameters | `generate-ppv-import-integration` | ✅ |
| Load company parameter values | `generate-ppv-import-integration` | ✅ |
| Import lookup table | `generate-ppv-import-integration` | ✅ |
| Import product list | `generate-import-integration` | ❌ |

### generate-export-integration

| Prompt | Expected | Type |
|---|---|---|
| Export products to CSV | `generate-export-integration` | ✅ |
| Extract changed customers since last run | `generate-export-integration` | ✅ |
| Delta sync to SFTP daily | `generate-export-integration` | ✅ |
| Push Pricefx data to external REST API | `generate-rest-outbound-integration` | ❌ (outbound REST is its own skill) |

### generate-event-driven-route

| Prompt | Expected | Type |
|---|---|---|
| Trigger an export after data load completes | `generate-event-driven-route` | ✅ |
| Listen for PADATALOAD_COMPLETED | `generate-event-driven-route` | ✅ |
| React to calculation completed event | `generate-event-driven-route` | ✅ |
| Create reactive route | `generate-event-driven-route` | ✅ |

### generate-rest-outbound-integration

| Prompt | Expected | Type |
|---|---|---|
| Call an external REST API after a Pricefx event | `generate-rest-outbound-integration` | ✅ |
| Push approved contracts to ERP via REST | `generate-rest-outbound-integration` | ✅ |
| POST to webhook from Pricefx | `generate-rest-outbound-integration` | ✅ |
| Need OAuth2 client-credentials outbound call | `generate-rest-outbound-integration` | ✅ |
| Expose a REST endpoint from IM | `generate-inbound-rest-endpoint` | ❌ |

### generate-inbound-rest-endpoint

| Prompt | Expected | Type |
|---|---|---|
| Create REST endpoint that external systems can call | `generate-inbound-rest-endpoint` | ✅ |
| Build a webhook receiver | `generate-inbound-rest-endpoint` | ✅ |
| Add a health-check endpoint | `generate-inbound-rest-endpoint` | ✅ |
| Accept incoming POST from external system | `generate-inbound-rest-endpoint` | ✅ |
| Call an external REST API from Pricefx | `generate-rest-outbound-integration` | ❌ |

### generate-kafka-integration

| Prompt | Expected | Type |
|---|---|---|
| Consume Kafka CDC events into Pricefx | `generate-kafka-integration` | ✅ |
| Set up near-real-time data ingestion from Kafka topic | `generate-kafka-integration` | ✅ |
| Stream CDC into PA Data Source | `generate-kafka-integration` | ✅ |

### generate-soap-integration

| Prompt | Expected | Type |
|---|---|---|
| Call SOAP web service from Pricefx | `generate-soap-integration` | ✅ |
| Push to legacy ERP via WSDL | `generate-soap-integration` | ✅ |
| XML SOAP envelope outbound | `generate-soap-integration` | ✅ |

### generate-s3-integration

| Prompt | Expected | Type |
|---|---|---|
| Poll S3 for inbound CSV files | `generate-s3-integration` | ✅ |
| Upload Pricefx export to S3 bucket | `generate-s3-integration` | ✅ |
| Bridge S3 to SFTP | `generate-s3-integration` | ✅ |

### generate-sql-integration

| Prompt | Expected | Type |
|---|---|---|
| Load product master from Snowflake | `generate-sql-integration` | ✅ |
| Call SQL Server stored procedure for customer changes | `generate-sql-integration` | ✅ |
| Export Pricing Parameters to a database table | `generate-sql-integration` | ✅ |
| Bulk load via Snowflake stage and gzipped CSV | `generate-sql-integration` | ✅ |

### generate-salesforce-api

| Prompt | Expected | Type |
|---|---|---|
| Fetch customer data from Salesforce | `generate-salesforce-api` | ✅ |
| Push pricing back to Salesforce | `generate-salesforce-api` | ✅ |
| Query SObject via SOQL into Pricefx | `generate-salesforce-api` | ✅ |
| Call a generic REST API | `generate-rest-outbound-integration` | ❌ (only Salesforce specifically) |

### generate-multi-tenant-route

| Prompt | Expected | Type |
|---|---|---|
| Single IM serves multiple Pricefx partitions | `generate-multi-tenant-route` | ✅ |
| Multi-tenant fan-out across business units | `generate-multi-tenant-route` | ✅ |
| Supervisor scheduler that iterates over partitions | `generate-multi-tenant-route` | ✅ |

### generate-scheduling-route

| Prompt | Expected | Type |
|---|---|---|
| Make this route only run at night (off-peak) | `generate-scheduling-route` | ✅ |
| Add a start/stop time window to my import | `generate-scheduling-route` | ✅ |
| Restrict to 23:00-06:00 UTC | `generate-scheduling-route` | ✅ |

### generate-connection

| Prompt | Expected | Type |
|---|---|---|
| Create a new SFTP connection | `generate-connection` | ✅ |
| Add an OAuth2 REST connection | `generate-connection` | ✅ |
| Configure Pricefx connection JSON | `generate-connection` | ✅ |

### generate-integration-test

| Prompt | Expected | Type |
|---|---|---|
| Write Spock tests for my import route | `generate-integration-test` | ✅ |
| Test the route with WireMock | `generate-integration-test` | ✅ |
| Add test cases for export route | `generate-integration-test` | ✅ |

---

## Migration sub-skills (rarely invoked directly — mostly via the migrate-manual-to-provisioned agent)

These are sub-skills the agent orchestrates. Direct invocation should still work but is the rarer path. Each row tests the direct trigger.

### migrate-manual-to-provisioned-routes

| Prompt | Expected | Type |
|---|---|---|
| Extract `<route>` elements from camel-context.xml | `migrate-manual-to-provisioned-routes` | ✅ |
| Split bundled routes into per-file format | `migrate-manual-to-provisioned-routes` | ✅ |

### migrate-manual-to-provisioned-mappers

| Prompt | Expected | Type |
|---|---|---|
| Extract `<loadMapper>` elements from bundled XML | `migrate-manual-to-provisioned-mappers` | ✅ |

### migrate-manual-to-provisioned-filters

| Prompt | Expected | Type |
|---|---|---|
| Extract `<filter>` elements from camel-context.xml | `migrate-manual-to-provisioned-filters` | ✅ |

### migrate-manual-to-provisioned-beans

| Prompt | Expected | Type |
|---|---|---|
| Extract Spring `<bean>` definitions from manual project | `migrate-manual-to-provisioned-beans` | ✅ |

### migrate-manual-to-provisioned-connections

| Prompt | Expected | Type |
|---|---|---|
| Convert `<pfx:connection>` XML elements to JSON files | `migrate-manual-to-provisioned-connections` | ✅ |
| Migrate `pfx.url=` properties to provisioned connection JSON | `migrate-manual-to-provisioned-connections` | ✅ |

### migrate-manual-to-provisioned-camel-syntax

| Prompt | Expected | Type |
|---|---|---|
| Apply Camel 3 → Camel 4 syntax fixes | `migrate-manual-to-provisioned-camel-syntax` | ✅ |
| Replace `${pfx:foo}` with `{{pfx:foo}}` | `migrate-manual-to-provisioned-camel-syntax` | ✅ |
| Remove `<inOnly>` / `<inOut>` elements | `migrate-manual-to-provisioned-camel-syntax` | ✅ |

### migrate-manual-to-provisioned-java-code

| Prompt | Expected | Type |
|---|---|---|
| Convert Java sources under src/main/java to Groovy | `migrate-manual-to-provisioned-java-code` | ✅ |
| Apply javax → jakarta on the migrated code | `migrate-manual-to-provisioned-java-code` | ✅ |

### migrate-manual-to-provisioned-properties

| Prompt | Expected | Type |
|---|---|---|
| Migrate application.properties to provisioned shape | `migrate-manual-to-provisioned-properties` | ✅ |

### migrate-manual-to-provisioned-pom

| Prompt | Expected | Type |
|---|---|---|
| Bump pom.xml to IM 7.x / Java 17 / Spring Boot 3 | `migrate-manual-to-provisioned-pom` | ✅ |
| Remove quartz2 and camel-aws-starter from pom.xml | `migrate-manual-to-provisioned-pom` | ✅ |

### migrate-manual-to-provisioned-groovy-sandbox

| Prompt | Expected | Type |
|---|---|---|
| Generate the IM 7.x groovy-sandbox custom-allowed-types | `migrate-manual-to-provisioned-groovy-sandbox` | ✅ |

### refactor-template-import-route

| Prompt | Expected | Type |
|---|---|---|
| Refactor this templated import route, hardwire the properties | `refactor-template-import-route` | ✅ |
| Remove the `{{pfx:...}}` placeholders from this route | `refactor-template-import-route` | ✅ |
| Convert templated import to straight-line route | `refactor-template-import-route` | ✅ |

---

## Analysis & quality skills

### analyze

| Prompt | Expected | Type |
|---|---|---|
| Lint this single route | `analyze` | ✅ |
| Check my route against best practice | `analyze` | ✅ |
| Compliance check on this route file | `analyze` | ✅ |
| Run a full project health check | `analyze-project` | ❌ (full-project is the agent) |

### compare-environments

| Prompt | Expected | Type |
|---|---|---|
| Compare dev vs prod | `compare-environments` | ✅ |
| Diff routes between two branches | `compare-environments` | ✅ |
| What changed between staging and production? | `compare-environments` | ✅ |

### document

| Prompt | Expected | Type |
|---|---|---|
| Explain what this route does | `document` | ✅ |
| Draw a Mermaid diagram for this route | `document` | ✅ |
| Show me the data flow for import-products | `document` | ✅ |
| Visualize the whole project | `visualize-project` | ❌ (whole-project is the agent) |

### estimate-performance

| Prompt | Expected | Type |
|---|---|---|
| How long will this import take for 1M records? | `estimate-performance` | ✅ |
| Sizing estimate for this route | `estimate-performance` | ✅ |

### simulate-dry-run

| Prompt | Expected | Type |
|---|---|---|
| Dry run this CSV through the import-products route | `simulate-dry-run` | ✅ |
| What would happen if I run this without making API calls? | `simulate-dry-run` | ✅ |

### list-pricefx-tables

| Prompt | Expected | Type |
|---|---|---|
| What PX tables exist in this partition? | `list-pricefx-tables` | ✅ |
| List all customer extension tables | `list-pricefx-tables` | ✅ |
| Show me the fields on the Prices table | `list-pricefx-tables` | ✅ |

---

## Workflow skills

### run-integration-wizard

| Prompt | Expected | Type |
|---|---|---|
| Start the integration wizard | `run-integration-wizard` | ✅ |
| Guide me step by step to create a new integration | `run-integration-wizard` | ✅ |

### git-workflow

| Prompt | Expected | Type |
|---|---|---|
| Create a feature branch for this work | `git-workflow` | ✅ |
| Prepare a merge request | `git-workflow` | ✅ |

---

## Agents

### debug-integration

| Prompt | Expected | Type |
|---|---|---|
| My import-products route fails with [error message] | `debug-integration` | ✅ |
| Data isn't loading correctly — please debug | `debug-integration` | ✅ |
| What's wrong with this route? | `debug-integration` | ✅ |

### impact-analysis

| Prompt | Expected | Type |
|---|---|---|
| What breaks if I rename attribute5 to attribute10? | `impact-analysis` | ✅ |
| Impact of removing the sftp.connection? | `impact-analysis` | ✅ |
| What routes depend on the Prices PX table? | `impact-analysis` | ✅ |

### document-project

| Prompt | Expected | Type |
|---|---|---|
| Document this project — I inherited it | `document-project` | ✅ |
| Reverse-engineer the routes into requirement docs | `document-project` | ✅ |
| Generate a requirement.md per route | `document-project` | ✅ |
| Build a new integration from a requirement doc | `build-integration` | ❌ (inverse direction) |

### analyze-project

| Prompt | Expected | Type |
|---|---|---|
| Analyze this project — give me a full report | `analyze-project` | ✅ |
| Project health check | `analyze-project` | ✅ |
| Quality score for this integration project | `analyze-project` | ✅ |

### migrate-project

| Prompt | Expected | Type |
|---|---|---|
| Modernize this project — fix legacy patterns | `migrate-project` | ✅ |
| Apply best-practice fixes to the routes | `migrate-project` | ✅ |
| Upgrade IM from 6.x to 7.x | `upgrade-project` | ❌ (version upgrade is its own agent) |
| Lift this manual project to provisioned | `migrate-manual-to-provisioned` | ❌ |

### upgrade-project

| Prompt | Expected | Type |
|---|---|---|
| Upgrade this project to IM 7.x | `upgrade-project` | ✅ |
| Bump from Spring Boot 2 to 3 | `upgrade-project` | ✅ |
| Apply the IM 7.x breaking changes | `upgrade-project` | ✅ |
| Modernize my route patterns (no version bump) | `migrate-project` | ❌ |

### migrate-manual-to-provisioned

| Prompt | Expected | Type |
|---|---|---|
| Migrate this manual IM project to provisioned | `migrate-manual-to-provisioned` | ✅ |
| Convert my old camel-context.xml project | `migrate-manual-to-provisioned` | ✅ |
| Lift legacy IM to provisioned layout | `migrate-manual-to-provisioned` | ✅ |
| Bump IM version | `upgrade-project` | ❌ |

### generate-test-data

| Prompt | Expected | Type |
|---|---|---|
| Generate test CSV data for my import route | `generate-test-data` | ✅ |
| Create realistic sample data matching the partition metadata | `generate-test-data` | ✅ |

### onboard-project

| Prompt | Expected | Type |
|---|---|---|
| Help me understand this project I just inherited | `onboard-project` | ✅ |
| New project orientation | `onboard-project` | ✅ |
| Onboard me — consolidated initial assessment | `onboard-project` | ✅ |

### build-integration

| Prompt | Expected | Type |
|---|---|---|
| Build a complete integration end-to-end from this requirement doc | `build-integration` | ✅ |
| Generate everything from spec — route, mapper, filter, test, docs | `build-integration` | ✅ |
| Document my existing routes | `document-project` | ❌ (inverse direction) |

### visualize-project

| Prompt | Expected | Type |
|---|---|---|
| Visualize this project as Mermaid diagrams | `visualize-project` | ✅ |
| Generate flow diagrams for every route | `visualize-project` | ✅ |
| Draw the architecture | `visualize-project` | ✅ |
| Explain just this one route | `document` (skill, not agent) | ❌ |

---

## Ambiguous prompts (test that Claude asks)

These prompts are genuinely underspecified. The expected behavior is for Claude to ask a clarifying question rather than commit to one skill.

| Prompt | Expected |
|---|---|
| "Import this data into Pricefx" | ⚠️ Ask: what kind of object? P/PX/C/CX, DMDS, or LTV/MLTV2? Each maps to a different skill. |
| "Help me with my integration" | ⚠️ Ask: are you building a new one, debugging an existing one, or migrating an old project? |
| "Set up Salesforce" | ⚠️ Ask: inbound (Salesforce → Pricefx) or outbound (Pricefx → Salesforce)? Both go through `generate-salesforce-api`, but the direction matters for the question set. |
| "Migrate this" | ⚠️ Ask: legacy `camel-context.xml` to provisioned layout (`migrate-manual-to-provisioned`), IM version bump (`upgrade-project`), or anti-pattern modernization (`migrate-project`)? |
| "Test my route" | ⚠️ Ask: generate a Spock harness (`generate-integration-test`) or run a dry-run trace without actual API calls (`simulate-dry-run`)? |
| "Document this" | ⚠️ Ask: a single route in Mermaid (`document`), the full project as diagrams (`visualize-project`), or reverse-engineer into requirement docs (`document-project`)? |

---

## Adding new evals

When you add a skill or agent, append a section here with at least:

- 3-5 positive triggers covering the variety of phrasings real users type
- 1-2 negative triggers covering nearby skills the user might confuse it with
- An ambiguous trigger only if the new skill overlaps semantically with an existing one

When you change a `description:` field, **re-run the relevant evals before merging**. Description-field regressions are the #1 source of trigger failures and are silent — you only notice when a user types something that used to work and Claude picks the wrong skill.
