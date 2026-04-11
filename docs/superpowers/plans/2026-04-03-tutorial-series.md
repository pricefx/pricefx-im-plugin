# Tutorial Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 6 markdown files (1 intro + 5 tutorials) in `docs/tutorials/` that teach Pricefx partners how to build IM integrations step by step.

**Architecture:** Pure documentation — no code to compile or test. Each file is a standalone markdown tutorial with inline XML/CSV code blocks. All tutorials share the Acme Industrial fictional context.

**Tech Stack:** Markdown, Pricefx IM XML (routes, mappers, filters), CSV samples, application.properties

---

## File Structure

All files created in `docs/tutorials/`:

| File | Purpose |
|------|---------|
| `00-acme-industrial.md` | Shared fictional company context (~60 lines) |
| `01-csv-import-products.md` | CSV → Product Master (P) tutorial (~400 lines) |
| `02-csv-import-product-extension.md` | CSV → Product Extension (PX) tutorial (~400 lines) |
| `03-import-pricing-parameters.md` | CSV → Lookup Table (LTV) tutorial (~350 lines) |
| `04-import-pa-data-source.md` | CSV → DMDS with split/tokenize/flush (~450 lines) |
| `05-export-products-csv.md` | Scheduled export with delta sync (~450 lines) |

---

### Task 1: Create the tutorials directory and Acme Industrial intro

**Files:**
- Create: `docs/tutorials/00-acme-industrial.md`

- [ ] **Step 1: Create `docs/tutorials/00-acme-industrial.md`**

```markdown
# Meet Acme Industrial

This tutorial series follows **Acme Industrial**, a fictional manufacturer of industrial components — pumps, valves, and filters. Acme sells through 200 distributors and directly to 3,000 customers across North America and Europe.

## Acme's Systems

| System | Role | Integration with Pricefx |
|--------|------|--------------------------|
| **SAP ERP** | Source of truth for products, transactions, and pricing parameters | Daily CSV exports land on IM's file system |
| **Salesforce CRM** | Customer master, opportunities, contracts | REST API (future tutorials) |
| **Pricefx** | Pricing engine — price lists, analytics, approvals | Receives data from SAP and Salesforce via IM |

## What Acme Needs from Integration Manager

Acme's pricing team needs fresh data in Pricefx every day:

1. **Product catalog** — 15,000 SKUs with descriptions, UoM, and product families from SAP
2. **Price data** — list prices, cost prices, and discount tiers stored in a Product Extension table
3. **Exchange rates** — daily currency rates loaded as a Pricing Parameter (lookup table)
4. **Transaction history** — 2 years of sales transactions for Price Analyser dashboards
5. **Outbound exports** — nightly export of updated products to a shared folder for downstream systems

Each tutorial in this series builds one of these integrations from scratch.

## Shared Conventions

All tutorials assume you have a working IM project with this structure:

```text
src/main/resources/
├── application.properties
├── camel-context.xml
└── repo/
    ├── routes/
    ├── mappers/
    ├── filters/
    └── config/
```

And these common properties in `application.properties`:

```properties
integration.name=acme-integration

# File archiving (moves processed files to timestamped archive)
archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D

# Read lock (waits until file size stabilizes before processing)
read.lock=readLock=changed

# Move failed files to error folder
error.file=moveFailed=.error/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd-HHmmss%7D.%24%7Bfile:ext%7D
```

## Tutorials

| # | Tutorial | What You'll Build |
|---|----------|-------------------|
| 1 | [Import Products from CSV](01-csv-import-products.md) | CSV file → Product Master (P) |
| 2 | [Import Product Extension Data](02-csv-import-product-extension.md) | CSV file → Product Extension (PX) |
| 3 | [Import Pricing Parameters](03-import-pricing-parameters.md) | CSV file → Lookup Table (LTV) |
| 4 | [Import Data into PA Data Source](04-import-pa-data-source.md) | CSV file → DMDS table |
| 5 | [Export Products to CSV](05-export-products-csv.md) | Scheduled export from Pricefx → CSV file |
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/00-acme-industrial.md
git commit -m "docs: add Acme Industrial tutorial series intro"
```

---

### Task 2: Tutorial 01 — Import Products from CSV

**Files:**
- Create: `docs/tutorials/01-csv-import-products.md`

- [ ] **Step 1: Create `docs/tutorials/01-csv-import-products.md`**

