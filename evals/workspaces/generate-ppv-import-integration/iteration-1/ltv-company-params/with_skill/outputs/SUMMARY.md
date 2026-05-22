# Import Pricing Parameter (LTV) — Company Parameters

## Overview

Generated a Pricefx Integration Manager bundle that imports rows from a CSV file into a **SIMPLE / LTV** Pricing Parameter table named `CompanyParams`. The route polls a local file system directory (default IM SFTP storage mounted into the pod) and streams each CSV to Pricefx via `pfx-api:loaddataFile`.

## Assumptions

The user prompt did not specify partition metadata, so defaults were used:

| Item | Assumed value | Why |
|---|---|---|
| Pricing Parameter table | `CompanyParams` | Derived from the user phrase "company parameter values" |
| Object type | `LTV` | Explicit in the prompt ("Pricing Parameter type LTV") |
| Inbound folder | `{{integration.sftp.root}}/inbound/company-params` | Prompt mentions `/im/inbound/params.csv`; mapped to IM-local-SFTP convention |
| CSV columns | `name`, `value` | LTV SIMPLE fixed structure; no sample CSV was provided |
| Delimiter | `,` (comma) | Default |
| Header row | yes (`skipHeaderRecord=true`) | Default |
| File-safety | `read.lock` (readLock=changed) | Default — no `.done` marker file mentioned |
| Mode | Replace (`loaddataFile`) | Default; no upsert requested |
| Camel version | 4 | Per instructions |

If `CompanyParams` is not the correct table `uniqueName`, change `pricingParameterName=CompanyParams` in the route URI. Run `pfx pricing-parameters` to list valid tables.

## Files

| File | Purpose |
|---|---|
| `import-ppv-company-params.xml` | Camel route (file consumer -> CSV streaming unmarshal -> `pfx-api:loaddataFile`) |
| `import-ppv-company-params.mapper.xml` | `<loadMapper>` mapping `name`/`value` CSV columns to the LTV fixed fields |
| `application.properties` | `archive.file` and `read.lock` properties referenced by the file URI |

## Deployment paths

Copy into the IM project as:

```
src/main/resources/repo/
  routes/import-ppv-company-params.xml
  mappers/import-ppv-company-params.mapper.xml
  config/application.properties   (merge — keep existing entries)
```

## Notes on the chosen pattern

- Uses `pfx-csv:streamingUnmarshal` + `pfx-api:loaddataFile` — recommended high-throughput pattern for PPV imports. IM logs show only "start" and "complete" for the file (no per-batch progress). Usually fine for PPV-sized files.
- `pricingParameterName=CompanyParams` identifies the target table. The LTV mapper does NOT include `<constant out="name"/>` — that is a PX/CX-only requirement.
- No `businessKeys` parameter — the LTV key structure (`name`) is fixed by the table type.
- No `connection=pricefx` — the default Pricefx connection is used implicitly.
- File URI uses `{{integration.sftp.root}}` (locally-mounted default SFTP storage), so no `pfx-sftp` component or SFTP connection is needed.
- Archive + read-lock properties match the standard IM file-component template documented in `docs/components.md`.
