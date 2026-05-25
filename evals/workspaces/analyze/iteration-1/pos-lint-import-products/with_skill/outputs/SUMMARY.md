Route: import-products
Type:  CSV/SFTP Import (Product Master, objectType=P)
File:  /Users/mnagas/Documents/pricefx/pricefx-im-plugin/evals/workspaces/analyze/iteration-1/pos-lint-import-products/fixture/import-products.xml

QUALITY REPORT
==============

| #    | Check                                | Status | Detail                                                                 |
|------|--------------------------------------|--------|------------------------------------------------------------------------|
| N-1  | Route ID matches filename            | OK     | `import-products` matches `import-products.xml`                        |
| N-2  | No pfx: prefix on route ID           | OK     | No prefix found                                                        |
| N-3  | Mapper ID matches filename           | N/A    | Mapper file not provided in fixture (referenced as `import-products.mapper`) |
| N-4  | Filter ID matches filename           | N/A    | No filter used by this import route                                    |
| N-5  | Route file under 200 lines           | OK     | 10 lines                                                               |
| X-1  | XML escaping                         | OK     | All `&` escaped as `&amp;` in URI attributes                           |
| F-1  | Archive folder                       | OK     | `{{archive.file}}` present on `<from>` URI                             |
| F-2  | Error folder                         | WARN   | `{{error.file}}` missing on `<from>` URI (optional but recommended)    |
| F-3  | Read lock                            | OK     | `{{read.lock}}` present on `<from>` URI                                |
| F-4  | No noop=true                         | OK     | Not present                                                            |
| F-5  | File URIs use integration.sftp.root  | OK     | Uses `{{integration.sftp.root}}` correctly                             |
| A-1  | No redundant connection=pricefx      | FAIL   | `connection=pricefx` present on `pfx-api:loaddataFile` URI (line 7)    |
| A-2  | PX/CX/SX mapper has extension name   | N/A    | Object type is P (Product Master), not an extension                    |
| A-3  | Correct key fields                   | OK     | `businessKeys=sku` is correct for objectType=P                         |
| A-4  | Prefer loaddataFile for P/PX/C/CX    | OK     | Uses `pfx-api:loaddataFile` (recommended for P)                        |
| S-1  | Streaming on split                   | N/A    | No `<split>` element                                                   |
| AP-1 | Inline Groovy under 15 lines         | N/A    | No `<groovy>` blocks                                                   |
| AP-2 | No hardcoded hostnames/IPs           | OK     | No literal hostnames, IPs, or URLs in URIs                             |
| AP-3 | CFS trigger not inside split         | N/A    | No `<split>` element                                                   |

SUMMARY: 11 passed, 1 failed, 1 warning, 7 not applicable

## Step 5: Specific Fixes

### FAIL A-1: Redundant `connection=pricefx` parameter

**What is wrong:** The `pfx-api:loaddataFile` URI explicitly sets `connection=pricefx`, but `pricefx` is the default connection bean and is used automatically. The parameter is redundant and should be removed.

**Where:** Line 7 of `import-products.xml`, the `pfx-api:loaddataFile` URI:

```xml
<to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;businessKeys=sku&amp;batchSize=500000&amp;connection=pricefx"/>
```

**How to fix:** Remove `&amp;connection=pricefx` from the URI:

```xml
<to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;businessKeys=sku&amp;batchSize=500000"/>
```

---

### WARN F-2: Error folder not configured

**What is wrong:** The `<from>` URI does not include `{{error.file}}`. Configuring an error folder allows IM to move failed files to a dedicated `.error/` location for diagnostics, instead of leaving them in the inbound folder.

**Where:** Line 4 of `import-products.xml`, the `<from>` URI:

```xml
<from uri="file://{{integration.sftp.root}}/inbound/products?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
```

**How to fix:** Append `&amp;{{error.file}}` to the URI:

```xml
<from uri="file://{{integration.sftp.root}}/inbound/products?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}&amp;{{error.file}}"/>
```

Ensure `error.file` is defined in `config/application.properties`:

```properties
error.file=moveFailed=.error/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd-HHmmss%7D.%24%7Bfile:ext%7D
```

---

Would you like me to apply these fixes to the route file?
