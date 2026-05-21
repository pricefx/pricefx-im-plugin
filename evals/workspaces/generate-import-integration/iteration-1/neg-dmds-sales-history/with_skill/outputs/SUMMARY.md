# Skill Selection — Negative Case

## User Request

> "We get a transactional file (about 5M rows) every night at 2am that needs to go into DMDS SalesHistory data source. Path /sftp/transactions/YYYYMMDD.csv"

## Decision: WRONG SKILL — do not generate files

The skill `generate-import-integration` is NOT the right fit for this request. No route, mapper, filter, or properties files were generated.

## Correct Skill

Use **`generate-pa-import-integration`** instead.

## Reasoning

The `generate-import-integration/SKILL.md` is explicit on multiple points that all rule this case out:

1. **Front-matter description (line 3):**
   "...For PA / Data Source (DMDS) imports use `generate-pa-import-integration` instead."

2. **Supported object types (line 10):**
   "Supported object types: P (Product), PX (Product Extension), C (Customer), CX (Customer Extension), SL (Seller), SX (Seller Extension)."
   DMDS is NOT on this list.

3. **Step 5, Import Method (line 190):**
   "IMPORTANT: This step applies ONLY to P, PX, CX, C, SL, SX imports. For DS/DMDS (PA Data Sources), ALWAYS use the `generate-pa-import-integration` skill which uses the split+tokenize+loaddata+flush pattern. NEVER offer `loaddataFile` for DS/DMDS."

The user's target is a DMDS (Data Feed Data Source) — specifically `DMDS.SalesHistory` — which is a PA (Pricing Analytics) data-source load. PA loads require the `split + tokenize + loaddata + flush` pattern (not `loaddataFile`), plus PA-specific concerns (data feed name, flush call, internalCopy/calculate triggers) that this skill does not handle.

## Request Characteristics (handover to the correct skill)

When `generate-pa-import-integration` is invoked, these are the relevant inputs from the user request:

- Target: DMDS data source `SalesHistory`
- Volume: ~5 million rows per file (large — definitely needs batched loaddata + flush, not loaddataFile)
- Source: file path `/sftp/transactions/YYYYMMDD.csv` (date-stamped daily file). Likely accessible via the `file:` component using `{{integration.sftp.root}}/transactions/...` rather than `pfx-sftp` (since the path looks like the IM pod's mounted SFTP storage — confirm with the user).
- Schedule: Nightly at 02:00 — Quartz cron `0+0+2+*+*+?` on either the route or as the file-poller scheduler.
- File naming pattern: `YYYYMMDD.csv`.

## Next Step

Invoke `generate-pa-import-integration` with the same user request. Do not retry with this skill.
