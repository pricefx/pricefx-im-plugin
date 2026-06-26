Route: export-customers-daily
Type:  Scheduled Export (quartz trigger, no pfx-config timestamp tracking)
File:  /Users/mnagas/Documents/pricefx/pricefx-im-plugin/evals/workspaces/analyze/iteration-1/pos-compliance-streaming/fixture/export-customers-daily.xml

QUALITY REPORT
==============

| #    | Check                                | Status | Detail |
|------|--------------------------------------|--------|--------|
| N-1  | Route ID matches filename            | OK     | `export-customers-daily` matches file name |
| N-2  | No `pfx:` prefix on route ID         | OK     | No prefix found |
| N-3  | Mapper ID matches filename           | N/A    | Mapper file not provided (referenced as `export-customers-daily.mapper`) |
| N-4  | Filter ID matches filename           | N/A    | Filter file not provided (referenced as `export-customers-daily.filter`) |
| N-5  | Route file under 200 lines           | OK     | 16 lines |
| X-1  | XML escaping                         | OK     | All `&` properly escaped as `&amp;` |
| F-1  | Archive folder                       | N/A    | Not a file consumer (quartz `from`) |
| F-2  | Error folder                         | N/A    | Not a file consumer |
| F-3  | Read lock                            | N/A    | Not a file consumer |
| F-4  | No `noop=true`                       | N/A    | Not a file consumer |
| F-5  | File URIs use integration.sftp.root  | OK     | Output uses `{{integration.sftp.root}}` |
| A-1  | No redundant `connection=pricefx`    | OK     | Not present |
| A-2  | PX/CX/SX mapper has extension name   | N/A    | Object type C, not an extension table |
| A-3  | Correct key fields                   | N/A    | Export route (no business-key load) |
| A-4  | Prefer `loaddataFile` for P/PX/C/CX  | N/A    | Export route, not an import |
| E-1  | PX/CX/SX filter has `name` criterion | N/A    | Object type C (not an extension) |
| E-2  | Filter-Mapper field sync             | N/A    | Filter and mapper files not provided |
| S-1  | Streaming on split                   | FAIL   | `<split>` element missing `streaming="true"` |
| AP-1 | Inline Groovy under 15 lines         | OK     | No Groovy blocks |
| AP-2 | No hardcoded hostnames/IPs           | OK     | None found |
| AP-3 | CFS trigger not inside split         | OK     | No `calculate`/`execute` inside split |

SUMMARY: 7 passed, 1 failed, 0 warnings, 13 not applicable

## Fixes

FAIL S-1: Streaming on split
  The `<split>` element does not have `streaming="true"`. Without streaming,
  the entire fetch result list is held in memory across the split — for a
  50,000-record batchSize this risks OOM and defeats batched-mode fetching.
  Where: line 7, the `<split>` element.

  Change:
      <split>
          <simple>${body}</simple>
          ...
      </split>

  To:
      <split streaming="true">
          <simple>${body}</simple>
          ...
      </split>

## Error Handling Note (informational)

The user specifically asked about error handling. The skill's check list does
not enumerate a dedicated `doTry`/`doCatch`/`onException`/`onCompletion` rule,
so no FAIL/WARN is raised. Observation only: the route has no `<onException>`,
`<doTry>`, or `<onCompletion onFailureOnly="true">` wrapper — a transient
failure mid-split will leave a partially appended CSV file at the destination
with no cleanup or alert. Consider adding error handling if recoverability
matters for this integration.

Would you like me to apply the streaming fix to the route file?
