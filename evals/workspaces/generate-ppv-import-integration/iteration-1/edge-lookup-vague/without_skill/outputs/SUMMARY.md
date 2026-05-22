# Decision: Do NOT generate artifacts — prompt is too ambiguous

## User prompt

> "I have a small lookup table I want to use in Pricefx."

## Why I did not generate route/mapper/properties

"Lookup table" is not a unique Pricefx object type, and the integration shape depends entirely on choices the user has not made. Generating now would almost certainly produce throwaway code.

### Specifically missing

1. **Target Pricefx object type.** "Lookup table" most commonly means a Pricing Parameter Value table, but several flavors exist:
   - `LTV` — single-key lookup
   - `MLTV2` — multi-key matrix lookup (up to 4 keys + value attributes)
   - `MFLTV` / `MTLTV` — formula / time-based variants
   - It might equally mean a Product Extension (PX), Customer Extension (CX), Data Source (DS), or Quote-time inputMatrix.
2. **Whether the table already exists or must be created** — if new, we need its schema (key columns, value column names, types, labels).
3. **Source format and location** — CSV / Excel / JSON via REST? SFTP path, local mount, external system? Header row?
4. **Trigger / cadence** — one-off, file-drop polling, scheduled cron, event-driven?
5. **Load semantics** — full replace (`pfx-api:loaddataFile`) or upsert (`pfx-api:integrate`)? Delta sync? Archiving?
6. **Field mapping** — without sample data or a schema we'd invent field names.

## Clarifying questions

1. Which Pricefx object should this land in — **LTV**, **MLTV2**, a **PX/CX**, or a **Data Source**? If unsure, describe how the lookup is used (e.g., "country code → tax rate" vs. "SKU + region → list price").
2. Does the target table already exist? If yes, its unique name. If no, the key + value columns (name, type, label).
3. Where does the data come from — CSV on SFTP, local file drop, Excel, REST API? Sample header + 2-3 rows.
4. How often should it run — on file arrival, scheduled (which cron?), or one-off?
5. Should each load **replace** or **upsert**?
6. Any env-specific paths or connection IDs (existing SFTP connection, `{{integration.sftp.root}}` mount)?

Once (1) + (3) + (5) are answered, a minimal route + mapper + properties bundle can be generated; remaining choices can use defaults from `docs/routes.md` Patterns 1 & 6 and `docs/components.md`.

## Files written

- `SUMMARY.md` (this file)

No `route.xml`, `mapper.xml`, or `application.properties` were generated, by design.
