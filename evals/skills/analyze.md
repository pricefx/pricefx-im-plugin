# analyze Evaluation

## Metadata

- Skill: `pricefx-im-plugin:analyze`
- Version: 1.0.9
- Last updated: 2026-05-21
- Confusion partner: `analyze-project` (agent — full-project scope vs single-route scope)

## Description under test

> Use when the user wants to lint or quality-check a single Pricefx Integration Manager route — says "analyze route", "check my route", "lint", "compliance check", "check route quality", "compare to best practice". For a full project assessment use the `analyze-project` agent instead.

## Positive Cases

### Case 1: Single-route lint with file path

**Prompt**: `I have a route at src/main/resources/repo/routes/import-products.xml — can you lint it and check for anti-patterns? I want to know if it follows IM conventions.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Reads the named file
- [ ] Reports anti-patterns from `docs/anti-patterns.md` (AP-N labels)
- [ ] Does NOT scan the whole project

### Case 2: Compliance check with specific concern

**Prompt**: `Run a compliance check on src/main/resources/repo/routes/export-customers-daily.xml against our best practices. Specifically check for streaming on splits and proper error handling.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Focused on the one named route file
- [ ] AP-3 (streaming) + AP-6 (error handling) findings if present

### Case 3: Suspected missing flush

**Prompt**: `Check this route src/main/resources/repo/routes/refresh-prices.xml against best practice — I think it's missing something but not sure what. Maybe the flush step?`

**Expected behavior**:
- [ ] Skill triggers
- [ ] If DMDS route → reports AP-11 (missing flush on DMDS)
- [ ] Otherwise lists other findings

### Case 4: Pre-deploy quality scan

**Prompt**: `Can you analyze import-px-prices.xml route and tell me if it has any quality issues, anti-patterns, or hidden bugs before I deploy?`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Full anti-pattern + quality scan on the single file
- [ ] Surfaces all AP findings per `docs/anti-patterns.md`

## Negative Cases

### Case 1: Full-project scope (should pick `analyze-project` agent)

**Prompt**: `Run a full project health check on this whole IM project — I want a quality score, route inventory, and the top 3 actions to fix.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `analyze-project` agent is selected (full-project scope)

### Case 2: Migration / modernization (should pick `migrate-project`)

**Prompt**: `Modernize this project — fix legacy patterns automatically.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `migrate-project` agent is selected (apply fixes, not just report)

## Edge Cases

### Case 1: Vague "check my route"

**Prompt**: `Check my route.`

**Expected behavior**:
- [ ] Claude asks which route file to analyse
- [ ] May trigger the skill after disambiguation, or wait for a file path
