# Route Quality Report

```
Route: import-products
Type:  CSV/SFTP Import (Product master, objectType=P)
File:  /Users/mnagas/Documents/pricefx/pricefx-im-plugin/evals/workspaces/analyze/iteration-2/pos-lint-import-products/fixture/import-products.xml
```

Detected type: **CSV/SFTP Import** — `from` uses `file://`, route ID starts with `import-`, and the load targets `objectType=P`.

Note: the route references `mapper=import-products.mapper`, but no mapper file exists alongside the route in the fixture directory, so mapper-dependent checks (N-3, A-2, A-3) are evaluated as not verifiable / N/A where the mapper content is required.

## QUALITY REPORT

```
#    | Check                              | Status | Detail
-----|------------------------------------|--------|------------------------------------------
N-1  | Route ID matches filename          | OK     | id="import-products" matches import-products.xml
N-2  | No pfx: prefix on route ID         | OK     | No pfx: prefix
N-3  | Mapper ID matches filename         | N/A    | No mapper file present in fixture to verify
N-4  | Filter ID matches filename         | N/A    | No filter (import route)
N-5  | Route file under 200 lines         | OK     | 10 lines
X-1  | XML escaping                       | OK     | All & escaped as &amp; in URIs
F-1  | Archive folder                     | OK     | {{archive.file}} present on from URI
F-2  | Error folder                       | WARN   | No {{error.file}} / moveFailed= on from URI
F-3  | Read lock                          | OK     | {{read.lock}} present on from URI
F-4  | No noop=true                       | OK     | Not present
F-5  | File URIs use integration.sftp.root| OK     | Uses {{integration.sftp.root}}
A-1  | No redundant connection=pricefx    | FAIL   | connection=pricefx on pfx-api:loaddataFile URI
A-2  | PX/CX/SX mapper has extension name | N/A    | objectType=P (not an extension table)
A-3  | Correct key fields                 | OK     | businessKeys=sku correct for P
A-4  | Prefer loaddataFile for P/PX/C/CX  | OK     | Uses pfx-api:loaddataFile (no split+tokenize+loaddata)
S-1  | Streaming on split                 | N/A    | No split element
AP-1 | Inline Groovy under 15 lines       | OK     | No Groovy blocks
AP-2 | No hardcoded hostnames/IPs         | OK     | None found (placeholders used)
AP-3 | CFS trigger not inside split       | N/A    | No split element
AP-4 | No datafeed truncate after DS_FLUSH| N/A    | No truncate / DS_FLUSH logic
AP-5 | <delay> has explicit asyncDelayed  | N/A    | No <delay> element

SUMMARY: 11 passed, 1 failed, 1 warning, 8 not applicable
```

## Suggested Fixes

### FAIL A-1: Redundant `connection=pricefx`

**What is wrong:** The `pfx-api:loaddataFile` URI sets `connection=pricefx`, which is redundant — `pricefx` is the implicit default connection and should never be specified on a `pfx-api` component.

**Where:** Line 7, the `<to uri="pfx-api:loaddataFile?...">` element.

**How to fix:** Remove the `&amp;connection=pricefx` parameter:

```xml
<to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;businessKeys=sku&amp;batchSize=500000"/>
```

### WARN F-2: Error folder missing

**What is wrong:** The `<from>` URI has no error-folder configuration, so files that fail processing are not moved to an error location for later inspection. The error folder is optional but recommended.

**Where:** Line 4, the `<from>` URI.

**How to fix:** Add `{{error.file}}` to the `<from>` URI:

```xml
<from uri="file://{{integration.sftp.root}}/inbound/products?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}&amp;{{error.file}}"/>
```

---

Would you like me to apply these fixes to the route file?
