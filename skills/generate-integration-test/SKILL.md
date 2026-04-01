---
name: generate-integration-test
description: Generate a Spock integration test for a Pricefx Integration Manager route using WireMock + Spring CamelContext. Use this skill whenever the user wants to test a route, create test cases, write tests, verify an import/export route works correctly, or generate test data and expected JSON payloads. Produces a Groovy Spock test class, sample CSV data, and expected request JSON.
---

# Generate Integration Test

You are generating a Spock integration test for a Pricefx Integration Manager route. Follow the steps below precisely.

## Framework Overview

The test framework is based on **Spock + WireMock + Spring CamelContext** with three base classes:

| Class | Purpose |
|---|---|
| `WireMockSpecification` | HTTP mocking (`mockPost`, `mockGet`, `verifyPost`) |
| `UnitTestSpecification` | Seed routes/mappers/files inline, `sendBody`, `expectedResponse` |
| `IntegrationTestSpecification` | Load entities from disk repo via `seedEntities` |

Reference implementation: `/Users/mnagas/Documents/pricefx/integration-manager/integration-test/`

## Step 1: Identify the Route to Test

Ask the user which route to test, or if they already specified it, read:
- The route XML (`src/main/resources/repo/routes/{name}.xml`)
- The mapper XML (`src/main/resources/repo/mappers/{name}.mapper.xml`)
- The filter XML if applicable (`src/main/resources/repo/filters/{name}.filter.xml`)

## Step 2: Determine Test Type

| Route Type | Base Class | Pattern |
|---|---|---|
| File import (CSV → Pricefx) | `IntegrationTestSpecification` | Seed file, verify POST to loaddata endpoint |
| Export (Pricefx → CSV) | `IntegrationTestSpecification` | Mock fetch endpoint, verify file output |
| SFTP import | `SftpTestSpecification` | Uses TestContainers for embedded SFTP |

## Step 3: Generate Test Artifacts

### Directory Structure

```
src/test/
├── groovy/net/pricefx/integration/test/
│   └── {TestClassName}.groovy          # Spock test
└── resources/
    ├── data/{folder}/{test-file}.csv   # Test input data
    └── requests/{expected}.json        # Expected JSON payload
```

### Test Class Pattern (File Import)

```groovy
package net.pricefx.integration.test

import net.pricefx.integration.test.IntegrationTestSpecification
import spock.util.concurrent.PollingConditions

import net.pricefx.integration.test.utils.FileUtils as TestFileUtils

import static net.pricefx.integration.test.utils.PrnUtils.mapperPrn
import static net.pricefx.integration.test.utils.PrnUtils.routePrn

class {TestName} extends IntegrationTestSpecification {

    def "{test description}"() {

        given: 'mock pricefx endpoint and seed entities'
        mockPost('/pricefx/test-partition/loaddata/{objectType}')

        seedProperty("integration.sftp.root", temporaryFolder.toString())
        seedEntities([routePrn("{route-file}.xml"), mapperPrn("{mapper-file}.mapper.xml")])

        when: 'csv file is copied to watched subdirectory'
        def dataDir = new File(temporaryFolder, "{subfolder}")
        dataDir.mkdirs()
        org.testcontainers.shaded.org.apache.commons.io.FileUtils.copyFileToDirectory(
                TestFileUtils.readFile("data/{subfolder}/{test-file}.csv"), dataDir)

        then: 'verify that route converts csv to json and sends it to pricefx'
        def conditions = new PollingConditions(timeout: 10)
        conditions.eventually {
            verifyPost("/pricefx/test-partition/loaddata/{objectType}", 1,
                    expectedResponse("requests/{expected}.json"))
        }

    }

}
```

### Key Methods

- **`mockPost(url)`** — Stub a POST endpoint to return OK
- **`verifyPost(url, count, payload)`** — Assert POST was called N times with expected JSON body
- **`seedEntities([routePrn("..."), mapperPrn("...")])`** — Load route + mapper from `src/main/resources/repo/` (production files, no copies)
- **`seedProperty(name, value)`** — Set system property (e.g., `integration.sftp.root`)
- **`seedFile("data/path/file.csv")`** — Copy test CSV from classpath to temp folder root (flat, no subdirectories!)
- **`expectedResponse("requests/expected.json")`** — Load expected JSON for payload verification
- **`PrnUtils`** — `routePrn()`, `mapperPrn()`, `filterPrn()`, `classPrn()`, `beanPrn()`

### Test CSV Data

Create a small CSV file (2–3 rows) with headers matching the mapper's `in` fields. Use realistic but simple values.

### Expected JSON Payload

The expected JSON matches the Pricefx loaddata API format:

```json
{
  "data": {
    "options": {
      "detectJoinFields": true,
      "maxJoinFieldsLengths": []
    },
    "header": ["field1", "field2", ...],
    "data": [["val1", "val2", ...], ["val3", "val4", ...]]
  }
}
```

