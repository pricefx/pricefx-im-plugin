---
name: analyze
description: Analyze a single IM route for quality issues, anti-patterns, and naming convention violations. Like a linter for IM routes. Use when the user says "analyze route", "check my route", "lint", "compliance check", "check route quality", "compare to best practice".
---

# Analyze Route Quality

You are analyzing a single Pricefx Integration Manager route for quality issues, anti-patterns, and naming convention violations. Follow the steps below precisely.

## Step 1: Identify the Route to Analyze

If the user specified a route file, read it directly. Otherwise ask: **Which route file should I analyze?** (look in `src/main/resources/repo/routes/`).

Read the route XML in full. Also read any associated mapper (`src/main/resources/repo/mappers/`) and filter (`src/main/resources/repo/filters/`) referenced in the route.

## Step 2: Detect Route Type

Classify the route by inspecting the `from` URI and route ID:

| Type | Detection |
|---|---|
| **CSV/SFTP Import** | `pfx-sftp:` or `file://` in `from`, route ID starts with `import-`, object type P/PX/C/CX/SL/SX |
| **DMDS/DS Import** | `pfx-api:loaddata` with `objectType=DMDS` or `objectType=DS`, or route ID contains `-ds` |
| **PPV Import** | `objectType=LTV` or `objectType=MLTV2` or `objectType=MLTV3` in `pfx-api:loaddata` or `pfx-api:loaddataFile` URI |
| **Scheduled Export** | `quartz:` in `from`, route ID starts with `export-`, no `pfx-config:get` for timestamp |
| **Incremental Export** | `quartz:` in `from`, uses `pfx-config:get` and `pfx-config:set` for timestamp tracking |
| **Event-Driven** | `from uri="direct:event` or `pfx-event:` in `from`, route ID starts with `event-` |
| **Chained/Utility** | `from uri="direct:` (not event), `timer:`, or `seda:` |

State the detected type clearly before continuing.

## Step 3: Run All Checks

Check each criterion below. For each one, record the result as **OK**, **WARN**, or **FAIL**.

### Naming and Structure

| # | Check | How to Detect | Pass Condition |
|---|---|---|---|
| N-1 | Route ID matches filename | Route `id` attribute vs file name without `.xml` | Exact match |
| N-2 | No `pfx:` prefix on route ID | Route `id` starts with `pfx:` | No `pfx:` prefix |
| N-3 | Mapper ID matches filename | Mapper `id` attribute vs file name without `.xml` | Exact match |
| N-4 | Filter ID matches filename | Filter `id` attribute vs file name without `.xml` | Exact match |
| N-5 | Route file under 200 lines | Count total lines in route XML | 200 or fewer |

### XML and Syntax

| # | Check | How to Detect | Pass Condition |
|---|---|---|---|
| X-1 | XML escaping | Unescaped `&` in URI attributes (should be `&amp;`) | All `&` properly escaped |

### File Consumer (routes with `file://` or `pfx-sftp:` in `from`)

| # | Check | How to Detect | Pass Condition |
|---|---|---|---|
| F-1 | Archive folder | `{{archive.file}}` or `move=.archive/` on the `from` URI | Present |
| F-2 | Error folder | `{{error.file}}` or `moveFailed=` on the `from` URI | Present |
| F-3 | Read lock | `{{read.lock}}` or `{{done.file}}` or `readLock=` or `doneFileName=` on the `from` URI | One present |
| F-4 | No `noop=true` | `noop=true` on the file consumer | Not present |
| F-5 | File URIs use `{{integration.sftp.root}}` | File paths use `{{integration.data}}` or `{{data.directory}}` | Uses `{{integration.sftp.root}}` |

### Pricefx API

| # | Check | How to Detect | Pass Condition |
|---|---|---|---|
| A-1 | No redundant `connection=pricefx` | `connection=pricefx` on any `pfx-api`, `pfx-model`, `pfx-csv`, `pfx-config` URI | Not present |
| A-2 | PX/CX/SX mapper has extension name | Mapper for PX, CX, or SX import has `<constant ... out="name"/>` | Present for PX/CX/SX imports |
| A-3 | Correct key fields | P/PX/DS maps to `sku`, C/CX maps to `customerId`, SL/SX maps to `sellerId` | Correct key field |
| A-4 | Prefer `loaddataFile` for P/PX/C/CX | Import route uses `<split>` + `<tokenize>` + `pfx-api:loaddata` for P, PX, C, or CX | Uses `loaddataFile` instead (NOT applicable to DMDS) |

### DMDS-Specific (only for DS/DMDS routes)

