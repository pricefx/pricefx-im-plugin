# Skills Revisions Implementation Plan (Plan C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update 8 existing skills and create 6 new skills in the plugin repo, incorporating patterns from partner project analysis and referencing the new pattern catalog + docs.

**Architecture:** Add sections to existing SKILL.md files (Important Rules, templates, references). New skills follow the established SKILL.md format with YAML frontmatter, numbered steps, inline XML templates, and Important Rules.

**Tech Stack:** Markdown skill files. Target repo: `{PLUGIN_REPO}` on branch `develop`.

**Working directory:** `{PLUGIN_REPO}`

---

### Task 1: Update generate-import-integration — streaming, batch sizing, archive, quality gates

**Files:**
- Modify: `skills/generate-import-integration/SKILL.md` (570 lines)

- [ ] **Step 1: Read current SKILL.md**
- [ ] **Step 2: Add streaming and batch sizing to Step 6 (batch size guidance)**

Find the batch size guidance section and replace/enhance with:

```markdown
### Batch Size by Object Type

| Object Type | Default Batch Size | Notes |
|---|---|---|
| P, C, SL | 20,000 | Standard master data |
| PX, CX, SX | 20,000 | Extensions |
| PPV (LTV/MLTV2) | 5,000-10,000 | Heavier records |

If the route uses `loaddata` (not `loaddataFile`), ALWAYS use `streaming="true"` on the `<split>` element.
```

- [ ] **Step 3: Add quality gate checklist to Step 10 (self-check)**

Append these items to the existing self-check list:

```markdown
- [ ] `streaming="true"` is set on `<split>` (for loaddata routes)
- [ ] Batch size matches object type guidelines
- [ ] Archive/error folder pattern is configured on file source
- [ ] No inline Groovy exceeding 15 lines
- [ ] All values that could change per environment use `{{pfx:...}}` properties
- [ ] Route references pattern catalog: [CSV/SFTP Import](../../../integration-manager/docs/patterns/import-csv-sftp.md)
```

- [ ] **Step 4: Add onCompletion CFS trigger to Important Rules**

Add to Important Rules section:

```markdown
- When the user specifies a post-import calculation (CFS), use `<onCompletion onCompleteOnly="true">` to trigger it AFTER all batches complete — never inside the split loop
- Always include `<setBody><constant/></setBody>` after loaddata inside the split to release memory per batch
```

- [ ] **Step 5: Commit**

```bash
git add skills/generate-import-integration/SKILL.md
git commit -m "skill: enhance generate-import-integration with streaming, batch sizing, quality gates"
```

---

### Task 2: Update generate-export-integration — incremental timestamp, Quartz, multicast

**Files:**
- Modify: `skills/generate-export-integration/SKILL.md` (374 lines)

- [ ] **Step 1: Read current SKILL.md**
- [ ] **Step 2: Enhance the delta/sync mode section (Step 4b)**

The current skill already has a delta export template. Enhance it with:
- Reference to [Incremental Timestamp Export Pattern](../../../integration-manager/docs/patterns/export-incremental-timestamp.md)
- Note: "Always use UTC timestamps and set timezone explicitly on Quartz"
- Add the pfx-config:get/set pattern if not already present

- [ ] **Step 3: Add Quartz best practices to scheduling section**

Add after existing Quartz cron table:

```markdown
### Quartz Best Practices
- ALWAYS set `trigger.timeZone` explicitly (e.g., `Europe/Prague`, `UTC`)
- ALWAYS set `stateful=true` to prevent overlapping executions
- Use `+` instead of spaces in cron expressions within URIs
```

- [ ] **Step 4: Add multicast pattern for parallel exports**

Add new section:

```markdown
### Parallel Export to Multiple Destinations

When exporting to both SFTP and S3, or writing multiple file formats:

```xml
<multicast parallelProcessing="true">
  <to uri="direct:export-to-sftp"/>
  <to uri="direct:export-to-s3"/>
</multicast>
```

See [Chained Routes Pattern](../../../integration-manager/docs/patterns/chained-routes-direct.md).
```

- [ ] **Step 5: Add quality gate to Important Rules**

```markdown
- For incremental exports, save the timestamp AFTER successful export, not before
- Always add `sortBy=lastUpdateDate,id` on fetch to ensure consistent pagination
- Never use `batchedMode=false` for large exports — it loads everything into memory
```