```markdown
# Tutorial 1: Import Products from CSV

## What We'll Build

Acme's SAP system exports a daily CSV file containing the full product catalog — 15,000 SKUs with part numbers, descriptions, units of measure, and product families. We'll build an IM route that picks up this file and loads it into the Pricefx Product Master (P).

## Prerequisites

- A working IM project (see [Acme Industrial intro](00-acme-industrial.md) for the expected structure)
- Access to a Pricefx partition
- The `archive.file` and `read.lock` properties configured in `application.properties`

## Step by Step

### Step 1: Prepare the sample CSV

Save this as `products.csv` in your IM's inbound directory (e.g., `/var/pricefx/data/import/products/`):

```csv
partNumber,description,uom,productFamily,status,listPrice
PUMP-001,Centrifugal Pump 2HP,EA,Pumps,Active,1250.00
PUMP-002,Centrifugal Pump 5HP,EA,Pumps,Active,2340.50
VALVE-001,Ball Valve 2in,EA,Valves,Active,89.99
VALVE-002,Gate Valve 4in,EA,Valves,Active,145.00
FILTER-001,Hydraulic Filter 10um,EA,Filters,Active,34.50
FILTER-002,Hydraulic Filter 25um,EA,Filters,Active,28.75
PUMP-003,Submersible Pump 3HP,EA,Pumps,Discontinued,1875.00
VALVE-003,Check Valve 1in,EA,Valves,Active,62.00
FILTER-003,Air Filter Panel,EA,Filters,Active,19.99
PUMP-004,Booster Pump 1HP,EA,Pumps,Active,890.00
```

The file has a header row and uses comma as delimiter — the most common format.

### Step 2: Create the mapper

Create the file `mappers/import-products.mapper.xml`:

```xml
<mappers>
    <loadMapper id="import-products.mapper">
        <body in="partNumber" out="sku"/>
        <body in="description" out="label"/>
        <body in="uom" out="attribute1"/>
        <body in="productFamily" out="attribute2"/>
        <body in="status" out="attribute3"/>
        <body in="listPrice" out="attribute4" converterExpression="stringToDecimal"/>
    </loadMapper>
</mappers>
```

Key points:
- The `id` **must** match the file name (without `.xml`): `import-products.mapper`
- `in` is the CSV column name, `out` is the Pricefx field name
- `sku` and `label` are built-in Product fields; `attribute1`–`attribute30` are custom attributes
- `stringToDecimal` converts the price string `"1250.00"` to a BigDecimal number

### Step 3: Create the route

Create the file `routes/import-products.xml`:

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="import-products">
        <from uri="file://{{integration.sftp.root}}/import/products?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
        <log message="Processing product file: ${header.CamelFileName}" loggingLevel="INFO"/>
        <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>
        <to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;batchSize=500000"/>
        <log message="Product import complete. Records: ${header.PfxTotalInputRecordsCount}" loggingLevel="INFO"/>
    </route>
</routes>
```

Let's break this down:

1. **`file://...`** — Polls the directory every 10 seconds for new CSV files. `{{archive.file}}` moves processed files to a timestamped archive. `{{read.lock}}` waits until the file stops growing before processing.
2. **`pfx-csv:streamingUnmarshal`** — Parses the CSV without loading the entire file into memory. `skipHeaderRecord=true` skips the first row (column names). `useReusableParser=true` is required when using `loaddataFile`.
3. **`pfx-api:loaddataFile`** — Streams the parsed data directly to the Pricefx server. `objectType=P` targets the Product Master. `mapper=import-products.mapper` references the mapper we created. `batchSize=500000` sends up to 500K rows per batch (appropriate for files with few columns).

> **Why `loaddataFile` instead of `loaddata`?** `loaddataFile` streams the file directly to the server and is much faster for CSV imports. Use `loaddata` only when you need Groovy-level row transformations.

### Step 4: Add route properties

Add these lines to `application.properties`:

### Step 5: Register the route

If your project uses `camel-context.xml` with explicit imports, add:

```xml
<import resource="refs/routes/import-products.xml"/>
```

And in the `<camelContext>` section, add:

```xml
<routeContextRef ref="import-products"/>
```

> **Note:** In provisioned IM projects (where routes live under `repo/routes/`), routes are auto-discovered — you can skip this step.

## How It Works

When a CSV file appears in the import directory:

```text
products.csv dropped into /import/products/
    │
    ▼
File consumer picks up file (waits for read lock)
    │
    ▼
pfx-csv:streamingUnmarshal parses CSV row by row
    │
    ▼
pfx-api:loaddataFile streams rows to Pricefx server
    ├── Maps partNumber → sku, description → label, etc.
    ├── Converts listPrice string to BigDecimal
    └── Sends in batches of up to 500,000 rows
    │
    ▼
File moved to .archive/2026/04/products__20260403_060000.csv
```

The Pricefx server receives the data as a bulk load — existing products with the same `sku` are replaced, new products are created.

## Testing

1. Drop `products.csv` into the import directory
2. Watch the IM logs for:
   ```
   Processing product file: products.csv
   Product import complete. Records: 10
   ```
3. Verify in Pricefx UI: go to **Master Data → Products** and search for `PUMP-001`
4. Or use pfx CLI:
   ```bash
   pfx fetch-sample P --limit 5
   ```

