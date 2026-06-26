---
description: Release a new version of the plugin — merge develop into main, bump version, push to origin (GitLab) + github (mirror)
argument-hint: "[major|minor|patch] (optional, asks if omitted)"
---

# Release the pricefx-im-plugin

You are running the release workflow. Follow these steps exactly. Do NOT skip ahead and do NOT take destructive shortcuts.

## Inputs

`$ARGUMENTS` may contain the version-bump kind: `major`, `minor`, or `patch`. If empty, ASK the user before proceeding.

## Step 1 — Pre-flight checks

Run these checks. ABORT (do not proceed) and report findings if any fail:

1. `git status` — must be clean (no uncommitted changes, no untracked files except `.claude/`).
2. `git remote -v` — must show two remotes:
   - `origin` → `gitlab.pricefx.eu/tools/pricefx-im-plugin.git`
   - `github` → `github.com/pricefx/pricefx-im-plugin.git`
3. `git fetch origin --quiet && git fetch github --quiet` — sync remotes.
4. `git log --oneline github/main..origin/develop | head -5` — there MUST be at least one commit on develop ahead of main. If zero commits, ABORT with "nothing to release".
5. `glab mr list 2>&1 | head -5` — must say "No open merge requests" (no in-flight work). If there are open MRs, ASK the user whether to wait or proceed.

## Step 2 — Pick the version

Read the current version from `.claude-plugin/plugin.json` → `version` field.

If `$ARGUMENTS` is empty, present three options and ask the user:

| Bump | From `X.Y.Z` to | When |
|---|---|---|
| `patch` | `X.Y.(Z+1)` | Bug fixes only, no new skills/agents/docs sections |
| `minor` | `X.(Y+1).0` | New skills, new agents, or new docs sections |
| `major` | `(X+1).0.0` | Breaking changes (renamed slash commands, removed skills, doc structure rewrite) |

Compute the target version. State it before proceeding.

## Step 3 — Show the release summary (for sanity check)

Before any merge or push, show the user what they're about to ship:

```
git log --oneline github/main..origin/develop | wc -l   # commit count
git diff --stat github/main..origin/develop | tail -3   # file change summary
```

Also list new skills + agents introduced since main:

```
diff <(git ls-tree -r --name-only github/main -- skills/ | grep SKILL.md | sort) \
     <(git ls-tree -r --name-only origin/develop -- skills/ | grep SKILL.md | sort) \
     | grep "^>" | sed 's|^> skills/||;s|/SKILL.md||'
diff <(git ls-tree -r --name-only github/main -- agents/ | sort) \
     <(git ls-tree -r --name-only origin/develop -- agents/ | sort) \
     | grep "^>" | sed 's|^> agents/||'
```

Present this summary. Ask the user to confirm before proceeding to Step 4.

## Step 4 — Merge develop → main

```
git checkout main
git pull --ff-only origin main          # sync local main
git merge --no-ff origin/develop -m "Release v<VERSION>: merge develop into main

<highlights bullet list — populate from Step 3 summary>"
```

If the merge has conflicts, ABORT and ask the user how to resolve.

## Step 5 — Bump version

Edit `.claude-plugin/plugin.json`: change the `version` field to the target version.

```
git commit -am "bump: plugin version to <VERSION>"
```

## Step 6 — Push main to both remotes

```
git push origin main
git push github main
```

`github` is the public mirror — pushing here makes the release visible to plugin consumers.

## Step 7 — Cherry-pick the version bump back to develop

So develop and main stay in sync on the version field:

```
git checkout develop
git pull --ff-only origin develop
git cherry-pick <bump-sha>
git push origin develop
```

(Do NOT push develop to github — github only hosts `main`.)

## Step 8 — Report

Print a one-paragraph release summary:

- Released version `<VERSION>` (from `<OLD VERSION>`).
- `<N>` commits merged from develop.
- `<M>` new skills, `<K>` new agents.
- main SHA on origin: `<sha>`, on github: `<sha>` (must match).
- develop SHA: `<sha>` (one commit ahead of main = the version bump cherry-pick).

## Important rules

- NEVER force-push to `main` or `develop`. If a regular push is rejected, STOP and ask the user.
- NEVER skip the github push — the GitHub mirror is the source of truth for plugin consumers.
- NEVER commit on `main` directly EXCEPT the version-bump commit in Step 5 (and the merge commit in Step 4).
- If any push fails, do NOT continue with later steps. State the failure and ask.
- `--remove-source-branch` is only relevant for `glab mr create` (MR-cleanup); the release flow does not create MRs.
- Tag creation is intentionally not part of this command — add manually if the team wants it.
