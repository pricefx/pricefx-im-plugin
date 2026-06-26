# Route Quality Report

```
Route: export-customers-daily
Type:  Scheduled Export (quartz in from, id starts with export-, no pfx-config:get timestamp tracking; objectType=C)
File:  evals/workspaces/analyze/iteration-2/pos-compliance-streaming/fixture/export-customers-daily.xml
```

## QUALITY REPORT

```
#    | Check                                | Status | Detail
-----|--------------------------------------|--------|------------------------------------------
N-1  | Route ID matches filename            | OK     | export-customers-daily matches export-customers-daily.xml
N-2  | No pfx: prefix on route ID           | OK     | No pfx: prefix
N-3  | Mapper ID matches filename           | N/A    | Mapper export-customers-daily.mapper referenced but file not present in fixture; cannot verify
N-4  | Filter ID matches filename           | N/A    | Filter export-customers-daily.filter referenced but file not present in fixture; cannot verify
N-5  | Route file under 200 lines           | OK     | 16 lines
X-1  | XML escaping                         | OK     | All & escaped as &amp; in quartz, fetch, and file URIs
F-1  | Archive folder                       | N/A    | No file consumer (<from> is quartz); file URI is a producer (<to>)
F-2  | Error folder                         | N/A    | No file consumer
F-3  | Read lock                            | N/A    | No file consumer
F-4  | No noop=true                         | N/A    | No file consumer
F-5  | File URIs use integration.sftp.root  | OK     | Output <to> uses file://{{integration.sftp.root}}/outbound/customers
A-1  | No redundant connection=pricefx      | OK     | No connection=pricefx on any pfx-api / pfx-model / pfx-csv URI
A-2  | PX/CX/SX mapper has extension name   | N/A    | Object type is C (Customer master), not an extension; export route
A-3  | Correct key fields                   | N/A    | Export route; no load/integrate businessKeys to validate
A-4  | Prefer loaddataFile for P/PX/C/CX    | N/A    | Export route, no import/loaddata present
D-1  | Flush present                        | N/A    | Not a DS/DMDS route
D-2  | Flush outside split                  | N/A    | Not a DS/DMDS route
E-1  | PX/CX/SX filter has name criterion   | N/A    | Object type is C (Customer master), not an extension
E-2  | Filter-Mapper field sync             | N/A    | Filter and mapper files not present in fixture; cannot verify resultFields vs <body in>
S-1  | Streaming on split                   | FAIL   | <split> has no streaming="true" attribute
AP-1 | Inline Groovy under 15 lines         | OK     | No <groovy> blocks
AP-2 | No hardcoded hostnames/IPs           | OK     | No literal hostnames, IPs, or URLs in uri= attributes
AP-3 | CFS trigger not inside split         | OK     | No pfx-api:calculate / pfx-api:execute / CFS URI inside the split
AP-4 | No datafeed truncate after DS_FLUSH  | N/A    | No truncate / DS_FLUSH handling in route
AP-5 | <delay> has explicit asyncDelayed    | N/A    | No <delay> element in route

SUMMARY: 7 passed, 1 failed, 0 warnings, 15 not applicable
```

## Notes on the user's specific concerns

- **Streaming on splits** — FAIL (S-1). The `<split>` element is missing `streaming="true"`.
- **Proper error handling** — This skill's only error-handling-adjacent check is F-2 (error folder), which is N/A for a route with no file consumer. doTry/doCatch and onCompletion are not part of this skill's S-1..AP-5 check set, so per the skill's "stick to the checks listed — do not invent additional checks" rule, no FAIL/WARN is recorded for the absence of an error handler on this route.

## Suggested Fixes

```
FAIL S-1: Streaming on split
  The <split> over the batched-fetch result has no streaming="true" attribute,
  so all batch iterators are buffered in memory before processing. For a 50000-
  batchSize batched fetch this defeats the purpose of batched mode and risks
  memory exhaustion on large customer exports.

  Where: the <split> element (line 7).

  How to fix -- add streaming="true" to the <split>:

  <split streaming="true">
      <simple>${body}</simple>
      <toD uri="pfx-api:fetchIterator"/>
      <toD uri="pfx-model:transform?mapper=export-customers-daily.mapper"/>
      <toD uri="pfx-csv:marshal"/>
      <to uri="file://{{integration.sftp.root}}/outbound/customers?fileName=customers-${date:now:yyyyMMdd}.csv&amp;fileExist=Append"/>
  </split>
```