## Common Mistakes

**1. Mapper ID doesn't match file name**
If the file is `import-products.mapper.xml` but the ID inside is `productMapper`, IM can't find it. Always keep them in sync: file name `import-products.mapper.xml` → `id="import-products.mapper"`.

**2. Forgot `skipHeaderRecord=true`**
Without this, the header row (`partNumber,description,...`) is treated as data. Your first "product" will have SKU `partNumber`.

**3. Using `noop=true` on the file consumer**
`noop=true` means the file is never moved or deleted — IM will re-process it on every poll cycle. Always use `{{archive.file}}` to move processed files to an archive.

## What's Next

In [Tutorial 2: Import Product Extension Data](02-csv-import-product-extension.md), we'll load price tiers into a Product Extension (PX) table — same pattern, but with a key difference in how we tell Pricefx which extension table to target.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/01-csv-import-products.md
git commit -m "docs: add tutorial 01 - CSV import products"
```

---

### Task 3: Tutorial 02 — Import Product Extension Data

**Files:**
- Create: `docs/tutorials/02-csv-import-product-extension.md`

- [ ] **Step 1: Create `docs/tutorials/02-csv-import-product-extension.md`**

```markdown
# Tutorial 2: Import Product Extension Data

## What We'll Build

Acme stores list prices, cost prices, and discount tiers in a Pricefx Product Extension (PX) table called `Prices`. SAP exports this data daily as a CSV. We'll build a route that loads it into the PX table — building on the Product import pattern from Tutorial 1, with one critical addition: telling Pricefx *which* extension table to use.

## Prerequisites

- A working IM project with `archive.file` and `read.lock` properties configured
- A Product Extension table named `Prices` in your Pricefx partition (create it in the UI or via `pfx create-product-extension Prices`)

## Step by Step

### Step 1: Prepare the sample CSV

Save as `prices.csv`:

```csv
sku,listPrice,costPrice,discountTier,currency,effectiveDate
PUMP-001,1250.00,625.00,A,USD,2026-01-01
PUMP-002,2340.50,1170.25,A,USD,2026-01-01
VALVE-001,89.99,36.00,B,USD,2026-01-01
VALVE-002,145.00,58.00,B,USD,2026-01-01
FILTER-001,34.50,13.80,C,USD,2026-01-01
FILTER-002,28.75,11.50,C,USD,2026-01-01
PUMP-003,1875.00,937.50,A,EUR,2026-01-01
VALVE-003,62.00,24.80,B,USD,2026-01-01
FILTER-003,19.99,8.00,C,USD,2026-01-01
PUMP-004,890.00,445.00,B,USD,2026-01-01
```

### Step 2: Create the mapper

Create `mappers/import-prices.mapper.xml`:

```xml
<mappers>
    <loadMapper id="import-prices.mapper">
        <constant expression="Prices" out="name"/>
        <body in="sku" out="sku"/>
        <body in="listPrice" out="attribute1" converterExpression="stringToDecimal"/>
        <body in="costPrice" out="attribute2" converterExpression="stringToDecimal"/>
        <body in="discountTier" out="attribute3"/>
        <body in="currency" out="attribute4"/>
        <body in="effectiveDate" out="attribute5"/>
    </loadMapper>
</mappers>
```

The critical line is:

```xml
<constant expression="Prices" out="name"/>
```

This tells Pricefx which Product Extension table to load into. Without it, the import will fail or write to the wrong table. The value `Prices` must match the exact name of your PX table.

> **This is the key difference from Product (P) imports.** Products don't need a `name` constant because there's only one Product Master table. Extension tables (PX, CX, SX) can have many, so you must specify which one.

### Step 3: Create the route

Create `routes/import-prices.xml`:

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="import-prices">
        <from uri="file://{{integration.sftp.root}}/import/prices?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
        <log message="Processing price file: ${header.CamelFileName}" loggingLevel="INFO"/>
        <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>
        <to uri="pfx-api:loaddataFile?objectType=PX&amp;mapper=import-prices.mapper&amp;batchSize=200000"/>
        <log message="Price import complete. Records: ${header.PfxTotalInputRecordsCount}" loggingLevel="INFO"/>
    </route>
</routes>
```

Differences from the Product import:
- **`objectType=PX`** instead of `P` — targets Product Extension
- **`batchSize=200000`** — lower than the Product import because each row has more fields (6 mapped columns). With 10–20 fields, 100K–200K is a good batch size.
- **No `businessKeys` parameter** — for PX, the business key is always `sku` and is handled automatically

### Step 4: Add route properties

In `application.properties`:

## How It Works

The flow is identical to the Product import:

```text
prices.csv dropped into /import/prices/
    │
    ▼
File consumer picks up file
    │
    ▼
