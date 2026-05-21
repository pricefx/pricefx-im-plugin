# Clarifying Questions — Import Integration

The request "Import this data into Pricefx." is ambiguous. Before any route/mapper/properties files can be generated, the following information is needed. The questions below are what would be asked verbatim in a real session.

---

## Questions to the user

**1. What Pricefx object are you importing into?**

Please pick one of the supported target object types:

| Code | Object |
|------|--------|
| P    | Product Master |
| PX   | Product Extension |
| C    | Customer Master |
| CX   | Customer Extension |
| SL   | Seller Master |
| SX   | Seller Extension |

(If you are loading into a Pricing Parameter table — LTV/MLTV2 — I will switch to the `generate-ppv-import-integration` skill. If you are loading into a PA Data Source — DMDS — I will switch to `generate-pa-import-integration`.)

**1a. If you picked PX, CX, or SX:** which extension table?
- For PX: I will run `pfx product-extensions` to list available tables — please confirm the name, or tell me to create a new one (and provide the desired name + attribute count: one of 3, 6, 8, 10, 20, 30, 50).
- Same for CX (via `pfx customer-extensions`) and SX.

**2. What is the data source?**
- CSV file on the local file system (mounted SFTP root)
- Zipped/compressed CSV on the local file system
- External SFTP server
- Database (JDBC) — please provide dialect, host, credentials, and the SELECT query
- REST API — please provide base URL and auth type (OAuth2 / Basic / JWT / Noop)
- Other (please describe)

**3. Can you share the data?**
Please attach a sample CSV (or paste the header row and 2–3 sample data rows). This is how I will:
- Auto-detect delimiter, quote character, header presence, column count
- Auto-detect column data types (string / decimal / integer / date / datetime / boolean)
- Propose a field mapping from source columns to Pricefx fields (`sku` / `customerId` / `sellerId`, `label`, `attribute1..N`) via Smart Auto-Mapping

If you cannot share a sample, please list the source field names and which Pricefx field each should map to.

**4. Which import method?**

| Method | Best for | Observability |
|--------|----------|---------------|
| `pfx-api:loaddataFile` (streaming) | Small/medium files, simple mappings | None — single upload, no per-batch logs |
| `pfx-api:loaddata` + split/tokenize | Large files (>500k rows), long-running loads, row-level Groovy logic | Per-batch logging in IM logs |

I will not silently default — please pick one.

**5. File-safety mechanism (only if the source is CSV / zipped CSV / SFTP):**
Does the upstream system write a `.done` marker file when the data file is fully written?
- Yes → I will use `{{done.file}}` (`doneFileName=${file:name}.done`)
- No  → I will use `{{read.lock}}` (`readLock=changed`, waits for file size to stabilize)

(These are mutually exclusive — exactly one must be chosen.)

**6. Optional but nice to know:**
- A descriptive name for the route (used as both the file name and the route `id`, e.g., `import-products-from-sftp`)
- Should the route trigger any post-import action on completion (e.g., `pfx-api:internalCopy`, a CFS calculation, or a custom event)?
- Should failed files be moved to a `.error/` folder (`{{error.file}}`)? Recommended yes for production loads.

---

## What I still need before generating files

Until at least the following are answered I cannot generate the route, mapper, and properties:

1. Target object type (P / PX / C / CX / SL / SX) — and the extension table name if PX/CX/SX.
2. Data source type (file / SFTP / DB / REST).
3. Either a sample of the data (CSV header + 1–3 rows) OR an explicit list of source-field → Pricefx-field mappings.
4. Import method choice (`loaddataFile` vs `loaddata`+split).

I also need (or will derive automatically):
- Pricefx connection credentials — I will check `src/main/resources/repo/config/application.properties` and `application-local.properties` for `integration.pfx.*`; if absent I will ask for URL, partition, username, password.
- Camel version of the target project — I will read `<camel.version>` from `pom.xml` to emit Camel-3 vs Camel-4 attribute names correctly.
- Folder name for file sources — I will derive it from the target table name in kebab-case (e.g., PX `MichaluvTest` → `/michaluv-test`) and let you override.

Once questions 1–4 above are answered, I can complete the remaining steps (metadata fetch via `pfx` CLI, Smart Auto-Mapping, batch-size recommendation, self-check) and generate the route + mapper + properties.
