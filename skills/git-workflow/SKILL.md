---
name: git-workflow
description: Use when the user wants to run git operations on a Pricefx Integration Manager project — says "create branch", "commit my work", "prepare MR", "git workflow", or needs feature-branch naming, commit messages, or MR descriptions generated from the route changes.
---

# Git Workflow

## Step 1: Detect Intent

Determine what the user wants based on `$ARGUMENTS` or context:

| Intent | Trigger phrases |
|---|---|
| **New branch** | "starting work", "new integration", "create branch" |
| **Smart commit** | "commit", "save my work", "commit my changes" |
| **Prepare MR** | "prepare MR", "merge request", "open MR", "ready to merge" |
| **Release notes** | "what changed", "release notes", "changelog" |

If intent is unclear, ask: **What would you like to do? (create branch / commit / prepare MR / release notes)**

## Action A: New Branch

Run `git status` and `git branch --show-current` to confirm the user is on `develop`.

Suggest a branch name based on what the user is building:

| Integration type | Suggested pattern |
|---|---|
| Import from file/SFTP | `feature/import-{entity}-from-{source}` |
| Import from database | `feature/import-{entity}-from-db` |
| Import from REST/SOAP | `feature/import-{entity}-from-{system}` |
| Export | `feature/export-{entity}-to-{target}` |
| Event-driven | `feature/event-{trigger}-{action}` |
| Fix / bugfix | `bugfix/{short-description}` |
| Infrastructure / config | `feature/config-{what}` |

Examples:
- `feature/import-products-from-sftp`
- `feature/export-customers-to-erp`
- `feature/event-calculation-complete-notify`

Present the suggested name and ask: **Does this branch name look good, or would you like to adjust?**

Once confirmed, create and switch to the branch:
```bash
git checkout -b {branch-name}
```

## Action B: Smart Commit

Run these commands to understand what changed:
```bash
git diff --name-only HEAD
git status --short
```

Analyze the changed files by type and generate a commit message:

| Changed files | Commit message pattern |
|---|---|
| New route XML | `feat: add {route-id} route` |
| New mapper XML | `feat: add {mapper-name} field mapping` |
| New route + mapper | `feat: add {route-id} route with {entity} mapping` |
| New route + mapper + filter + test | `feat: complete {entity} import integration (route + mapper + filter + test)` |
| Modified mapper | `fix: update {mapper-name} field mapping for {field}` |
| Modified route | `fix: update {route-id} route configuration` |
| Properties only | `chore: update {integration-name} connection properties` |
| Tests only | `test: add integration tests for {route-id}` |

### Commit message rules

- Start with `feat:`, `fix:`, `chore:`, `test:`, or `refactor:`
- Reference entity type and source/target system where possible
- Include all affected artifacts in one message for related changes
- 72 character limit on the subject line
- NEVER commit `.env`, `application-local.properties`, or files with passwords/tokens

Present the proposed commit message and ask: **Does this commit message look good?**

Once confirmed:
```bash
git add {staged-files}
git commit -m "{message}"
```

## Action C: Prepare MR

Gather information about the branch:
```bash
git log develop..HEAD --oneline
git diff develop...HEAD --name-only
```

Generate a structured MR description covering all commits since `develop`:

```markdown
## Summary

{1-3 bullet points describing what was added or changed}

## New Routes

| Route | Direction | Source → Target | Schedule/Trigger |
|---|---|---|---|
| {route-id} | Import | {source} → Pricefx {objectType} | {trigger} |

## Field Mapping Summary

| Mapper | Source fields → Pricefx fields |
|---|---|
| {mapper-name} | {key-mappings} |

## Test Coverage

- [ ] Unit test added: `{TestClassName}`
- [ ] Integration test added: `{TestClassName}IT`
- [ ] Tested manually against dev partition

## Checklist

- [ ] Route ID matches file name (no `pfx:` prefix)
- [ ] All URIs use `{{property}}` placeholders, no hardcoded values
- [ ] Streaming enabled on split (loaddata routes)
- [ ] Batch size appropriate for field count
- [ ] Archive/error folder patterns configured
- [ ] No secrets committed (no passwords, tokens, or keys)
- [ ] Properties documented in README or application.properties comments
```

Present the MR description and ask: **Would you like to copy this as the MR description, or adjust anything?**

## Action D: Release Notes

Run:
```bash
git log {from-ref}..{to-ref} --oneline --no-merges
git diff {from-ref}...{to-ref} --name-only
```

If refs are not specified, ask: **What range should I compare? (e.g., last release tag vs HEAD, or branch A vs B)**

Group changes into human-readable categories:

```markdown
## Release Notes — {date}

### New Integrations
- **import-products-from-sftp** — Imports product master data from SFTP CSV files into Pricefx Products (P)

### Updated Integrations
- **export-customers-to-erp** — Fixed timestamp tracking for incremental exports

### Bug Fixes
- **{route-id}** — {what was fixed}

### Configuration Changes
- Added `archive.file` property to application.properties
```

## Important Rules

- NEVER force push (`git push --force`) — always raise this with the team if needed
- NEVER commit secrets — scan for passwords, tokens, API keys before staging
- NEVER commit directly to `develop` or `main` — always use feature branches
- NEVER skip pre-commit hooks (`--no-verify`)
- ALWAYS use `feature/` prefix for new integrations, `bugfix/` for fixes
- Branch names must be kebab-case, descriptive, and reference the entity/system
- Commit messages must be meaningful — no "WIP", "fix", or "changes"