pfx-csv:streamingUnmarshal parses CSV
    │
    ▼
pfx-api:loaddataFile streams to Pricefx
    ├── Reads constant: name=Prices → targets PX table "Prices"
    ├── Maps sku, listPrice → attribute1, costPrice → attribute2, etc.
    └── Sends in batches of 200,000
    │
    ▼
File archived
```

## Testing

1. Drop `prices.csv` into `/import/prices/`
2. Check logs for:
   ```
   Processing price file: prices.csv
   Price import complete. Records: 10
   ```
3. In Pricefx UI: **Master Data → Product Extensions → Prices** — search for `PUMP-001`
4. Or via pfx CLI:
   ```bash
   pfx fetch-sample PX --name Prices --limit 5
   ```

## Common Mistakes

**1. Missing `<constant expression="Prices" out="name"/>`**
Without this line, Pricefx doesn't know which PX table to target. The import may silently fail or load into an unexpected table.

**2. PX table doesn't exist**
If the table `Prices` hasn't been created in the partition, the import will fail with an error. Create it first via Pricefx UI or `pfx create-product-extension Prices`.

**3. Wrong attribute numbering**
PX attributes are `attribute1` through `attribute30`. If you map to `attribute31` or misspell the field, the data is silently dropped.

## What's Next

In [Tutorial 3: Import Pricing Parameters](03-import-pricing-parameters.md), we'll load exchange rates into a Lookup Table (LTV) — a different object type used for pricing calculations rather than master data.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/02-csv-import-product-extension.md
git commit -m "docs: add tutorial 02 - CSV import product extension"
```

---

### Task 4: Tutorial 03 — Import Pricing Parameters (LTV)

**Files:**
- Create: `docs/tutorials/03-import-pricing-parameters.md`

- [ ] **Step 1: Create `docs/tutorials/03-import-pricing-parameters.md`**

```markdown
# Tutorial 3: Import Pricing Parameters (LTV)

## What We'll Build

Acme's treasury team publishes daily exchange rates that the pricing engine uses to convert prices across currencies. These rates are stored in Pricefx as a **Pricing Parameter** — specifically a single-key **Lookup Table (LTV)**. We'll build a route that loads a CSV of currency rates into this table.

## Prerequisites

- A working IM project with `archive.file` and `read.lock` properties configured
- A Pricing Parameter table named `ExchangeRates` in your Pricefx partition (create via Pricefx UI under **Price Setting → Pricing Parameters**, or via `pfx create-pricing-parameter ExchangeRates`)

## Step by Step

### Step 1: Prepare the sample CSV

Save as `exchange-rates.csv`:

```csv
currency,rate
EUR,1.0000
USD,1.0850
GBP,0.8590
CHF,0.9720
JPY,163.2500
CAD,1.4710
AUD,1.6530
CNY,7.8400
```

Each row is a currency code and its exchange rate relative to EUR (Acme's base currency).

### Step 2: Create the mapper

Create `mappers/import-exchange-rates.mapper.xml`:

```xml
<mappers>
    <loadMapper id="import-exchange-rates.mapper">
        <body in="currency" out="name"/>
        <body in="rate" out="value" converterExpression="stringToDecimal"/>
    </loadMapper>
</mappers>
```

LTV tables have a fixed structure:
- **`name`** — the lookup key (here: currency code like `USD`)
- **`value`** — the lookup value (here: exchange rate like `1.0850`)

No custom attributes — just key and value.

### Step 3: Create the route

Create `routes/import-exchange-rates.xml`:

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="import-exchange-rates">
        <from uri="file://{{integration.sftp.root}}/import/exchange-rates?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
        <log message="Processing exchange rates: ${header.CamelFileName}" loggingLevel="INFO"/>
        <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>
        <to uri="pfx-api:loaddataFile?objectType=LTV&amp;mapper=import-exchange-rates.mapper&amp;pricingParameterName=ExchangeRates&amp;batchSize=500000"/>
        <log message="Exchange rates import complete. Records: ${header.PfxTotalInputRecordsCount}" loggingLevel="INFO"/>
    </route>
</routes>
```

Two new things here:
- **`objectType=LTV`** — targets a single-key Lookup Table (Pricing Parameter)
- **`pricingParameterName=ExchangeRates`** — specifies *which* Pricing Parameter table to load into

> **LTV vs MLTV2:** LTV is a single-key lookup (key → value). MLTV2 is a multi-key matrix (key1 + key2 + ... → attributes). Use LTV for simple lookups like exchange rates or tax rates. Use MLTV2 when the lookup depends on multiple keys (e.g., region + product family → discount).

### Step 4: Add route properties

In `application.properties`:

## How It Works