- [ ] **Step 6: Commit**

```bash
git add skills/generate-export-integration/SKILL.md
git commit -m "skill: enhance generate-export-integration with timestamp tracking, Quartz, multicast"
```

---

### Task 3: Update generate-pa-import-integration — batch validation, scheduling

**Files:**
- Modify: `skills/generate-pa-import-integration/SKILL.md` (365 lines)

- [ ] **Step 1: Read current SKILL.md**
- [ ] **Step 2: Enhance batch size guidance**

Update the existing batch guidance to include object-specific recommendations:

```markdown
### Tokenize Batch Size Guidelines

| Scenario | Recommended group= | Notes |
|---|---|---|
| Few fields (<10) | 50,000 | Simple DS records |
| Many fields (10-30) | 20,000 | More memory per record |
| Many fields (30+) | 10,000 | Heavy records |
```

- [ ] **Step 3: Add scheduling section for long-running loads**

Add new section before Important Rules:

```markdown
## Scheduling for Long-Running DS Loads

For large data sources that take hours to load, add start/stop scheduling:

```xml
<!-- Start route at 23:00 UTC -->
<route id="start-{{ROUTE_ID}}">
  <from uri="quartz://scheduler-start?cron=0+0+23+?+*+*&amp;trigger.timeZone=UTC&amp;stateful=true"/>
  <toD uri="controlbus:route?routeId={{ROUTE_ID}}&amp;action=start"/>
</route>

<!-- Stop route at 06:00 UTC -->
<route id="stop-{{ROUTE_ID}}">
  <from uri="quartz://scheduler-stop?cron=0+0+6+?+*+*&amp;trigger.timeZone=UTC&amp;stateful=true"/>
  <toD uri="controlbus:route?routeId={{ROUTE_ID}}&amp;action=stop"/>
</route>
```

See [Scheduling Start/Stop Pattern](../../../integration-manager/docs/patterns/scheduling-start-stop.md).
```

- [ ] **Step 4: Commit**

```bash
git add skills/generate-pa-import-integration/SKILL.md
git commit -m "skill: enhance generate-pa-import with batch validation and scheduling"
```

---

### Task 4: Update generate-ppv-import-integration — MLTV3, truncate-before-load

**Files:**
- Modify: `skills/generate-ppv-import-integration/SKILL.md` (343 lines)

- [ ] **Step 1: Read current SKILL.md**
- [ ] **Step 2: Add MLTV3 to Company Parameter Types table**

Add row to the types table:

```markdown
| MATRIX3 | MLTV3 | 3-key matrix | key1, key2, key3 | attribute1-N | Three-dimensional lookups |
| MATRIX4 | MLTV4 | 4-key matrix | key1-key4 | attribute1-N | Four-dimensional lookups |
| MATRIX5 | MLTV5 | 5-key matrix | key1-key5 | attribute1-N | Five-dimensional lookups |
```

- [ ] **Step 3: Add MLTV3 mapper template**

Add after existing MLTV2 mapper:

```markdown
### MLTV3 (Three-Key) Mapper

```xml
<loadMapper id="{{mapperId}}" convertEmptyStringToNull="true">
  <body in="{{csvKey1}}" out="key1"/>
  <body in="{{csvKey2}}" out="key2"/>
  <body in="{{csvKey3}}" out="key3"/>
  <body in="{{csvValue1}}" converterExpression="{{converter1}}" out="attribute1"/>
  <!-- additional attributes as needed -->
</loadMapper>
```
```

- [ ] **Step 4: Add truncate-before-load pattern**

Add new section:

```markdown
## Truncate Before Load (Full Refresh)

When the import replaces all existing data (not upsert), truncate old records first:

```xml
<!-- Before the split/load block -->
<toD uri="pfx-api:delete?objectType=${headers.objectType}&amp;filter=truncateByNameFilter&amp;connection={{pfx:connection}}"/>
```

With filter:
```xml
<filter id="truncateByNameFilter" resultFields="name">
  <and>
    <criterion fieldName="name" operator="equals" value="simple:headers.entityName"/>
  </and>
</filter>
```

Ask the user: "Should this import replace all existing data (full refresh) or add/update records (upsert)?" If full refresh, include truncate.
```

- [ ] **Step 5: Commit**

