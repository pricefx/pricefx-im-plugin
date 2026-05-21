# Baseline (no skill) summary — edge-generic-csv-daily

(Recovered from response — harness blocked .md write and the baseline agent did not generate any files.)

**Action taken:** None on disk. The baseline chose to ask for clarification rather than guess (because `loaddata`/`loaddataFile` REPLACES data and a wrong-object-type guess is destructive).

**Blocking questions identified:**

1. Target object type — P / C / PX / CX / LTV / MLTV2 / DMDS / CRCP / etc.
2. Field mapping (no header was supplied).
3. Business key (`sku` for P/PX, `customerId` for C/CX, etc.).

**Other gaps:**

- Real file location at runtime (`/tmp/data.csv` is presumably a test path).
- Schedule details (time + timezone).
- Arrival signal (`.done` marker vs `readLock=changed`).
- Replace vs upsert semantics.
- Delimiter, encoding, type conversions, `maxLength`, `onCompletion` callback.

The baseline outlines the skeleton it would emit once unblocked: provisioned-IM route + mapper + properties + Camel 4 syntax + default `pricefx` connection.