```text
exchange-rates.csv dropped into /import/exchange-rates/
    │
    ▼
File consumer picks up file
    │
    ▼
pfx-csv:streamingUnmarshal parses CSV
    │
    ▼
pfx-api:loaddataFile streams to Pricefx
    ├── objectType=LTV → Pricing Parameter table
    ├── pricingParameterName=ExchangeRates → specific table
    ├── Maps currency → name, rate → value
    └── Replaces all existing rows in the table
    │
    ▼
File archived
```

**Important:** `loaddataFile` with LTV **replaces** the entire table content. After the load, only the currencies in the CSV will exist in the table. If you need to update individual rows without replacing, use `pfx-api:integrate` with an `integrateMapper` instead.

## Testing

1. Drop `exchange-rates.csv` into `/import/exchange-rates/`
2. Check logs for:
   ```
   Processing exchange rates: exchange-rates.csv
   Exchange rates import complete. Records: 8
   ```
3. In Pricefx UI: **Price Setting → Pricing Parameters → ExchangeRates**
4. Or via pfx CLI:
   ```bash
   pfx pricing-parameter ExchangeRates
   ```

## Common Mistakes

**1. Missing `pricingParameterName`**
Without this parameter, Pricefx doesn't know which Pricing Parameter table to target. The import will fail with an error.

**2. Mapping to wrong fields**
LTV tables use `name` and `value` — not `sku`, `attribute1`, etc. If you map to `sku`, the data goes nowhere.

**3. Pricing Parameter table doesn't exist**
The table must be created in Pricefx before the first import. Create it via the UI or `pfx create-pricing-parameter ExchangeRates`.

## What's Next

In [Tutorial 4: Import Data into PA Data Source](04-import-pa-data-source.md), we'll tackle Acme's largest data set — 2 years of sales transactions loaded into a DMDS table for Price Analyser. This introduces the split/tokenize pattern for handling large files efficiently.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/03-import-pricing-parameters.md
git commit -m "docs: add tutorial 03 - import pricing parameters (LTV)"
```

---

### Task 5: Tutorial 04 — Import PA Data Source (DMDS)

**Files:**
- Create: `docs/tutorials/04-import-pa-data-source.md`

- [ ] **Step 1: Create `docs/tutorials/04-import-pa-data-source.md`**

```markdown
# Tutorial 4: Import Data into PA Data Source

## What We'll Build

Acme's pricing analysts use **Price Analyser (PA)** dashboards to spot trends, compare margins, and simulate price changes. These dashboards run on a **Data Source (DMDS)** table that holds 2 years of sales transactions — about 2 million rows. We'll build a route that loads this data from a large CSV file using the **split/tokenize pattern**, which processes the file in chunks instead of loading it all into memory.

## Prerequisites

- A working IM project with `archive.file` and `read.lock` properties configured
- A Data Source named `SalesTransactions` in your Pricefx partition (create via Pricefx UI under **Price Analyser → Data Manager → Data Sources**, or via pfx CLI)

## Step by Step

### Step 1: Prepare the sample CSV

Save as `sales-transactions.csv`. In production this file would have millions of rows — here's a sample:

```csv
transactionId,sku,customerId,quantity,unitPrice,totalAmount,currency,transactionDate,region
TXN-0001,PUMP-001,CUST-100,5,1250.00,6250.00,USD,2025-06-15,North America
TXN-0002,VALVE-001,CUST-200,20,89.99,1799.80,USD,2025-06-15,North America
TXN-0003,FILTER-001,CUST-300,100,34.50,3450.00,EUR,2025-06-16,Europe
TXN-0004,PUMP-002,CUST-100,2,2340.50,4681.00,USD,2025-07-01,North America
TXN-0005,VALVE-002,CUST-400,10,145.00,1450.00,USD,2025-07-10,North America
TXN-0006,FILTER-002,CUST-500,50,28.75,1437.50,EUR,2025-08-01,Europe
TXN-0007,PUMP-004,CUST-200,3,890.00,2670.00,USD,2025-08-15,North America
TXN-0008,VALVE-003,CUST-300,15,62.00,930.00,EUR,2025-09-01,Europe
TXN-0009,PUMP-001,CUST-600,1,1250.00,1250.00,CAD,2025-09-20,North America
TXN-0010,FILTER-003,CUST-400,200,19.99,3998.00,USD,2025-10-05,North America
```

### Step 2: Create the mapper

Create `mappers/import-sales-transactions.mapper.xml`:

```xml
<mappers>
    <loadMapper id="import-sales-transactions.mapper">
        <body in="transactionId" out="key1"/>
        <body in="sku" out="key2"/>
        <body in="customerId" out="key3"/>
        <body in="quantity" out="attribute1" converterExpression="stringToDecimal"/>
        <body in="unitPrice" out="attribute2" converterExpression="stringToDecimal"/>
        <body in="totalAmount" out="attribute3" converterExpression="stringToDecimal"/>
        <body in="currency" out="attribute4"/>
        <body in="transactionDate" out="attribute5"/>
        <body in="region" out="attribute6"/>
    </loadMapper>
</mappers>
```