```bash
git add skills/generate-ppv-import-integration/SKILL.md
git commit -m "skill: add MLTV3 support and truncate-before-load to PPV import"
```

---

### Task 5: Update generate-event-driven-route — seda, chaining, multi-event

**Files:**
- Modify: `skills/generate-event-driven-route/SKILL.md` (211 lines)

- [ ] **Step 1: Read current SKILL.md**
- [ ] **Step 2: Add SEDA queue pattern**

Add new section after existing approaches:

```markdown
## Approach 4: SEDA Queue for Concurrent Processing

When events need parallel processing (e.g., multiple items per event):

```xml
<route id="event-{{EVENT_NAME}}-processor">
  <from uri="seda:event-{{EVENT_NAME}}?concurrentConsumers={{pfx:event.concurrency:5}}"/>
  <split stopOnException="true">
    <simple>${body[data]}</simple>
    <to uri="direct:process-{{EVENT_NAME}}-item"/>
  </split>
</route>
```

Use `seda:` instead of `direct:` when:
- Event handler does heavy work (API calls, file I/O)
- Multiple events may arrive simultaneously
- You want backpressure and configurable concurrency

See [Event-Driven Routes Pattern](../../../integration-manager/docs/patterns/event-driven-routes.md).
```

- [ ] **Step 3: Add multi-event listener pattern**

```markdown
## Multiple Event Types in One Route

For handling multiple related events with shared logic:

```xml
<!-- Separate entry points per event type -->
<route id="event-ITEM_APPROVED_PL">
  <from uri="direct:eventITEM_APPROVED_PL"/>
  <setProperty name="eventSource"><constant>ITEM_APPROVED_PL</constant></setProperty>
  <to uri="direct:shared-approval-handler"/>
</route>

<route id="event-ITEM_APPROVED_CT">
  <from uri="direct:eventITEM_APPROVED_CT"/>
  <setProperty name="eventSource"><constant>ITEM_APPROVED_CT</constant></setProperty>
  <to uri="direct:shared-approval-handler"/>
</route>

<!-- Shared handler -->
<route id="shared-approval-handler">
  <from uri="direct:shared-approval-handler"/>
  <!-- Common logic here -->
</route>
```
```

- [ ] **Step 4: Commit**

```bash
git add skills/generate-event-driven-route/SKILL.md
git commit -m "skill: add SEDA queue and multi-event patterns to event-driven route"
```

---

### Task 6: Update generate-integration-test — expanded test scenarios

**Files:**
- Modify: `skills/generate-integration-test/SKILL.md` (246 lines)

- [ ] **Step 1: Read current SKILL.md**
- [ ] **Step 2: Add edge case test scenarios**

Add new section "Edge Case Test Scenarios":

```markdown
## Edge Case Test Scenarios

Always consider generating tests for these scenarios in addition to the happy path:

### Empty File Test
```groovy
def "should handle empty CSV file gracefully"() {
    given:
    mockPost("/pricefx/{{partition}}/loaddata/{{objectType}}", 200, '{"node":{"data":[]}}')
    seedFile("{{routeId}}/empty.csv", "header1,header2\n")

    when:
    camelContext.routeController.startRoute("{{routeId}}")

    then:
    new PollingConditions(timeout: 30).eventually {
        verifyPost("/pricefx/{{partition}}/loaddata/{{objectType}}", 0)
    }
}
```

### Malformed CSV Test
```groovy
def "should handle malformed CSV rows"() {
    given:
    mockPost("/pricefx/{{partition}}/loaddata/{{objectType}}", 200, '{"node":{"data":[]}}')
    seedFile("{{routeId}}/malformed.csv", "header1,header2\nvalue1\nvalue1,value2,extra")

    when:
    camelContext.routeController.startRoute("{{routeId}}")

    then:
    // Route should process valid rows and skip/log invalid ones
    new PollingConditions(timeout: 30).eventually {
        verifyPost("/pricefx/{{partition}}/loaddata/{{objectType}}", 1)
    }
}
```

### Large Batch Test
```groovy
def "should process file with multiple batches"() {
    given:
    mockPost("/pricefx/{{partition}}/loaddata/{{objectType}}", 200, '{"node":{"data":[]}}')
    def csvContent = "header1,header2\n" + (1..100).collect { "val${it},val${it}" }.join("\n")
    seedFile("{{routeId}}/large.csv", csvContent)

    when:
    camelContext.routeController.startRoute("{{routeId}}")

    then:
    new PollingConditions(timeout: 60).eventually {
        verifyPost("/pricefx/{{partition}}/loaddata/{{objectType}}", { it >= 1 })
    }
}
```
```

