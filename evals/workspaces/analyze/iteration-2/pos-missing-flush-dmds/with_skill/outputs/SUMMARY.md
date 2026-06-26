# Route Quality Analysis

```
Route: refresh-prices
Type:  DMDS/DS Import (pfx-api:loaddata with objectType=DMDS)
File:  evals/workspaces/analyze/iteration-2/pos-missing-flush-dmds/fixture/refresh-prices.xml
```

## Detected Type

This route reads a CSV file from `file://`, splits it, unmarshals it, and loads it into a Pricefx Data Source via `pfx-api:loaddata?objectType=DMDS&dsUniqueName=DMDS.Prices`. The `objectType=DMDS` on the `loaddata` call classifies it as a **DMDS/DS Import**. The `split + tokenize + loaddata` pattern is the legitimate, expected shape for DMDS imports (it is NOT flagged as an anti-pattern for DMDS the way it would be for P/PX/C/CX).

No associated mapper file (`refresh-prices.mapper.xml`) or filter file is present in the fixture directory, so mapper/filter-specific checks are evaluated as N/A.

## QUALITY REPORT

```
#    | Check                                | Status | Detail
-----|--------------------------------------|--------|-------------------------------------------------------
N-1  | Route ID matches filename            | OK     | id="refresh-prices" matches refresh-prices.xml
N-2  | No pfx: prefix on route ID           | OK     | No pfx: prefix on route id
N-3  | Mapper ID matches filename           | N/A    | No mapper file present in fixture
N-4  | Filter ID matches filename           | N/A    | No filter used by this route
N-5  | Route file under 200 lines           | OK     | 13 lines
X-1  | XML escaping                         | OK     | All & escaped as &amp; in from and loaddata URIs
F-1  | Archive folder                       | OK     | {{archive.file}} present on from URI
F-2  | Error folder                         | WARN   | {{error.file}} not present (optional but recommended)
F-3  | Read lock                            | OK     | {{read.lock}} present on from URI
F-4  | No noop=true                         | OK     | Not present
F-5  | File URIs use integration.sftp.root  | OK     | from uses file://{{integration.sftp.root}}/inbound/prices
A-1  | No redundant connection=pricefx      | OK     | Not present on any pfx-* URI
A-2  | PX/CX/SX mapper has extension name   | N/A    | Not a PX/CX/SX import (DMDS)
A-3  | Correct key fields                   | N/A    | DMDS load; no P/PX/C/CX/SL/SX business key applies
A-4  | Prefer loaddataFile for P/PX/C/CX    | N/A    | DMDS import — split+tokenize+loaddata is correct here
D-1  | Flush present                        | FAIL   | No pfx-api:flush anywhere in the route
D-2  | Flush outside split                  | FAIL   | No flush exists, so it cannot be placed after </split>
S-1  | Streaming on split                   | OK     | <split streaming="true"> present
AP-1 | Inline Groovy under 15 lines         | N/A    | No Groovy blocks
AP-2 | No hardcoded hostnames/IPs           | OK     | No literal hostnames, IPs, or URLs in URIs
AP-3 | CFS trigger not inside split         | OK     | No calculate/execute/CFS call inside split
AP-4 | No datafeed truncate after DS_FLUSH  | N/A    | Not an event-driven route; no DS_FLUSH branch
AP-5 | <delay> has explicit asyncDelayed    | N/A    | No <delay> element
```

```
SUMMARY: 9 passed, 2 failed, 1 warning, 9 not applicable
```

## Suggested Fixes

### FAIL D-1 / D-2: Missing flush on DMDS import (Critical — AP-11)

**What is wrong:** A DMDS import loads data into the data feed in batches, but the data is not committed to the Price Analyser data source until a `pfx-api:flush` runs. This route has no `pfx-api:flush` at all. Without a final flush after the split closes, partial data remains in the feed and is not promoted to the data source, so PA queries and any downstream calculations run on incomplete or stale data. This is exactly the "missing flush" you suspected — your instinct is correct.

**Where:** There is no flush step. The route ends at `<log message="Refresh complete" .../>` immediately after `</split>`, with nothing committing the loaded batches.

**How to fix:** Add a `pfx-api:flush` **after** `</split>` (outside the split body), referencing both the data source and its data feed. Placing it after the split — or inside an `<onCompletion onCompleteOnly="true">` block — guarantees it runs once, after all batches have loaded, rather than once per batch.

```xml
        </split>
        <to uri="pfx-api:flush?dataSourceName=DMDS.Prices&amp;dataFeedName=DMF.Prices"/>
        <log message="Refresh complete" loggingLevel="INFO"/>
```

Equivalent placement using `onCompletion` (also valid — runs once after successful completion):

```xml
        </split>
        <log message="Refresh complete" loggingLevel="INFO"/>
        <onCompletion onCompleteOnly="true">
            <to uri="pfx-api:flush?dataSourceName=DMDS.Prices&amp;dataFeedName=DMF.Prices"/>
        </onCompletion>
```

> Note: confirm the data feed name on the partition. The data source is `DMDS.Prices` (from the `dsUniqueName` in this route); the corresponding feed is conventionally `DMF.Prices`.

### WARN F-2: Error folder not configured

Append `{{error.file}}` to the `<from>` URI so a file that fails to process is moved aside for inspection:

```xml
<from uri="file://{{integration.sftp.root}}/inbound/prices?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}&amp;{{error.file}}"/>
```