Data Source tables use `key1`–`key6` for business keys and `attribute1`–`attribute30` for data fields. Unlike Product or Customer, there's no `sku` or `customerId` built-in field — everything goes into generic key/attribute slots.

### Step 3: Create the route

Create `routes/import-sales-transactions.xml`:

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="import-sales-transactions">
        <from uri="file://{{integration.sftp.root}}/import/sales?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
        <log message="Processing sales transactions: ${header.CamelFileName}" loggingLevel="INFO"/>
        <split aggregationStrategy="recordsCountAggregation" streaming="true">
            <tokenize token="\n" group="50000"/>
            <setProperty name="CamelCharsetName">
                <constant>UTF-8</constant>
            </setProperty>
            <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
            <log message="Loading batch from ${header.CamelFileName}" loggingLevel="INFO"/>
            <to uri="pfx-api:loaddata?objectType=DMDS&amp;mapper=import-sales-transactions.mapper&amp;dsUniqueName=DMDS.SalesTransactions"/>
        </split>
        <log message="Sales import complete. Total records: ${header.PfxTotalInputRecordsCount}" loggingLevel="INFO"/>
        <to uri="pfx-api:flush?dataSourceName=DMDS.SalesTransactions&amp;dataFeedName=DMF.SalesTransactions"/>
        <log message="Data source flushed successfully" loggingLevel="INFO"/>
    </route>
</routes>
```

This route is more complex than the previous tutorials. Let's break it down:

**The split/tokenize pattern:**

1. **`<split streaming="true">`** — Processes the file in chunks instead of loading it all into memory
2. **`<tokenize token="\n" group="50000"/>`** — Splits the file into chunks of 50,000 lines each
3. **`aggregationStrategy="recordsCountAggregation"`** — Counts total records across all chunks
4. **`pfx-csv:unmarshal`** (not `streamingUnmarshal`) — Parses each chunk. Within the split, we use regular `unmarshal` because each chunk is already small enough to fit in memory
5. **`pfx-api:loaddata`** (not `loaddataFile`) — Within a split, we use `loaddata` because the body is already parsed data, not a raw file stream

**After the split:**

6. **`pfx-api:flush`** — Flushes the Data Feed to the Data Source. Without this, the data sits in the staging area (Data Feed) and isn't visible in PA dashboards

> **Why not `loaddataFile`?** The split/tokenize pattern reads chunks of lines and passes them as parsed data. `loaddataFile` expects a raw file stream. Inside a split, always use `loaddata`.

> **Why `group="50000"`?** This determines how many CSV rows are sent per API call. 50,000 is a good balance — large enough for efficient batching, small enough to avoid memory issues. For files with many columns (20+), reduce to 10,000–25,000.

### Step 4: Add route properties

In `application.properties`:

## How It Works

```text
sales-transactions.csv (2M rows) dropped into /import/sales/
    │
    ▼
File consumer picks up file
    │
    ▼
Split: tokenize into chunks of 50,000 lines
    │
    ├── Chunk 1 (lines 1–50,000)
    │   ├── pfx-csv:unmarshal → parse CSV rows
    │   └── pfx-api:loaddata → send to DMDS.SalesTransactions
    │
    ├── Chunk 2 (lines 50,001–100,000)
    │   └── ... same process ...
    │
    └── Chunk 40 (lines 1,950,001–2,000,000)
        └── ... same process ...
    │
    ▼
All chunks loaded → total count aggregated
    │
    ▼
pfx-api:flush → moves data from staging (DMF) to Data Source (DMDS)
    │
    ▼
Data visible in PA dashboards
    │
    ▼
File archived
```

## Testing

1. Drop `sales-transactions.csv` into `/import/sales/`
2. Check logs for:
   ```
   Processing sales transactions: sales-transactions.csv
   Loading batch from sales-transactions.csv
   Sales import complete. Total records: 10
   Data source flushed successfully
   ```
3. In Pricefx UI: **Price Analyser → Data Manager → Data Sources → SalesTransactions**
4. Or via pfx CLI:
   ```bash
   pfx fetch-sample DMDS --name SalesTransactions --limit 5
   ```

## Common Mistakes

**1. Forgetting the flush step**
Without `pfx-api:flush`, data sits in the Data Feed (DMF) staging area and never appears in the Data Source (DMDS). PA dashboards will show stale data.

**2. Using `loaddataFile` inside a split**
Inside a `<split>`, the body is parsed data, not a file stream. Use `loaddata`, not `loaddataFile`.

**3. Missing `dsUniqueName`**
The `dsUniqueName` parameter must be in the format `DMDS.{TableName}`. Without it, Pricefx doesn't know which Data Source to target.

## What's Next

In [Tutorial 5: Export Products to CSV](05-export-products-csv.md), we'll build our first outbound integration — fetching products from Pricefx on a schedule and writing them to a CSV file, with delta sync so we only export what changed since the last run.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/04-import-pa-data-source.md
git commit -m "docs: add tutorial 04 - import PA data source (DMDS)"
```

