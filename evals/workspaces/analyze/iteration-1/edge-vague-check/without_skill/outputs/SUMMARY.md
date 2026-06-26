# Edge case: vague "Check my route." — clarifying question required (baseline)

**User prompt:** `Check my route.`

## Decision: did NOT produce a lint report

The prompt is too vague to act on. No file path, route ID, or XML content was provided, and fabricating a route to lint would be misleading.

## Clarifying question I would ask the user

1. **Which route?** Provide a file path (e.g. `src/main/resources/repo/routes/import-products.xml`), a route ID, or paste the XML inline.
2. **What kind of check?** "Check" is ambiguous in this plugin — possible intents:
   - **Lint / validate** — XML well-formedness, schema validation against `src/main/resources/schemas/pfx.xsd`, route-ID matches file name, property placeholders resolve.
   - **Anti-pattern scan** — detect patterns from `docs/anti-patterns.md` (AP-1..AP-34): Camel 3 → 4 renames, `noop=true`, missing archive/read-lock, redundant `connection=pricefx`.
   - **Behaviour review** — mapper wiring, businessKeys, batchedMode/split sizing, error handling, scheduling.
   - **Migration readiness** — manual-to-provisioned or IM 6.x → 7.x (Camel 3 → 4) upgrade check.

Once a path/XML and an intent are supplied, I can proceed.
