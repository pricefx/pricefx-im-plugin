# generate-pa-import-integration Evaluation

## Metadata

- Skill: `pricefx-im-plugin:generate-pa-import-integration`
- Version: 1.0.9
- Last updated: 2026-05-21
- Confusion partners: `generate-import-integration` (P/PX/C/CX), `generate-ppv-import-integration` (LTV/MLTV2)

## Description under test

> Use when the user wants to import data into a Pricefx PA (Price Analyser) Data Source — mentions "PA Data Source", "DMDS", "DS", "Price Analyser data loading", "sales history", or "transaction load". DMDS imports legitimately need the split+tokenize+loaddata+flush pattern, which is different from standard imports. For P/PX/C/CX use `generate-import-integration`; for LTV/MLTV2 use `generate-ppv-import-integration`.

## Positive Cases

### Case 1: Large transactional file to DMDS

**Prompt**: `Sales transaction file (10M rows per day) needs to land in our PA Data Source SalesHistoryDS. Tab-separated, lots of columns. Comes in at /sftp/transactions/.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Generates: split with `streaming="true"` + tokenize + `pfx-api:loaddata?objectType=DMDS`
- [ ] Has `pfx-api:flush` AFTER `</split>` (not inside)
- [ ] No `loaddataFile` usage

### Case 2: S3 source → DMDS

**Prompt**: `Set up DMDS load for our daily transactions feed coming from S3 bucket s3://pricefx-data/transactions/. Target DMDS.TransactionFeed, batch size 100k.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] S3 consumer + DMDS load pattern
- [ ] Tokenize group = 100000
- [ ] Flush after split

### Case 3: Invoice line items

**Prompt**: `Build me a PA Data Source import for line-item invoice data from /im/inbound/invoices/. Needs flush after load completes. Schedule daily at 3am.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Quartz cron @ 3am
- [ ] split+tokenize+loaddata+flush pattern present

### Case 4: Generic "Price Analyser data feed"

**Prompt**: `Daily Price Analyser data feed — CSV at /sftp/transactions/YYYYMMDD.csv. Target is DMDS.TransactionFeed. ~5M rows.`

**Expected behavior**:
- [ ] Skill triggers on "Price Analyser" + "DMDS" keywords
- [ ] DMDS pattern, not standard import

## Negative Cases

### Case 1: P (Product) master (should pick `generate-import-integration`)

**Prompt**: `Import product master from /import/products.csv into Pricefx P table with sku as business key.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-import-integration` is selected (P uses standard `loaddataFile` pattern, not DMDS split+flush)

### Case 2: LTV pricing parameter (should pick `generate-ppv-import-integration`)

**Prompt**: `Load LTV currency rates from CSV into Pricefx pricing parameter table.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-ppv-import-integration` is selected

## Edge Cases

### Case 1: "Data source" but not Pricefx-specific

**Prompt**: `I need to load data from a source into Pricefx.`

**Expected behavior**:
- [ ] Skill does NOT trigger on this alone — too vague
- [ ] Claude asks for object type (P / PX / DMDS / LTV)