---

### Task 6: Tutorial 05 — Export Products to CSV

**Files:**
- Create: `docs/tutorials/05-export-products-csv.md`

- [ ] **Step 1: Create `docs/tutorials/05-export-products-csv.md`**

```markdown
# Tutorial 5: Export Products to CSV

## What We'll Build

Acme's downstream systems (warehouse management, e-commerce platform) need a nightly feed of product data from Pricefx. We'll build a scheduled export that runs every night at midnight, fetches only products that changed since the last export (delta sync), transforms them to CSV, and writes the file to an outbound directory.

This tutorial introduces three new concepts: **Quartz scheduling**, **pfx-api:fetch with filters**, and **pfx-config for delta sync timestamps**.

## Prerequisites

- A working IM project
- Products loaded in your Pricefx partition (e.g., from Tutorial 1)

## Step by Step

### Step 1: Create the filter

Create `filters/export-products.filter.xml`:

```xml
<filters>
    <filter id="export-products.filter"
            sortBy="lastUpdateDate"
            resultFields="sku,label,attribute1,attribute2,attribute3,attribute4">
        <and>
            <criterion fieldName="lastUpdateDate" operator="greaterThan" value="simple:${headers.lastExportTimestamp}"/>
            <criterion fieldName="lastUpdateDate" operator="lessOrEqual" value="simple:${headers.currentExportTimestamp}"/>
        </and>
    </filter>
</filters>
```

Key points:
- **`resultFields`** — only return the fields we need (sku, label, and attributes 1–4). Reduces payload size.
- **`sortBy="lastUpdateDate"`** — ensures consistent ordering
- **Two timestamp bounds** — filters records changed between the last export and now. Using both bounds prevents missing records that change *during* the export.
- **`simple:${headers.lastExportTimestamp}`** — the `simple:` prefix tells the filter to read the value from a Camel header at runtime, not treat it as a literal string.

### Step 2: Create the export mapper

Create `mappers/export-products.mapper.xml`:

```xml
<mappers>
    <loadMapper id="export-products.mapper">
        <body in="sku" out="partNumber"/>
        <body in="label" out="description"/>
        <body in="attribute1" out="uom"/>
        <body in="attribute2" out="productFamily"/>
        <body in="attribute3" out="status"/>
        <body in="attribute4" out="listPrice"/>
    </loadMapper>
</mappers>
```

This mapper does the reverse of the import mapper — it transforms Pricefx field names (`sku`, `attribute1`, ...) back to business-friendly CSV column names (`partNumber`, `uom`, ...).

### Step 3: Create the route

Create `routes/export-products.xml`:

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="export-products">
        <from uri="quartz://export/products?cron=0+0+0+*+*+?"/>
        <log message="Starting product export" loggingLevel="INFO"/>

        <!-- Read last export timestamp from Pricefx config store -->
        <toD uri="pfx-config:get?name={{integration.name}}.export-products.timestamp&amp;toHeader=lastExportTimestamp"/>
        <choice>
            <when>
                <simple>${headers.lastExportTimestamp} == null || ${headers.lastExportTimestamp} == ''</simple>
                <setHeader name="lastExportTimestamp">
                    <constant>1970-01-01T00:00:00</constant>
                </setHeader>
            </when>
        </choice>

        <!-- Capture current time as upper bound -->
        <setHeader name="currentExportTimestamp">
            <simple>${date-with-timezone:now:UTC:yyyy-MM-dd'T'HH:mm:ss}</simple>
        </setHeader>

        <log message="Exporting products changed between ${headers.lastExportTimestamp} and ${headers.currentExportTimestamp}" loggingLevel="INFO"/>

        <!-- Set output file name with timestamp -->
        <setHeader name="CamelFileName">
            <simple>products_${date:now:yyyyMMdd_HHmmss}.csv</simple>
        </setHeader>

        <!-- Fetch changed products in batches -->
        <toD uri="pfx-api:fetch?objectType=P&amp;filter=export-products.filter&amp;batchedMode=true&amp;batchSize=50000"/>
        <split>
            <simple>${body}</simple>
            <toD uri="pfx-api:fetch?objectType=P&amp;filter=export-products.filter"/>
            <toD uri="pfx-model:transform?mapper=export-products.mapper"/>
            <toD uri="pfx-csv:marshal"/>
            <to uri="file://{{integration.sftp.root}}/export/products?fileName=${header.CamelFileName}&amp;fileExist=Append"/>
        </split>

        <!-- Save current timestamp for next run -->
        <toD uri="pfx-config:set?name={{integration.name}}.export-products.timestamp&amp;value=${headers.currentExportTimestamp}"/>

        <log message="Product export complete: ${header.CamelFileName}" loggingLevel="INFO"/>
    </route>
</routes>
```

