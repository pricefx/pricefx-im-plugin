# generate-import-integration Evaluation

## Metadata

- Skill: `pricefx-im-plugin:generate-import-integration`
- Version: 1.0.9
- Last updated: 2026-05-21
- Confusion partners: `generate-pa-import-integration` (DMDS imports), `generate-ppv-import-integration` (LTV/MLTV2 imports)

## Description under test

> Use when the user wants to load or import data INTO Pricefx for Product (P), Product Extension (PX), Customer (C), Customer Extension (CX), Seller (SL), or Seller Extension (SX) — says "import data", "load into Pricefx", "push to Pricefx", "ingest CSV", or has a CSV / SFTP / database / REST source. For PA / Data Source (DMDS) imports use `generate-pa-import-integration` instead. For Pricing Parameters (LTV/MLTV2) use `generate-ppv-import-integration`.

## Positive Cases

### Case 1: P (Product) master from CSV via SFTP

**Prompt**: `I have a CSV file products.csv in /import folder with columns sku, name, price, uom. Need to load this into Pricefx as Product master via SFTP daily.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Asks for / detects: object type = P, business key = sku
- [ ] Output includes: route XML with `pfx-api:loaddataFile?objectType=P`, mapper, properties for SFTP polling
- [ ] No DMDS / LTV / MLTV2 patterns appear in the generated route

### Case 2: PX (Product Extension) hourly load

**Prompt**: `Set me up an import that reads PX Prices table data from /home/im/inbound/prices/ and loads into Pricefx with proper field mapping. Schedule: every hour.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Recognises PX → adds `<constant expression="Prices" out="name"/>` to mapper
- [ ] Quartz cron at hourly cadence
- [ ] Business key = sku (P/PX convention)

### Case 3: C (Customer) master from SFTP

**Prompt**: `Customer master file lands at SFTP /upload/customer-master.csv every morning at 6am. Push it into Pricefx C objectType, business key is customerId.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Uses `businessKeys=customerId` (correct C key field)
- [ ] Quartz cron at 6 AM
- [ ] No PA / LTV pattern leaks in

### Case 4: SL (Seller) master from REST API

**Prompt**: `Build me an import that fetches seller master from REST API endpoint https://erp.internal/api/sellers and loads into Pricefx SL master, runs every 4 hours.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Uses `businessKeys=sellerId` (SL convention)
- [ ] `pfx-rest:get` fetch step + `pfx-json:unmarshal` + `pfx-api:loaddata`
- [ ] Schedule = every 4 hours

### Case 5: PX with field-rename mapping

**Prompt**: `Got a new CSV with product extensions for Pricing table. Three columns: partNumber, listPrice, costCenter. Map partNumber to sku and load via loaddataFile.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Mapper: `partNumber → sku`, `listPrice → attribute*`, `costCenter → attribute*`
- [ ] Uses `loaddataFile` (not `loaddata` for split+tokenize)
- [ ] `<constant expression="Pricing" out="name"/>` for PX

## Negative Cases

### Case 1: LTV pricing parameter (should pick `generate-ppv-import-integration`)

**Prompt**: `I need to load LTV exchange rates from a CSV — single column key value pairs USD/EUR conversions. Target Pricefx Pricing Parameter table called ExchangeRates.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-ppv-import-integration` is selected instead

### Case 2: DMDS / PA Data Source (should pick `generate-pa-import-integration`)

**Prompt**: `We get a transactional file (about 5M rows) every night at 2am that needs to go into DMDS SalesHistory data source. Path /sftp/transactions/YYYYMMDD.csv`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-pa-import-integration` is selected (DMDS requires the split+tokenize+loaddata+flush pattern, which is different)

### Case 3: MLTV2 matrix lookup (should pick `generate-ppv-import-integration`)

**Prompt**: `Need to import a discount matrix into MLTV2 — multi-key lookup with customer x product x quantity tier dimensions. Target table DiscountMatrix.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-ppv-import-integration` is selected

## Edge Cases

### Case 1: Ambiguous — type not specified

**Prompt**: `Import this data into Pricefx.`

**Expected behavior**:
- [ ] Claude asks a clarifying question: what object type (P/PX/C/CX/DMDS/LTV/MLTV2)?
- [ ] Does NOT pick a skill blindly

### Case 2: Generic CSV → Pricefx wording

**Prompt**: `I have a CSV in /tmp/data.csv that needs to go into Pricefx. Daily.`

**Expected behavior**:
- [ ] Skill MAY trigger (CSV import into Pricefx is its primary use case)
- [ ] AND/OR Claude asks for object type before committing — both are acceptable
