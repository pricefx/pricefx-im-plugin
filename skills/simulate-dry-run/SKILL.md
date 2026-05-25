---
name: simulate-dry-run
description: Use when the user wants to trace what would happen if a CSV file or event were processed by a Pricefx Integration Manager route, WITHOUT making real API calls — says "dry run", "simulate", "what would happen", "test without running", "trace through the route".
---

# Simulate Dry Run

Simulate the processing of a CSV file or event through an IM route without making real API calls. Trace each step and flag potential issues.

## Step 1: Identify Route and Input

Ask the user to provide:
- **Route XML file** path (e.g., `src/main/resources/repo/routes/import-products.xml`)
- **Input** — one of:
  - Sample CSV file (attach or paste first 5 rows)
  - Sample event JSON payload

If the user provides only a route name, locate it under `src/main/resources/repo/routes/`.

## Step 2: Read the Route XML

Read the route XML and identify the processing pipeline:
1. Source URI (`<from>`)
2. Each `<to>` step in order
3. Any `<split>`, `<filter>`, `<onCompletion>` blocks
4. Mapper and filter references

## Step 3: Read Mapper XML

If the route references a mapper (e.g., `mapper=import-products.mapper`), read:
`src/main/resources/repo/mappers/{mapper-name}.xml`

Extract all `<body>`, `<constant>`, `<groovy>`, `<header>`, `<simple>` mapping elements.

## Step 4: Read Filter XML (if applicable)

If the route references a filter (e.g., `filter=import-products.filter`), read:
`src/main/resources/repo/filters/{filter-name}.xml`

Extract filter conditions and note how many sample rows would be excluded.

## Step 5: Trace the Processing Pipeline

For each step in the route, show what happens to the data. Output the simulation report using this format:

```
## Dry Run: {route-id}

### Input (first 3 rows)
| {col1} | {col2} | {col3} | {col4} |
|---|---|---|---|
| {val} | {val} | {val} | {val} |
| {val} | {val} | {val} | {val} |
| {val} | {val} | {val} | {val} |

### Step 1: CSV Parse
✅ {N} rows parsed, {M} columns detected
Delimiter: {delimiter}, Quote: {quote-char}, Header: row 1

### Step 2: Field Mapping ({mapper-id})
| CSV Column | → | Pricefx Field | Converter | Sample Value |
|---|---|---|---|---|
| {csv-col} | → | {pfx-field} | (none) | {sample} |
| {csv-col} | → | {pfx-field} | stringToDecimal(us) | {raw} → {converted} |

### Step 3: Batch Processing
Records: {N}, Batch size: {batchSize} → {batches} batch(es)

### Step 4: API Call (simulated)
POST /loaddata/{objectType}
Payload: {"header":[{fields}],"data":[[{row1}],...]}

### Step 5: Post-Load
✅ CFS "{name}" would be triggered (onCompletion)
✅ File would be moved to .archive/{year}/{month}/{filename}

### Summary
- Records processed: {N}
- Batches: {B}
- API calls: {A} (loaddata) + {C} (CFS/post-load)
- Errors: 0
```

## Step 6: Event Routes

For event-driven routes (no CSV input), show:
1. **Event received** — display the sample JSON payload
2. **Event parsing** — which fields are extracted
3. **Handler dispatch** — which downstream route or action is triggered
4. **Simulated outcome** — what API calls would be made

## Step 7: Flag Potential Issues

After the pipeline trace, check for and report any issues:

| Issue | Severity | Detail |
|---|---|---|
| Converter would fail | ERROR | Value "N/A" in column `{col}` — `stringToDecimal` cannot parse |
| Filter would exclude records | WARN | {N} of {total} rows match filter condition — only {kept} processed |
| Missing expected CSV column | ERROR | Mapper expects `{field}` but column not found in CSV |
| Unmapped CSV column | INFO | Column `{col}` not referenced in mapper — will be ignored |
| Batch count warning | WARN | {N} records / batchSize {B} = {batches} batches — consider tuning |
| No archive configured | WARN | File URI has no `{{archive.file}}` — processed file will not be moved |

Report each issue clearly. For ERROR-level issues, explain what would happen at runtime and suggest a fix.

## Important Rules

- NEVER make real API calls — this is a simulation only
- NEVER display or log actual customer/partition data from the CSV sample
- Always derive converter output from the sample values (e.g., show `"29.99" → 29.99`)
- Keep the report concise — use tables, not prose paragraphs
- If route XML or mapper XML cannot be found, ask the user for the correct path before proceeding
- For `loaddataFile` routes, note that IM streams the file directly — field mapping is applied server-side, so the mapper trace is an approximation