This is the most complex route in the series. Let's walk through each section:

**Scheduling:**
- `quartz://export/products?cron=0+0+0+*+*+?` — runs daily at midnight UTC. The `+` signs replace spaces in the cron expression (required in URIs).

**Delta sync timestamps:**
- `pfx-config:get` reads the last export timestamp from Pricefx's built-in key-value store. On the first run, it won't exist, so we default to `1970-01-01` (export everything).
- `pfx-config:set` saves the current timestamp after a successful export, so the next run only picks up changes.

**Batched fetch:**
- The outer `pfx-api:fetch` with `batchedMode=true` returns a list of batch markers (not data).
- The inner `<split>` iterates over each batch marker and fetches the actual data.
- This two-pass approach handles large result sets without loading everything into memory.

**Transform and write:**
- `pfx-model:transform` applies the export mapper to rename fields
- `pfx-csv:marshal` converts to CSV format
- `file://...?fileExist=Append` writes each batch to the same output file

### Step 4: Add route properties

In `application.properties`:

## How It Works

```text
Quartz fires at midnight UTC
    │
    ▼
Read last export timestamp from pfx-config
(first run: defaults to 1970-01-01)
    │
    ▼
Capture current timestamp as upper bound
    │
    ▼
pfx-api:fetch (batchedMode) → get batch markers
    │
    ├── Batch 1: fetch rows 0–49,999
    │   ├── pfx-model:transform → rename fields
    │   ├── pfx-csv:marshal → convert to CSV
    │   └── file:// → append to products_20260403_000000.csv
    │
    └── Batch 2: fetch rows 50,000–52,341
        └── ... same process ...
    │
    ▼
Save current timestamp to pfx-config
    │
    ▼
Output: /export/products/products_20260403_000000.csv
```

## Testing

For testing, you probably don't want to wait until midnight. Temporarily change the trigger to run once immediately:

```xml
<from uri="timer://runOnce?repeatCount=1"/>
```

1. Deploy the route with the timer trigger
2. Check logs for:
   ```
   Starting product export
   Exporting products changed between 1970-01-01T00:00:00 and 2026-04-03T00:00:00
   Product export complete: products_20260403_000000.csv
   ```
3. Check the output directory for the CSV file
4. Run it again — the second run should export 0 records (nothing changed)
5. Modify a product in Pricefx, run again — only the changed product appears

Remember to switch back to the Quartz cron trigger before deploying to production.

## Common Mistakes

**1. Missing `batchedMode=true` on the outer fetch**
Without batched mode, `pfx-api:fetch` returns all records in one call (up to `maxRows` default of 50,000). For large datasets, this can cause memory issues or miss records beyond the limit.

**2. Only one timestamp bound in the filter**
Using only `greaterThan` without `lessOrEqual` means records that change *during* the export might be missed on the next run (they'd fall between the export start and the saved timestamp). Always use both bounds.

**3. Forgetting to save the timestamp**
If `pfx-config:set` is missing or placed inside the split (where it runs per batch), the next run won't know where to start. Place it *after* the split completes.

## What's Next

Congratulations — you've completed the first wave of Acme Industrial tutorials! You've learned how to:

1. Import master data (Products)
2. Import extension data (Product Extensions)
3. Import pricing parameters (Lookup Tables)
4. Import large datasets with split/tokenize (PA Data Sources)
5. Export data with scheduling and delta sync

Future tutorials will cover REST API integrations (Salesforce), event-driven routes, SFTP file transfers, and more. Stay tuned!
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/05-export-products-csv.md
git commit -m "docs: add tutorial 05 - export products to CSV"
```

---

### Task 7: Final commit and verification

- [ ] **Step 1: Verify all 6 files exist**

```bash
ls -la docs/tutorials/
```

Expected output: 6 markdown files (00 through 05).

- [ ] **Step 2: Verify file sizes are in range**

```bash
wc -l docs/tutorials/*.md
```

Expected: 00 is ~60 lines, 01–05 are ~300–500 lines each.

- [ ] **Step 3: Verify all internal links work**

Check that each "What's Next" section links to the correct next file name:
- 00 → links to 01 through 05
- 01 → links to 02
- 02 → links to 03
- 03 → links to 04
- 04 → links to 05
- 05 → no next link (series complete for now)

- [ ] **Step 4: Final commit**

```bash
git add docs/tutorials/
git commit -m "docs: complete first wave of tutorial series (5 tutorials + intro)"
```