- **`header`** — Array of mapper `out` field names (the Pricefx field names)
- **`data`** — Array of arrays, each inner array is one row with values in header order
- String values stay as strings. Fields with `converterExpression="stringToInteger"` become integers (no quotes).
- Constants from `<constant expression="..." out="..."/>` appear in every row.

### Test Class Pattern (Export)

For export routes (Pricefx → CSV), mock the fetch endpoint and verify the output file:

```groovy
package net.pricefx.integration.test

import net.pricefx.integration.test.IntegrationTestSpecification
import spock.util.concurrent.PollingConditions

import static net.pricefx.integration.test.utils.PrnUtils.mapperPrn
import static net.pricefx.integration.test.utils.PrnUtils.routePrn
import static net.pricefx.integration.test.utils.PrnUtils.filterPrn

class {TestName} extends IntegrationTestSpecification {

    def "{test description}"() {

        given: 'mock pricefx fetch endpoint and seed entities'
        mockPost('/pricefx/test-partition/fetch/{objectType}',
                expectedResponse("responses/{mock-response}.json"))

        seedProperty("integration.sftp.root", temporaryFolder.toString())
        seedEntities([routePrn("{route-file}.xml"), mapperPrn("{mapper-file}.mapper.xml"), filterPrn("{filter-file}.filter.xml")])

        when: 'the export route runs'
        // Timer-based routes start automatically

        then: 'verify CSV file is created with expected content'
        def conditions = new PollingConditions(timeout: 10)
        conditions.eventually {
            def exportDir = new File(temporaryFolder, "{export-subfolder}")
            def csvFiles = exportDir.listFiles()?.findAll { it.name.endsWith('.csv') }
            assert csvFiles?.size() == 1

            def lines = csvFiles[0].readLines()
            assert lines.size() >= 2  // header + at least 1 data row
            assert lines[0].contains('{expected-header-field}')
        }

    }

}
```

### Mock Fetch Response JSON

For export tests, create a mock response that simulates the Pricefx fetch API:

```json
{
  "response": {
    "data": [
      {
        "sku": "PROD-001",
        "label": "Widget A",
        "attribute1": "Electronics",
        "attribute2": "99.99"
      },
      {
        "sku": "PROD-002",
        "label": "Widget B",
        "attribute1": "Hardware",
        "attribute2": "149.99"
      }
    ]
  }
}
```

Place mock responses in `src/test/resources/responses/{name}.json`.

### Test Class Pattern (Event-Driven Route)

For event-driven routes using `direct:` consumers:

```groovy
class {TestName} extends IntegrationTestSpecification {

    def "{test description}"() {

        given: 'seed entities and mock endpoints'
        mockPost('/pricefx/test-partition/fetch/{objectType}',
                expectedResponse("responses/{mock-response}.json"))

        seedProperty("integration.sftp.root", temporaryFolder.toString())
        seedEntities([routePrn("{route-file}.xml"), mapperPrn("{mapper-file}.mapper.xml")])

        when: 'event handler is triggered directly'
        sendBody("direct:{handler-route-name}", null)

        then: 'verify the expected action occurred'
        verifyPost("/pricefx/test-partition/fetch/{objectType}", 1)

    }

}
```

**Note:** For `direct:` routes, use `sendBody()` to trigger them instead of `PollingConditions`.

### Important Rules

- **NEVER create copies of routes or mappers in test resources.** Use production files from `src/main/resources/repo/` directly via `seedEntities`.
- To make file-based routes work in tests, set `seedProperty("integration.sftp.root", temporaryFolder.toString())` — this overrides the `{{integration.sftp.root}}` placeholder to point to the temp folder.
- **NEVER use `seedFile()` for routes that watch a subdirectory** (e.g., `file://{{integration.sftp.root}}/products`). `seedFile()` copies the file flat into `temporaryFolder/` root — it does NOT create subdirectories. Instead, manually create the subdirectory and copy the file:
  ```groovy
  def dataDir = new File(temporaryFolder, "{subfolder}")
  dataDir.mkdirs()
  org.testcontainers.shaded.org.apache.commons.io.FileUtils.copyFileToDirectory(
          TestFileUtils.readFile("data/{subfolder}/{file}.csv"), dataDir)
  ```
  `seedFile()` only works when the route watches `temporaryFolder` directly with no subfolder path.
- Test package: `net.pricefx.integration.test`
- Test data and expected responses go under `src/test/resources/`
- The `loaddata` endpoint path follows: `/pricefx/test-partition/loaddata/{objectType}` where objectType is P, PX, CX, C, DS
- For CX/PX imports the mapper must include `<constant expression="{ExtensionName}" out="name"/>` — this appears in the expected JSON header and data
- Filter PRN: use `filterPrn("name.filter.xml")` if the route uses a filter
- Always use `PollingConditions` for file-triggered routes (they are async)
