```
Route: import-px-prices
Type:  CSV/SFTP Import (PX)
File:  /Users/mnagas/Documents/pricefx/pricefx-im-plugin/evals/workspaces/analyze/iteration-1/pos-px-missing-constant/fixture/import-px-prices.xml

QUALITY REPORT
==============

#    | Check                                | Status | Detail
-----|--------------------------------------|--------|------------------------------------------
N-1  | Route ID matches filename            | OK     | import-px-prices matches file name
N-2  | No pfx: prefix on route ID           | OK     | No prefix found
N-3  | Mapper ID matches filename           | OK     | import-px-prices.mapper matches file name
N-4  | Filter ID matches filename           | N/A    | No filter for import route
N-5  | Route file under 200 lines           | OK     | 10 lines
X-1  | XML escaping                         | OK     | All & properly escaped
F-1  | Archive folder                       | OK     | {{archive.file}} present
F-2  | Error folder                         | OK     | {{error.file}} present
F-3  | Read lock                            | OK     | {{read.lock}} present
F-4  | No noop=true                         | OK     | Not present
F-5  | File URIs use integration.sftp.root  | OK     | Correct placeholder
A-1  | No redundant connection=pricefx      | OK     | Not present
A-2  | PX/CX/SX mapper has extension name   | FAIL   | <constant ... out="name"/> missing from mapper
A-3  | Correct key fields                   | OK     | sku used for PX
A-4  | Prefer loaddataFile for P/PX/C/CX    | OK     | Uses loaddataFile
S-1  | Streaming on split                   | N/A    | No split element
AP-1 | Inline Groovy under 15 lines         | N/A    | No Groovy blocks
AP-2 | No hardcoded hostnames/IPs           | OK     | None found
AP-3 | CFS trigger not inside split         | N/A    | No split element

SUMMARY: 14 passed, 1 failed, 0 warnings, 5 not applicable
```

## Fixes

```
FAIL A-2: PX mapper missing extension table name constant
  The loadMapper in import-px-prices.mapper.xml does not declare the PX
  extension table name. Without <constant ... out="name"/>, the PX import
  will fail at deploy/runtime — IM cannot route the records to the correct
  PX table.

  Where: import-px-prices.mapper.xml, inside <loadMapper id="import-px-prices.mapper">

  How to fix — add a <constant> mapping for the PX table name (replace
  "Prices" with the actual PX table name configured in the partition):

  <loadMapper id="import-px-prices.mapper">
      <constant expression="Prices" out="name"/>
      <body in="sku" out="sku"/>
      <body in="price" out="attribute1" converterExpression="stringToDecimal"/>
      <body in="currency" out="attribute2"/>
  </loadMapper>
```
