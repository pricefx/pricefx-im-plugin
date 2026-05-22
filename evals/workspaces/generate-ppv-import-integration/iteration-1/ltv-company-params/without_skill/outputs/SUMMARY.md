# Import Company Parameters (LTV) - Bundle Summary

Loads single-key Pricing Parameter values from a CSV file into a Pricefx LTV table.

## Files

- import-company-params.xml - Camel route, polls inbound folder, streams CSV, loads to LTV.
- import-company-params.mapper.xml - loadMapper mapping CSV columns (name, value) to LTV fields.
- application.properties - shared file-consumer properties and route-specific config.

## Behavior

1. The file consumer polls /im/inbound/ (property pfx:import-company-params.inbound) every 10 s.
2. readLock=changed waits until the file stops growing before consuming it (no .done marker assumed).
3. The CSV is parsed in streaming mode via pfx-csv:streamingUnmarshal (header row skipped).
4. pfx-api:loaddataFile streams rows to Pricefx in 100 000-row batches, targeting objectType=LTV and the Pricing Parameter table named by pfx:import-company-params.pricingParameterName (default CompanyParameters - adjust to the real table on the partition).
5. Processed files are archived under .archive/<yyyy>/<MM>/...

## CSV format expected

name,value
DEFAULT_MARGIN,0.18
DEFAULT_CURRENCY,USD

- name -> LTV key.
- value -> stored value.

## Prerequisites

- LTV Pricing Parameter table must exist; create with `pfx create-pricing-parameter CompanyParameters` (or rename to match an existing table) and align the property value.

## Conventions

- Route id == file name; mapper id == mapper file name without .xml.
- Camel 4 form, {{...}} placeholders, no connection=pricefx (default connection is used).
- Uses local file: component (not pfx-sftp) because /im/inbound is on the pod's local FS.