- [ ] **Step 3: Commit**

```bash
git add skills/generate-integration-test/SKILL.md
git commit -m "skill: add edge case test scenarios to generate-integration-test"
```

---

### Task 7: Update generate-from-requirement — pattern recognition

**Files:**
- Modify: `skills/generate-from-requirement/SKILL.md` (153 lines)

- [ ] **Step 1: Read current SKILL.md**
- [ ] **Step 2: Add advanced pattern recognition to Step 2 (parse requirement)**

Add after the existing field parsing table:

```markdown
### Advanced Pattern Detection

When parsing requirements, look for these keywords to select the right pattern:

| Keyword in Requirement | Pattern to Use |
|---|---|
| "scheduled", "daily", "hourly", "cron" | Add Quartz scheduler to route |
| "incremental", "delta", "changes only" | Use incremental timestamp export pattern |
| "event", "trigger", "after load", "on completion" | Use event-driven route |
| "Kafka", "topic", "CDC", "real-time" | Use Kafka dual pipeline pattern |
| "SOAP", "XML", "WSDL", "web service" | Use SOAP outbound pattern |
| "REST", "API", "POST", "PUT", "webhook" | Use REST outbound pattern |
| "S3", "bucket", "AWS" | Use S3 integration pattern |
| "multi-tenant", "partitions", "multiple instances" | Use multi-tenant pattern |
| "time window", "off-peak", "overnight" | Use scheduling start/stop pattern |

When an advanced pattern is detected, reference the corresponding pattern catalog document and adapt the generated route accordingly.
```

- [ ] **Step 3: Commit**

```bash
git add skills/generate-from-requirement/SKILL.md
git commit -m "skill: add advanced pattern recognition to generate-from-requirement"
```

---

### Task 8: Update new-integration-wizard — advanced questions

**Files:**
- Modify: `skills/new-integration-wizard/SKILL.md` (205 lines)

- [ ] **Step 1: Read current SKILL.md**
- [ ] **Step 2: Add advanced questions after Step 9b**

Add new steps:

```markdown
### Step 9c: Scheduling (import routes)

For import routes, ask:
> "Does this import need time-windowed scheduling? (e.g., only run between 23:00-06:00)"

If yes, note `scheduling: start-stop` and include start/stop cron times.

### Step 9d: Post-Import Actions

Ask:
> "Should anything happen after the import completes? Options:
> a) Trigger a CFS calculation
> b) Flush DMDS data source
> c) Send a notification
> d) No post-import action"

Note the selection for route generation.

### Step 9e: Error Handling Preference

Ask:
> "How should errors be handled?
> a) Standard (archive/error folders + logging) — recommended
> b) Email notification on failure
> c) Retry with exponential backoff (for API sources)"

Default to (a) if user is unsure.
```

- [ ] **Step 3: Update Step 12 (requirement doc template) to include new fields**

Add to the requirement doc template:

```markdown
| Scheduling | {{scheduling or 'none'}} |
| Post-Import Action | {{postAction or 'none'}} |
| Error Handling | {{errorHandling or 'standard'}} |
```

- [ ] **Step 4: Commit**

```bash
git add skills/new-integration-wizard/SKILL.md
git commit -m "skill: add advanced questions to new-integration-wizard"
```

---

### Task 9: Create generate-rest-outbound-integration skill (HIGH PRIORITY)

**Files:**
- Create: `skills/generate-rest-outbound-integration/SKILL.md`

- [ ] **Step 1: Create skill directory and SKILL.md**

Read the REST outbound pattern at `{IM_REPO}/docs/patterns/rest-outbound.md` for the XML templates and structure.

Create a SKILL.md following the established format (YAML frontmatter, numbered steps, inline templates, Important Rules). The skill should:

1. Ask user for: target API URL, HTTP method, auth type (OAuth/API key/Basic), request format, retry needs
2. Generate: route XML (auth sub-route + call route + business route), properties file
3. Include: error classification, body preservation, dry-run toggle
4. Reference: [REST Outbound Pattern](../../../integration-manager/docs/patterns/rest-outbound.md)

