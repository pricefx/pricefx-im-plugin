# Summary — Edge Case: Vague Source

## Decision: Did NOT generate any route, mapper, or properties files.

## Why

The user prompt — *"I need to load data from a source into Pricefx."* — is too vague to safely select a generation skill or pattern. The `generate-pa-import-integration` skill is scoped to **PA (Price Analyser) Data Source (DMDS) imports** only, and its `description:` field requires the user to mention one of: "PA Data Source", "DMDS", "DS", "Price Analyser data loading", "sales history", or "transaction load". None of these triggers appear in the prompt.

Silently generating a DMDS `split+tokenize+loaddata+flush` route would be wrong because:

1. **Target object type is unknown.** P / PX / C / CX, LTV / MLTV2, DMDS, CRCP, and other types each have a different generation skill, different pattern, and different mapper requirements.
2. **Source system is unknown.** "A source" could be local file, SFTP, JDBC, REST API, S3, or an event bus — each requires different `from`/`to` components and different connection JSON.
3. **CSV format / fields are unknown.** No header, no field names, no business keys, no batch-size hint.
4. **Direction is unknown.** "Load into Pricefx" reads as inbound, but periodic sync vs. delta sync vs. one-shot bulk load each map to different skills.

Per the skill's `description` trigger rules (and `evals/triggers.md`), when the prompt does not match the skill's trigger keywords, the correct behavior is to **ask the user to clarify** rather than emit a guessed route.

## Clarifying questions I would ask the user

1. **What is the target object in Pricefx?**
   - Product Master (P) or Product Extension (PX)?
   - Customer Master (C) or Customer Extension (CX)?
   - Pricing Parameter — single-key lookup table (LTV) or multi-key matrix (MLTV2)?
   - **PA Data Source (DMDS)** — for sales history, transactions, or other analytical data?
   - Condition Records (CRCP)?
   - Something else (Quote, Agreement, Rebate, etc.)?

2. **Where is the source data?**
   - Local file system (CSV file dropped in an IM-mounted folder)?
   - External SFTP server?
   - REST API (which system — Salesforce, custom API, etc.)?
   - JDBC database?
   - AWS S3?
   - Pricefx event bus (reactive)?

3. **What is the file format (if file-based)?**
   - CSV — with header row? what delimiter (`,`, `;`, `\t`, `|`)?
   - Excel (`.xlsx`)?
   - JSON?
   - XML?
   - Zipped/compressed?

4. **How often should the load run?**
   - On file arrival (file poller)?
   - On a cron schedule (e.g., daily at 06:00)?
   - On a Pricefx event (e.g., after another import completes)?
   - One-shot / manual trigger?

5. **Do you have a sample of the source data and/or a target table name?** Even a CSV header plus the target DS/PX/CX name is enough to auto-propose the field mapping via Smart Auto-Mapping.

## What to do next

Once the user answers Q1, the correct skill becomes clear:

| Answer to Q1 | Skill to delegate to |
|---|---|
| P / PX / C / CX | `generate-import-integration` |
| LTV / MLTV2 | `generate-ppv-import-integration` |
| DMDS (PA Data Source) | `generate-pa-import-integration` (this skill) |
| CRCP | condition-records generation skill (if available) |
| Pricefx event-driven | `generate-event-driven-route` |
| Outbound / export | `generate-export-integration` |

No files were written to the project. Output directory contains only this `SUMMARY.md`.
