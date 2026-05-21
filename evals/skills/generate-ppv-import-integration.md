# generate-ppv-import-integration Evaluation

## Metadata

- Skill: `pricefx-im-plugin:generate-ppv-import-integration`
- Version: 1.0.9
- Last updated: 2026-05-21
- Confusion partners: `generate-import-integration`, `generate-pa-import-integration`

## Description under test

> Use when the user wants to import Pricefx Pricing Parameters / Company Parameters into LTV (single-key lookup) or MLTV2 (multi-key matrix) tables — mentions "pricing parameters", "company parameters", "lookup tables", "exchange rates", "discount matrices", or any key/value configuration data. For P/PX/C/CX use `generate-import-integration`; for PA/DMDS use `generate-pa-import-integration`.

## Positive Cases

### Case 1: Exchange rates → LTV

**Prompt**: `Set up daily exchange rates load from ECB. CSV has columns currencyCode, rate. Target: LTV table called ExchangeRates.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] `pfx-api:loaddata?objectType=LTV&pricingParameterName=ExchangeRates`
- [ ] Single-key mapper: `name` + `value`
- [ ] Quartz cron daily

### Case 2: Discount matrix → MLTV2

**Prompt**: `Build MLTV2 import for discount matrix — customer category x product family x quantity tier returns a discount %. 50k rows. Source CSV at /import/discount-matrix.csv`

**Expected behavior**:
- [ ] Skill triggers
- [ ] `objectType=MLTV2`
- [ ] Multi-key mapper: key1 / key2 / key3 / value or attribute1

### Case 3: Company parameter values

**Prompt**: `Need to load company parameter values from /im/inbound/params.csv into Pricefx. Pricing Parameter type LTV.`

**Expected behavior**:
- [ ] Skill triggers on "company parameter" + "Pricing Parameter LTV"
- [ ] LTV pattern

### Case 4: Shipping cost lookup

**Prompt**: `Build LTV import for shipping cost lookup — single key country code, value is decimal cost in EUR. Daily from SFTP.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Single-key LTV pattern
- [ ] Decimal converter on value field

### Case 5: Generic lookup table

**Prompt**: `Import a 200-row lookup table from CSV that maps department codes to cost centers. Needs to be a Pricefx Pricing Parameter (single-key).`

**Expected behavior**:
- [ ] Skill triggers on "lookup table" + "Pricing Parameter (single-key)"
- [ ] LTV not MLTV2 (single-key)

## Negative Cases

### Case 1: Product master (should pick `generate-import-integration`)

**Prompt**: `Load product master from /import/products.csv into Pricefx P table, business key sku.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-import-integration` is selected

### Case 2: Transactional DMDS (should pick `generate-pa-import-integration`)

**Prompt**: `Daily transactional feed (5M rows) needs to land in DMDS SalesHistoryDS for Price Analyser.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-pa-import-integration` is selected

## Edge Cases

### Case 1: "Lookup table" without LTV context

**Prompt**: `I have a small lookup table I want to use in Pricefx.`

**Expected behavior**:
- [ ] Claude asks: is this a Pricing Parameter (LTV/MLTV2), or a regular extension table (PX/CX), or a Data Source (DMDS)?
- [ ] Does NOT pick this skill blindly without confirming
