# With-skill summary — edge-generic-csv-daily

(Recovered from response — harness blocked .md write.)

**Decision:** No artefacts generated. Skill's Step 2 explicitly requires asking for the target Pricefx object type and does NOT authorize a silent default. The prompt names "Pricefx" but no object type, references `/tmp/data.csv` (not present), and omits source folder, schedule details, and import method.

**Clarifying questions the skill would ask:**

1. **Target object type** — P / PX / C / CX / SL / SX (or redirect to generate-pa-import-integration / generate-ppv-import-integration).
2. **CSV content** — `/tmp/data.csv` not accessible; need header + sample rows so Smart Auto-Mapping can run.
3. **Runtime source location** — `/tmp/data.csv` is dev-machine path; IM does not poll `/tmp`. IM SFTP storage / external SFTP / mounted directory?
4. **File-arrival signal** — `readLock=changed` (default) vs `doneFileName=${file:name}.done`.
5. **Daily schedule** — continuous file polling (recommended) vs Quartz cron at fixed time + timezone.
6. **Import method** — `loaddataFile` + streaming (fast) vs `loaddata` + split (per-batch progress, slower). Skill forbids silent default here.
7. **Post-import action** — `pfx-api:internalCopy?label=...` callback yes/no.
8. **Error handling** — move failed files to `.error/...`?
9. **Credentials** — present in `application.properties`?

**Key finding:** The skill's ambiguity handling is well-specified. Step 2 is explicit about asking. The import-method choice (Step 5) is also explicit. No silent defaults are mandated.
