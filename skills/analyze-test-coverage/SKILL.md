---
name: analyze-test-coverage
description: Scan an IM project for routes without integration tests, suggest what tests to write. Use when the user says "test coverage", "missing tests", "what needs testing", "check tests".
---

# Analyze Test Coverage

You are scanning a Pricefx Integration Manager project to identify which routes have integration tests and which do not. Follow the steps below precisely.

## Step 1: Locate Project Root

If the user specified a directory, use it. Otherwise use the current working directory. Confirm the project root contains `src/main/resources/repo/routes/`.

## Step 2: Scan All Routes

Use Glob to find all route files:

```
src/main/resources/repo/routes/**/*.xml
```

For each route file, read it and extract:
- Route ID (`id=` attribute on `<route>`)
- Route type (import, export, event, utility — same detection rules as analyze-partner-project)
- Object type (P, PX, C, CX, SL, SX, DS, DMDS, LTV, MLTV2)
- From URI (to determine import source or export trigger)

Build a list of all routes with these fields.

## Step 3: Scan All Test Files

Use Glob to find test files in both locations:

```
src/test/groovy/**/*.groovy
src/test/java/**/*Test.java
src/test/java/**/*Spec.java
```

For each test file, read it and extract:
- Class name
- Any route IDs mentioned (look for: `seedEntities`, `startRoute`, `routePrn`, `routeId`, string literals matching route ID patterns like `import-`, `export-`, `event-`)
- Which base class it extends (`WireMockSpecification`, `UnitTestSpecification`, `IntegrationTestSpecification`, `SftpTestSpecification`)

Build a list of all tests with these fields.

## Step 4: Match Routes to Tests

For each route, determine coverage by checking:

1. **Exact route ID match** — any test file contains the literal route ID string
2. **File name match** — test file name (without extension, lowercased, dashes removed) matches route file name with same transformation
3. **Object type match** — test class name contains the object type or entity name from the route

A route is **Covered** if at least one test matches by any of the three criteria above.
A route is **Uncovered** if no test matches.
A route is **Partial** if a test exists but only covers the happy path (single `def` method with no edge cases — count `def "` occurrences in the test file; if only 1, mark Partial).

## Step 5: Report Coverage

Output a coverage table:

```
Route                               | Type     | Object | Test Status | Test File
------------------------------------|----------|--------|-------------|----------------------------
import-products-from-sftp           | Import   | P      | COVERED     | ProductImportSpec.groovy
import-customers-from-sftp          | Import   | C      | PARTIAL     | CustomerImportSpec.groovy (1 test case)
export-prices-to-sftp               | Export   | PX     | MISSING     | —
event-PADATALOAD_COMPLETED          | Event    | DS     | MISSING     | —
import-transactions-ds              | Import   | DMDS   | COVERED     | TransactionDsImportSpec.groovy
```

Then show the summary:

```
SUMMARY
=======
Total routes:    12
Covered:          7  (58%)
Partial:          2  (17%)
Missing:          3  (25%)
```

## Step 6: Suggest Test Types for Uncovered Routes

For each MISSING or PARTIAL route, suggest the appropriate test type and base class:

| Route Type | Suggested Base Class | Test Pattern |
|---|---|---|
| File/SFTP import (P, PX, C, CX, SL, SX) | `IntegrationTestSpecification` | `seedEntities` + copy CSV to temp dir + `verifyPost` to loaddata endpoint |
| DMDS/DS import | `IntegrationTestSpecification` | Same as file import + verify `pfx-api:flush` called |
| PPV import (LTV, MLTV2) | `IntegrationTestSpecification` | Same as file import, verify pricingParameterName in POST body |
| Scheduled export (quartz) | `IntegrationTestSpecification` | `mockPost` fetch endpoint + verify CSV output file created in temp dir |
| Incremental export | `IntegrationTestSpecification` | Mock `pfx-config:get` response + mock fetch + verify `pfx-config:set` called |
| Event-driven (`direct:event`) | `IntegrationTestSpecification` | `sendBody("direct:eventEVENT_NAME", mockPayload)` + verify downstream action |
| Utility/chained (`direct:`) | `UnitTestSpecification` | `sendBody` to direct endpoint + `expectedResponse` |
| SFTP source (external) | `SftpTestSpecification` | Uses TestContainers SFTP |

Format suggestions as:

```
MISSING: export-prices-to-sftp
  Suggested class: ExportPricesToSftpSpec.groovy
  Base class:      IntegrationTestSpecification
  Test approach:
    1. mockPost('/pricefx/test-partition/fetch/PX', expectedResponse("responses/prices-mock.json"))
    2. seedEntities([routePrn("export-prices-to-sftp.xml"), mapperPrn("exportPricesCsvMapper.mapper.xml")])
    3. Wait with PollingConditions for CSV file in temp dir
    4. Assert CSV has correct header and at least 1 data row
  Also add:   Edge case — empty fetch response → no file written
```

## Step 7: Offer to Generate Tests

After the report, ask:

**Would you like me to generate any of these missing tests?**

If yes, use the `generate-integration-test` skill. Pass the route file name and the suggested test type as context.

If the user says "generate all missing", generate them one at a time, confirming each before moving to the next.

## Rules

- Never create or modify test files without explicit user confirmation.
- Do not include customer data or real partition names in suggestions — use `test-partition` as the placeholder.
- If no routes are found, report that and stop.
- If no test directory exists at all, note this prominently and suggest creating `src/test/groovy/net/pricefx/integration/test/` as the starting point.
- Utility/chained routes (direct: or timer: only) are lower priority — flag them last.
