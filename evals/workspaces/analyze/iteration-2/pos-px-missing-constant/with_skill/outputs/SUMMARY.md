Route: import-px-prices
Type:  CSV/SFTP Import (Product Extension — PX)
File:  evals/workspaces/analyze/iteration-2/pos-px-missing-constant/fixture/import-px-prices.xml

The `from` URI uses `file://` against `{{integration.sftp.root}}`, the route ID starts with `import-`, and the load target is `objectType=PX` — this is a CSV/SFTP import of a Product Extension table.

QUALITY REPORT
==============

```
#    | Check                              | Status | Detail
-----|------------------------------------|--------|------------------------------------------
N-1  | Route ID matches filename          | OK     | id="import-px-prices" matches import-px-prices.xml
N-2  | No pfx: prefix on route ID         | OK     | No pfx: prefix
N-3  | Mapper ID matches filename         | OK     | id="import-px-prices.mapper" matches import-px-prices.mapper.xml
N-4  | Filter ID matches filename         | N/A    | No filter for this import route
N-5  | Route file under 200 lines         | OK     | 10 lines
X-1  | XML escaping                       | OK     | All & escaped as &amp; in the URIs
F-1  | Archive folder                     | OK     | {{archive.file}} present on from URI
F-2  | Error folder                       | OK     | {{error.file}} present on from URI
F-3  | Read lock                          | OK     | {{read.lock}} present on from URI
F-4  | No noop=true                       | OK     | Not present
F-5  | File URIs use integration.sftp.root| OK     | Uses {{integration.sftp.root}}
A-1  | No redundant connection=pricefx    | OK     | Not present on any URI
A-2  | PX/CX/SX mapper has extension name | FAIL   | Mapper has no <constant ... out="name"/> — PX table name missing
A-3  | Correct key fields                 | OK     | sku used for PX (businessKeys=sku, mapper maps sku)
A-4  | Prefer loaddataFile for P/PX/C/CX  | OK     | Uses pfx-api:loaddataFile (no split+tokenize+loaddata)
S-1  | Streaming on split                 | N/A    | No split element
AP-1 | Inline Groovy under 15 lines       | N/A    | No Groovy blocks
AP-2 | No hardcoded hostnames/IPs         | OK     | None found (only batch size literal, which is fine)
AP-3 | CFS trigger not inside split       | N/A    | No split element
AP-4 | No datafeed truncate after DS_FLUSH| N/A    | Not a DMDS route
AP-5 | <delay> has explicit asyncDelayed  | N/A    | No <delay> element

SUMMARY: 13 passed, 1 failed, 0 warnings, 7 not applicable
```

## Suggested Fixes

```
FAIL A-2: PX mapper is missing the extension table name
  What is wrong:
    This is a Product Extension (PX) import, but the mapper import-px-prices.mapper
    has no <constant ... out="name"/> element. PX/CX imports do NOT take an
    extensionName URI parameter — the target extension table name is set in the
    mapper as a constant mapped to the "name" field. Without it, the import will
    fail or write to the wrong table.

  Where:
    File: import-px-prices.mapper.xml, inside <loadMapper id="import-px-prices.mapper">

  How to fix:
    Add a <constant ... out="name"/> line as the first mapping, using the actual
    PX table name (shown here as a placeholder "Prices"):

    <loadMapper id="import-px-prices.mapper">
        <constant expression="Prices" out="name"/>   <!-- required: PX table name -->
        <body in="sku" out="sku"/>
        <body in="price" out="attribute1" converterExpression="stringToDecimal"/>
        <body in="currency" out="attribute2"/>
    </loadMapper>

    Replace "Prices" with the real PX table unique name from the partition
    (verify with `pfx product-extensions` / `pfx product-extension {name}`).
```

This is a hidden bug rather than a cosmetic issue: the route and mapper are otherwise well-formed and deploy-clean, so it will pass review and only fail at runtime (or silently load into the wrong/no extension table). Fix the mapper before deploying.

Would you like me to apply this fix to the mapper file?
