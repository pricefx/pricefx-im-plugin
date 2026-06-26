Route: refresh-prices
Type:  DMDS/DS Import (objectType=DMDS, dsUniqueName=DMDS.Prices)
File:  /Users/mnagas/Documents/pricefx/pricefx-im-plugin/evals/workspaces/analyze/iteration-1/pos-missing-flush-dmds/fixture/refresh-prices.xml

QUALITY REPORT
==============

| #    | Check                              | Status | Detail |
|------|------------------------------------|--------|--------|
| N-1  | Route ID matches filename          | OK     | `refresh-prices` matches file name |
| N-2  | No `pfx:` prefix on route ID       | OK     | No prefix found |
| N-3  | Mapper ID matches filename         | N/A    | Mapper file not present in fixture; route references `refresh-prices.mapper` which matches convention |
| N-4  | Filter ID matches filename         | N/A    | No filter used |
| N-5  | Route file under 200 lines         | OK     | 13 lines |
| X-1  | XML escaping                       | OK     | All `&` escaped as `&amp;` |
| F-1  | Archive folder                     | OK     | `{{archive.file}}` present |
| F-2  | Error folder                       | WARN   | `{{error.file}}` not present (optional but recommended) |
| F-3  | Read lock                          | OK     | `{{read.lock}}` present |
| F-4  | No `noop=true`                     | OK     | Not present |
| F-5  | File URIs use integration.sftp.root| OK     | Uses `{{integration.sftp.root}}` |
| A-1  | No redundant `connection=pricefx`  | OK     | Not present |
| A-2  | PX/CX/SX mapper has extension name | N/A    | DMDS import |
| A-3  | Correct key fields                 | N/A    | DMDS uses `dsUniqueName` |
| A-4  | Prefer `loaddataFile` for P/PX/C/CX| N/A    | DMDS import |
| D-1  | Flush present                      | FAIL   | No `pfx-api:flush` in route — DMDS data loaded but never flushed to data source |
| D-2  | Flush outside split                | FAIL   | No flush exists at all |
| S-1  | Streaming on split                 | OK     | `<split streaming="true">` |
| AP-1 | Inline Groovy under 15 lines       | OK     | No Groovy blocks |
| AP-2 | No hardcoded hostnames/IPs         | OK     | None found |
| AP-3 | CFS trigger not inside split       | N/A    | No CFS trigger |

SUMMARY: 11 passed, 2 failed, 1 warning, 7 not applicable

## Fixes

### FAIL D-1 / D-2: Missing `pfx-api:flush` after DMDS load

The route loads data into `DMDS.Prices` but never flushes the data feed into the underlying data source. Without a flush, data sits in the feed and the DS is not updated. Place flush **outside** the `<split>` (via `<onCompletion>`) so it runs once after all batches.

**Where:** after `</split>`, before `</route>`.

**How to fix:**

```xml
<route id="refresh-prices">
    <from uri="file://{{integration.sftp.root}}/inbound/prices?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
    <log message="Refreshing prices DS" loggingLevel="INFO"/>
    <split streaming="true">
        <tokenize token="\n" group="50000"/>
        <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
        <to uri="pfx-api:loaddata?objectType=DMDS&amp;dsUniqueName=DMDS.Prices&amp;mapper=refresh-prices.mapper"/>
    </split>
    <log message="Refresh complete" loggingLevel="INFO"/>
    <onCompletion onCompleteOnly="true">
        <to uri="pfx-api:flush?dataSourceName=DMDS.Prices&amp;dataFeedName=DMF.Prices"/>
    </onCompletion>
</route>
```

Replace `DMF.Prices` with the actual data feed name backing `DMDS.Prices`.

### WARN F-2: Error folder not configured

`<from>` URI has no `moveFailed` handling.

**How to fix:**

```xml
<from uri="file://{{integration.sftp.root}}/inbound/prices?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}&amp;{{error.file}}"/>
```

Would you like me to apply these fixes to the route file?
