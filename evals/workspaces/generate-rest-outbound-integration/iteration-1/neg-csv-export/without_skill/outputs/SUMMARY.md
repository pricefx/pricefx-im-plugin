# Export Pricefx Changed Products to CSV daily on SFTP

## Scope decision

Prompt asks for outbound CSV export to SFTP, not REST outbound. Generated CSV/SFTP delta-export bundle based on docs/routes.md (Pattern 3) and docs/components.md (Delta Sync via pfx-config).

## Files

- routes/export-products.xml — Quartz daily at 02:00; reads lastExportTimestamp via pfx-config, captures currentExportTimestamp, fetches Products with batchedMode=true, splits, transforms, marshals CSV, uploads to SFTP; persists upper bound on completion.
- filters/export-products.filter.xml — delta filter on lastUpdateDate between the two bounds.
- mappers/export-products.mapper.xml — projection of common Product fields.
- connections/sftp.connection.json — SFTP connection placeholder.
- config/application.properties — integration.name, export.sftp.path.

## Assumptions

- Camel 4.
- Result fields are generic placeholders (no partition metadata).
- External SFTP (not IM-local mounted).

## Caveats

- Field list not derived from pfx product-metadata.
- No CSV header row emitted across appended batches.
- fileExist=Append over batches; production would use temp + rename.