| # | Check | How to Detect | Pass Condition |
|---|---|---|---|
| D-1 | Flush present | `pfx-api:flush` exists in the route | Present |
| D-2 | Flush outside split | `pfx-api:flush` appears after `</split>` or inside `<onCompletion>`, not inside `<split>` body | Outside split |

### Export-Specific (only for export routes)

| # | Check | How to Detect | Pass Condition |
|---|---|---|---|
| E-1 | PX/CX/SX filter has `name` criterion | Filter for PX, CX, or SX export has `<criterion fieldName="name" operator="equals" .../>` | Present |
| E-2 | Filter-Mapper field sync | Every field in filter `resultFields` has a `<body in="...">` in the mapper, and vice versa | Synchronized |

### Split Processing (only when `<split>` is used)

| # | Check | How to Detect | Pass Condition |
|---|---|---|---|
| S-1 | Streaming on split | `<split>` element has `streaming="true"` | Present |

### Anti-Patterns

| # | Check | How to Detect | Pass Condition |
|---|---|---|---|
| AP-1 | Inline Groovy under 15 lines | Count lines inside every `<groovy>` or `<script language="groovy">` block | 15 or fewer |
| AP-2 | No hardcoded hostnames/IPs | Literal hostnames, IP addresses, or URLs in `uri=` attributes (batch sizes and cron expressions in XML are fine) | None found |
| AP-3 | CFS trigger not inside split | `pfx-api:calculate`, `pfx-api:execute`, or CFS-related URIs inside `<split>` body | Not inside split |

## Step 4: Output the Report

Format the report as a table. Use status symbols:
- **OK** -- criterion met
- **WARN** -- criterion present but suboptimal
- **FAIL** -- criterion absent or incorrect, must fix
- **N/A** -- not applicable to this route type

```
Route: [route-id]
Type:  [detected type]
File:  [file path]

QUALITY REPORT
==============

#    | Check                              | Status | Detail
-----|-------------------------------------|--------|------------------------------------------
N-1  | Route ID matches filename           | OK     | import-products matches file name
N-2  | No pfx: prefix on route ID          | OK     | No prefix found
N-3  | Mapper ID matches filename           | OK     | import-products.mapper matches file name
N-4  | Filter ID matches filename           | N/A    | No filter for import route
N-5  | Route file under 200 lines          | OK     | 45 lines
X-1  | XML escaping                         | OK     | All & properly escaped
F-1  | Archive folder                       | OK     | {{archive.file}} present
F-2  | Error folder                         | OK     | {{error.file}} present
F-3  | Read lock                            | OK     | {{read.lock}} present
F-4  | No noop=true                         | OK     | Not present
F-5  | File URIs use integration.sftp.root  | OK     | Correct placeholder
A-1  | No redundant connection=pricefx      | OK     | Not present
A-2  | PX/CX/SX mapper has extension name   | OK     | <constant expression="Prices" out="name"/>
A-3  | Correct key fields                   | OK     | sku used for PX
A-4  | Prefer loaddataFile for P/PX/C/CX    | OK     | Uses loaddataFile
S-1  | Streaming on split                   | N/A    | No split element
AP-1 | Inline Groovy under 15 lines         | OK     | No Groovy blocks
AP-2 | No hardcoded hostnames/IPs           | OK     | None found
AP-3 | CFS trigger not inside split         | N/A    | No split element

SUMMARY: X passed, Y failed, Z warnings, W not applicable
```

## Step 5: Suggest Specific Fixes

For every FAIL or WARN item, provide:
1. **What is wrong** -- one sentence
2. **Where** -- the specific element or line in the route
3. **How to fix** -- the exact XML snippet to add or change, showing only the relevant fragment

Example fix format:

```
FAIL F-2: Error folder missing
  The <from> URI has no error folder configuration.
  Add {{error.file}} to the <from> URI:

  <from uri="file://{{integration.sftp.root}}/my-path?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}&amp;{{error.file}}"/>
```

After presenting fixes, ask: **Would you like me to apply these fixes to the route file?**
If yes, apply them one at a time, reading the file fresh before each edit.

## Rules

- Never modify the route unless the user explicitly confirms.
- No customer data in the report -- use placeholder values in snippets.
- Do NOT check or flag: batch size externalization, pfxCsvSettings, pfxApiSettings, MalformedInputException doCatch, delimiter externalization. These are all valid as-is.
- Hardcoded batch sizes and cron expressions in route XML are fine -- only flag hardcoded hostnames, IP addresses, and URLs.
- If the route type cannot be determined, ask the user before proceeding.
- Stick to the checks listed in this skill -- do not invent additional checks.
