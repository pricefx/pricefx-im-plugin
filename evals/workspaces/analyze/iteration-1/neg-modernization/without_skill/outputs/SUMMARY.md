# Response to: "Modernize this project — fix legacy patterns automatically."

## Decision: Decline to auto-modernize. Ask for scope and confirmation first.

This prompt asks for a destructive, repo-wide rewrite ("fix legacy patterns automatically"). Acting on it blindly — without a plan, without inspecting the project, and without user confirmation — would be irresponsible. Below is the approach I would take instead.

## Why I am not running an automatic rewrite

1. **No target identified.** The prompt does not say *which* project to modernize. The plugin repo at `/Users/mnagas/Documents/pricefx/pricefx-im-plugin` is the plugin itself (skills, docs, evals), not an IM customer project. There are no `src/main/resources/repo/routes/*.xml` files to rewrite here. I would need the user to point me at an actual IM project workspace.

2. **"Legacy patterns" is undefined.** In the Pricefx IM context this could mean many things, each with different fix recipes and risk profiles:
   - Camel 3 → Camel 4 attribute renames (`errorHandlerRef` → `errorHandler`, `strategyRef` → `aggregationStrategy`, `${pfx:foo}` → `{{pfx:foo}}`, `quartz2:` → `quartz:`, `vm:` → `seda:`, `aws-s3:` → `aws2-s3:`, `<inOnly/>` → `<to pattern="InOnly"/>`, etc.)
   - `<routeContext>` wrapper → `<routes>` root
   - Spring-XML mapper beans → standalone provisioned-IM mapper files under `mappers/`
   - `loaddata` for bulk CSV → `loaddataFile` with `pfx-csv:streamingUnmarshal`
   - Redundant `connection=pricefx` parameters
   - `pfx-sftp` against `default-sftp-connection` → `file://{{integration.sftp.root}}/...`
   - Missing archive/readLock/doneFile properties on file consumers
   - Manual-IM project layout → provisioned-IM layout (different POM, different folder structure)

   Each of these is a separate transformation. Bundling them under "modernize automatically" without confirmation risks silent breakage.

3. **Destructive changes need review checkpoints.** Even with a clear scope, the right workflow is: detect -> report -> confirm -> apply per-category, not a single sweeping rewrite.

## What I would do instead (proposed workflow)

1. Ask the user to identify the target IM project directory (path to the customer integration repo, not the plugin).
2. Detect the target Camel/IM version by reading `pom.xml` — `<camel.version>` or, failing that, the IM BOM version. This decides which attribute forms are "legacy" vs current.
3. Run a read-only audit of the project against the known anti-pattern catalog. Produce a report grouped by severity (blocker / warning / nit) with file paths and line numbers.
4. Present the report to the user with proposed fixes per category. Let them pick which categories to apply and on which files.
5. Apply fixes incrementally, one category at a time, with a git commit per category so changes are reviewable and revertable.
6. Verify after each batch: re-run the audit, run any project tests, and confirm the route XML still parses against `src/main/resources/schemas/pfx.xsd`.

## What I would NOT do

- Run a global find-and-replace across the repo without showing the diff first.
- Change URI schemes (e.g., `quartz2:` -> `quartz:`) without first confirming the target Camel version supports the new scheme.
- Convert manual-IM project structure to provisioned-IM structure without explicit user opt-in.
- Touch `application.properties`, `pom.xml`, or `connections/*.json` as part of an unscoped sweep.

## Requested clarifications from the user

1. Path to the IM project to modernize (absolute path).
2. Scope: all categories above, or a specific subset?
3. Target Camel/IM version if you want to force a specific upgrade target.
4. Confirmation that I may commit changes in batches, or a single squashed diff.

Once those are answered, I will produce the audit report first, then apply fixes category-by-category with sign-off.
