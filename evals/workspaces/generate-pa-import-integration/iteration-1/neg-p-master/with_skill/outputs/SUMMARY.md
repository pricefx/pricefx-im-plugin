# Skill Mismatch — No Files Generated

## Decision
The `generate-pa-import-integration` skill is NOT the right fit for this request.

## User Request
"Import product master from /import/products.csv into Pricefx P table with sku as business key."

## Why this skill does not apply
The user is asking to import data into the P (Product Master) table. This is a standard Pricefx master-data import, not a PA (Price Analyser) Data Source import.

The generate-pa-import-integration SKILL.md explicitly states:

- description (line 3): "Use when the user wants to import data into a Pricefx PA (Price Analyser) Data Source — mentions 'PA Data Source', 'DMDS', 'DS', 'Price Analyser data loading', 'sales history', or 'transaction load'. ... For P/PX/C/CX use `generate-import-integration`; for LTV/MLTV2 use `generate-ppv-import-integration`."
- Line 10: "This skill is for DMDS (PA Data Source) imports only. For P, PX, CX, or C imports, use `/generate-import-integration` instead."

The DMDS pattern (split+tokenize+loaddata+flush, objectType=DMDS, dsUniqueName=DMDS.{Name}, mandatory pfx-api:flush) does not apply to P-table loads. P-table loads typically use pfx-csv:streamingUnmarshal + pfx-api:loaddataFile with objectType=P and businessKeys=sku.

## Recommended Skill
generate-import-integration — the standard skill for P / PX / C / CX master-data imports.

## Action Taken
Per the eval rules (rule 1), no route or mapper files have been generated. Only this SUMMARY.md is written, directing the user to the correct skill.
