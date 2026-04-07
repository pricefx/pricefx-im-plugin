# Tutorial Series Design: Pricefx IM Step-by-Step Guides

**Date:** 2026-04-03
**Status:** Approved

## Goal

Create a series of step-by-step tutorial articles that teach Pricefx partners and implementors how to build integrations using Integration Manager. Each article walks the reader from zero to a working integration, introducing one new concept at a time.

## Audience

Pricefx partners and implementors who know Pricefx but are learning Integration Manager.

## Format

- **Tutorial articles with inline code** — no separate example projects
- **Location:** `docs/tutorials/`
- **Language:** English
- **Approach:** Start with 5 articles (first wave), expand based on feedback

## Shared Context: Acme Industrial

A fictional company used across all tutorials for consistency. Defined in `docs/tutorials/00-acme-industrial.md`.

- **Company:** Acme Industrial — manufacturer of industrial components (pumps, valves, filters)
- **Scale:** ~15,000 SKUs, 3,000 customers, 200 distributors
- **ERP:** SAP (source of product and transactional data via daily CSV exports)
- **CRM:** Salesforce (source of customer data)
- **Pricefx:** Pricing engine, receives data from both systems

Each article is **self-contained** — the reader does not need to read article 00 or prior articles, but the shared Acme world keeps examples consistent.

## First Wave: 5 Tutorials + Intro

| # | File | Title | What the Reader Builds | New Concept Introduced |
|---|------|-------|------------------------|------------------------|
| 0 | `00-acme-industrial.md` | Meet Acme Industrial | — (context only) | Shared fictional scenario |
| 1 | `01-csv-import-products.md` | Import Products from CSV | CSV file → Product Master (P) | Route, mapper, `loaddataFile`, file consumer, `application.properties` |
| 2 | `02-csv-import-product-extension.md` | Import Product Extension Data | CSV file → Product Extension (PX) | PX table name via `constant out="name"`, extension attributes |
| 3 | `03-import-pricing-parameters.md` | Import Pricing Parameters (LTV) | CSV file → Lookup Table (LTV) | `pricingParameterName`, LTV object type |
| 4 | `04-import-pa-data-source.md` | Import Data into PA Data Source | CSV file → DMDS table | Split/tokenize/loaddata/flush pattern, `recordsCountAggregation` |
| 5 | `05-export-products-csv.md` | Export Products to CSV | Scheduled export from Pricefx → CSV | Quartz cron, `pfx-api:fetch`, `pfx-config` delta sync, filters |

### Ordering Rationale

Each article adds one new concept on top of what the reader already knows:
1. Simplest possible import (CSV → P)
2. Same pattern + PX-specific naming
3. Same pattern + pricing parameter specifics
4. More complex inbound pattern (split/tokenize/flush)
5. First outbound pattern (fetch + export + scheduling + delta)

## Article Structure

Every tutorial follows this outline:

### 1. What We'll Build (2-3 sentences)
Business context — why Acme needs this integration.

### 2. Prerequisites
What the reader needs before starting (IM project structure, partition access, pfx CLI).

### 3. Step by Step
Numbered steps. Each step has:
- Brief explanation of what we're doing and why
- Code block (XML route, mapper, properties, or CSV sample)
- Key callouts for common gotchas

### 4. How It Works
Short explanation of the Camel flow under the hood — what happens when the route runs (file pickup → unmarshal → API call → response).

### 5. Testing
- Sample CSV data (5-10 rows) the reader can save and use
- How to verify the data landed in Pricefx (pfx CLI or UI)
- Expected output / log messages

### 6. Common Mistakes
2-3 typical problems and their solutions (e.g., mismatched mapper ID, missing `constant out="name"` for PX).

### 7. What's Next
One sentence linking to the next tutorial in the series.

## Article Size

Target: **300-500 lines of markdown** per article. Enough to be thorough, short enough to complete in one sitting.

## Conventions

- All code uses **provisioned IM format** (standalone mapper files, no `pfx:` namespace prefix in mappers)
- File consumer patterns use `{{archive.file}}` and `{{read.lock}}` properties (not `noop=true`)
- Default import method is `loaddataFile` (not `loaddata`) per project conventions
- No `connection=pricefx` on `pfx-api` calls (implicit default)
- Route IDs match file names
- Mapper IDs match file names (without `.xml`)

## Future Waves (not in scope now)

Potential topics for expansion:
- REST API inbound (Salesforce → Pricefx customers)
- Event-driven routes (post-calculation triggers)
- SFTP file pickup
- REST outbound (push data to external API)
- Multi-tenant routing
- Kafka CDC integration
- SOAP/XML integration
- Error handling and retry patterns
- Performance tuning and batch sizing