- [ ] **Step 2: Commit**

```bash
git add skills/generate-rest-outbound-integration/SKILL.md
git commit -m "skill: create generate-rest-outbound-integration"
```

---

### Task 10: Create generate-scheduling-route skill (HIGH PRIORITY)

**Files:**
- Create: `skills/generate-scheduling-route/SKILL.md`

- [ ] **Step 1: Create skill directory and SKILL.md**

Read the scheduling pattern at `{IM_REPO}/docs/patterns/scheduling-start-stop.md`.

The skill should:
1. Ask: which route to schedule, start time, stop time, timezone
2. Generate: start route XML, stop route XML
3. Include: Quartz cron helper, timezone reference
4. Reference: [Scheduling Start/Stop Pattern](../../../integration-manager/docs/patterns/scheduling-start-stop.md)

- [ ] **Step 2: Commit**

```bash
git add skills/generate-scheduling-route/SKILL.md
git commit -m "skill: create generate-scheduling-route"
```

---

### Task 11: Create generate-kafka-integration skill (MEDIUM PRIORITY)

**Files:**
- Create: `skills/generate-kafka-integration/SKILL.md`

- [ ] **Step 1: Create skill directory and SKILL.md**

Read the Kafka pattern at `{IM_REPO}/docs/patterns/kafka-dual-pipeline.md`.

The skill should:
1. Ask: Kafka topic, message format, target DS/DMDS, grouping key (OPCO), aggregation settings
2. Generate: Kafka consumer route XML, shared loaddata route, properties for broker/security
3. Include: dual-pipeline concept, error handling with throttling, manual commit pattern
4. Reference: [Kafka Dual Pipeline Pattern](../../../integration-manager/docs/patterns/kafka-dual-pipeline.md)

- [ ] **Step 2: Commit**

```bash
git add skills/generate-kafka-integration/SKILL.md
git commit -m "skill: create generate-kafka-integration"
```

---

### Task 12: Create generate-soap-integration skill (MEDIUM PRIORITY)

**Files:**
- Create: `skills/generate-soap-integration/SKILL.md`

- [ ] **Step 1: Create skill directory and SKILL.md**

Read the SOAP pattern at `{IM_REPO}/docs/patterns/soap-outbound.md`.

The skill should:
1. Ask: SOAP endpoint URL, SOAPAction, auth type, payload structure
2. Generate: business route XML, shared SOAP call route XML, FreeMarker template, properties
3. Include: three-layer separation, application-level fault detection, request/response archiving
4. Reference: [SOAP Outbound Pattern](../../../integration-manager/docs/patterns/soap-outbound.md)

- [ ] **Step 2: Commit**

```bash
git add skills/generate-soap-integration/SKILL.md
git commit -m "skill: create generate-soap-integration"
```

---

### Task 13: Create generate-s3-integration and generate-multi-tenant-route skills (LOW PRIORITY)

**Files:**
- Create: `skills/generate-s3-integration/SKILL.md`
- Create: `skills/generate-multi-tenant-route/SKILL.md`

- [ ] **Step 1: Create S3 skill**

Read pattern at `{IM_REPO}/docs/patterns/s3-integration.md`. Generate: S3 consumer/producer routes, properties. Key: RAW() for secret key, composite parameter blocks.

- [ ] **Step 2: Create multi-tenant skill**

Read pattern at `{IM_REPO}/docs/patterns/multi-tenant-partitions.md`. Generate: per-partition entry routes, shared handler, partition-specific properties. Key: partition list iteration, connection per partition.

- [ ] **Step 3: Commit**

```bash
git add skills/generate-s3-integration/SKILL.md skills/generate-multi-tenant-route/SKILL.md
git commit -m "skill: create generate-s3-integration and generate-multi-tenant-route"
```

---

### Task 14: Final review and plugin registration

- [ ] **Step 1: Verify all 15 skills exist** (9 updated + 6 new)

```bash
ls -d skills/*/
```

- [ ] **Step 2: Grep for customer-specific content**

```bash
grep -ri "watsco\|ford\|ahlsell\|syscous\|dotfoods\|cargill\|beacon\|fiskars\|covetrus\|ruukki" skills/
```

- [ ] **Step 3: Verify cross-references to pattern catalog are valid paths**

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "Plan C complete: 8 skills updated, 6 new skills created"
```
