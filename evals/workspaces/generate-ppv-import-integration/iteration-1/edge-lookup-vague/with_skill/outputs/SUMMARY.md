# Edge Case: Vague "Lookup Table" Prompt

## User Prompt

> I have a small lookup table I want to use in Pricefx.

## Why the prompt is too ambiguous to safely generate

The word "lookup table" is overloaded inside Pricefx and maps to at least **three distinct object families**, each with a completely different route, mapper, URI parameter set, and target skill. Silently picking one (e.g. defaulting to a Pricing Parameter just because the `generate-ppv-import-integration` skill description happens to mention "lookup tables") would generate code that is wrong for the other two cases — wrong `objectType`, wrong URI parameters, wrong mapper shape, and possibly the wrong skill entirely.

The prompt does not tell us:

1. **Which Pricefx object family** the table is — Pricing Parameter (LTV/MLTV2), Extension table (PX/CX), or Data Source / Data Mart (DMDS).
2. **How the table is keyed** — single key vs. multi-key (matrix) vs. business-key-on-Product/Customer vs. arbitrary DS columns.
3. **What "small" means here** — "small" rules nothing in or out; LTV/MLTV2, PX/CX and DMDS can all be small.
4. **Whether the table already exists** in the partition, or needs to be created.
5. **Whether the user wants to import data into it, export from it, query it from a Groovy element**, or just "use" it (read it from a PA / PL / formula).
6. **Source of the data** — CSV file, SFTP, REST, manual upload — and whether this is one-off or recurring.
7. **Load semantics** — replace-all (`loaddata`) vs. upsert (`integrate`).

Until the object family is pinned down, the route XML, mapper XML, and properties cannot be generated without guessing. Generating speculatively would either produce a misleading "looks correct" artifact or force the user to throw the output away.

## Clarifying questions I would ask

I would ask these in order, stopping as soon as the branch is clear.

### Q1 — Which kind of "lookup table" is this in Pricefx?

> Pricefx has three different things that customers casually call a "lookup table." Which one do you mean?
>
> **A. Pricing Parameter (a.k.a. Company Parameter / PPV)** — a dedicated key->value table managed under **Configuration -> Pricing Parameters**. Examples: exchange rates, discount codes, tiered discounts, multi-dimensional price matrices. Object types: `LTV` (single-key SIMPLE/RANGE) or `MLTV2..MLTV5` (1-to-5 key MATRIX). Best for small/medium reference data referenced by formulas, PA logic, or PL/CFS calculations.
>
> **B. Product or Customer Extension (PX / CX)** — extra columns hung off the Product Master or Customer Master, keyed by `sku` (PX) or `customerId` (CX), plus a `name` discriminator for the extension table. Best when the data is per-product / per-customer attributes (e.g. "alternate price per SKU", "segment per customer").
>
> **C. Data Source / Data Mart Data Source (DS / DMDS)** — a flexible SQL-style table with arbitrary columns and types, queryable from formulas via `api.findLookupTableValues(...)` or joined into a Data Mart. Best when the table has its own schema, multiple non-key columns, or large row counts (10k+).

### Q2 — Follow-ups, depending on the answer to Q1

**If A (Pricing Parameter):**
- What is the table called in Pricefx (or do we need to create it)?
- What is the table type — SIMPLE (key->value), RANGE (key + lower/upper bound -> value), or MATRIX/MATRIX2..MATRIX5 (1-5 keys -> attribute1..N)?
- What is the value type — `REAL`, `STRING`, `INTEGER`, `DATE`, `DATETIME`, `BOOLEAN`?

**If B (PX / CX):**
- Which one — Product Extension (PX, keyed by `sku`) or Customer Extension (CX, keyed by `customerId`)?
- Which extension table name (the `name` field's constant value)?
- Does the table already exist with the right `attribute1..N` labels/types, or do we need to create it via `pfx create-product-extension` / `pfx create-customer-extension` and `pfx set-attributes` first?

**If C (DS / DMDS):**
- Which Data Source name (DMDS.*)?
- Is there an existing Data Feed (DMF) that this DS belongs to? Will we need `pfx-api:flush` after load?
- What is the table schema — column names and types?

### Q3 — Common questions (asked in any branch once Q1 is answered)

- Where will the source data come from — local file (CSV / zipped CSV), SFTP, REST API, Salesforce, SQL?
- Replace-all on each run (`loaddata` / full refresh) or upsert (`integrate`)?
- Does the source produce a `.done` marker file, or should the route wait on file-size-stabilizes (`readLock=changed`)?
- Schedule — file-poll, cron, or event-driven?
- Sample CSV (header row + a few data rows) — so the field mapping and converter expressions can be inferred (Smart Auto-Mapping).

## Which skill handles each branch

| Branch | Object family | Skill to invoke |
|---|---|---|
| **A. Pricing Parameter** | `LTV`, `MLTV2`, `MLTV3`, `MLTV4`, `MLTV5` | `pricefx-im-plugin:generate-ppv-import-integration` (this skill) |
| **B. Product / Customer Extension** | `PX`, `CX` (also `P`, `C`) | `pricefx-im-plugin:generate-import-integration` |
| **C. Data Source / Data Mart DS** | `DS`, `DMDS` (with optional `DMF` flush) | `pricefx-im-plugin:generate-pa-import-integration` |

Quick reference of how each branch's route differs at a glance:

| | A — PPV | B — PX/CX | C — DMDS |
|---|---|---|---|
| Camel URI fragment | `pfx-api:loaddataFile?objectType=LTV&pricingParameterName=...` | `pfx-api:loaddataFile?objectType=PX&mapper=...` | `pfx-api:loaddataFile?objectType=DMDS&dsUniqueName=DMDS....` |
| Mapper key fields | `name` / `key1..keyN` | `sku` (PX) or `customerId` (CX) + `<constant out="name">` | DS-defined columns |
| Needs `<constant out="name"/>` | No | Yes (table discriminator) | No |
| Needs `businessKeys` | No (defined by table type) | Optional (auto-detected from `sku`/`customerId`) | Usually no |
| Often followed by | (nothing) | `pfx-api:internalCopy?label=...` | `pfx-api:flush?dataSourceName=...&dataFeedName=...` |

## Decision

No route XML, no mapper XML, no `application.properties` snippet is being produced for this prompt. The correct next step is to send the clarifying questions above to the user and route the request to whichever of the three skills (`generate-ppv-import-integration`, `generate-import-integration`, `generate-pa-import-integration`) matches the user's answer to Q1.
