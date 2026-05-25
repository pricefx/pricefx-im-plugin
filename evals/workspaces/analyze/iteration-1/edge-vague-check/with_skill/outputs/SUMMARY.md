# Edge case: vague "Check my route." — clarifying question required

**User prompt:** `Check my route.`

## Verdict: too vague — no route file path supplied

## Decision: did NOT produce a lint report for an arbitrary/made-up route file

Per `skills/analyze/SKILL.md` Step 1: *"If the user specified a route file, read it directly. Otherwise ask: **Which route file should I analyze?** (look in `src/main/resources/repo/routes/`)."* The user prompt supplies no file path, so the correct behaviour is to ask, not to lint an arbitrary file.

## Clarifying question I would ask

> Which route file should I analyze? Please give me the file name (or full path) of the route under `src/main/resources/repo/routes/`. For example: `import-products.xml` or `export-customers.xml`. If you are not sure which routes exist, I can list the files in that directory first.

## Rationale

- SKILL.md Step 1 mandates either reading a user-specified file or asking which file to analyze.
- The skill operates on one specific route file at a time and must not guess or fabricate a lint report against a made-up file.
- Route-type detection in Step 2 and all subsequent checks require an actual file's `<from>` URI, route id, mapper, and filter.

## Next steps once the user names a file

1. Read `src/main/resources/repo/routes/<filename>.xml` in full.
2. Read referenced mapper (`mappers/`) and filter (`filters/`) files.
3. Detect route type per Step 2.
4. Run all applicable checks (N-1..AP-3) and emit the QUALITY REPORT table from Step 4.
5. Provide fix recipes for FAIL/WARN items per Step 5 and ask before applying any edit.
