---
name: upgrade-assistant
description: Analyze an IM project for compatibility with a target IM version. Identifies breaking changes, deprecated patterns, and required migrations. Use when the user says "upgrade to version X", "check compatibility", "what breaks if I upgrade", "migration guide".
---

# Upgrade Assistant

Analyze the current IM project for compatibility with a target Integration Manager version. Identify breaking changes, deprecated patterns, and required migrations. Generate a prioritized checklist.

## Step 1: Read Current Version

Read `pom.xml` and extract the `pricefx-integration-manager.version` property.

```bash
grep -m1 'pricefx-integration-manager.version' pom.xml
```

Display the detected version to the user.

## Step 2: Determine Target Version

If `$ARGUMENTS` contains a version (e.g., "7.x", "7.3.0"), use it as the target.
Otherwise ask: **What version of Integration Manager are you upgrading to?** (Default: latest 7.x)

## Step 3: Version Compatibility Matrix

| From | To | Java | Spring Boot | Camel | Key Risk |
|------|-----|------|-------------|-------|----------|
| 5.x | 6.x | 11 → 17 | 2.x → 3.x | 3.x | javax → jakarta, connection format |
| 6.x | 7.x | 17 | 3.x | 3.x → 4.x | Route builder API, property syntax, pfx-api changes |
| 7.x | 7.x | 17 | 3.x | 4.x | Minor — check release notes for deprecations |

Identify the migration path from current to target and which breaking-change sets apply.

## Step 4: Scan Project Files

Search the project for affected patterns based on the migration path.

### IM 5.x → 6.x scans

**Java/Groovy namespace migration (javax → jakarta):**
```bash
grep -r "import javax\." src/ --include="*.java" --include="*.groovy" -l
grep -r "import javax\." src/ --include="*.java" --include="*.groovy"
```

**Old connection JSON format** (pre-6.x used a different structure):
```bash
find src/main/resources/repo/config -name "*.json" | xargs grep -l "connectionType" 2>/dev/null
```

**Java version in pom.xml:**
```bash
grep -E 'java.version|maven.compiler.source|maven.compiler.target' pom.xml
```

### IM 6.x → 7.x scans

**Camel 3.x route builder patterns deprecated in Camel 4.x:**
```bash
grep -r "org\.apache\.camel\.builder\." src/ --include="*.java" --include="*.groovy" -l
grep -r "\.from\(\"" src/ --include="*.java" --include="*.groovy"
```

**Old property placeholder syntax** (`${` in property files vs new `{{` in routes):
```bash
grep -rn '\$\{' src/main/resources/repo/routes/ --include="*.xml"
```

**pfx-api endpoint parameter changes:**
```bash
grep -rn "pfx-api:" src/main/resources/repo/routes/ --include="*.xml"
```

**Deprecated Camel Simple/Groovy expressions:**
```bash
grep -rn "org\.apache\.camel\.language" src/ --include="*.java" --include="*.groovy"
```

**Old streaming API patterns:**
```bash
grep -rn "pfx-csv:unmarshal" src/main/resources/repo/routes/ --include="*.xml"
grep -rn "pfx-csv:streamingUnmarshal" src/main/resources/repo/routes/ --include="*.xml"
```

## Step 5: Analyze Results and Generate Checklist

Based on scan findings, generate a migration checklist grouped by priority.

### Output format

```
## Upgrade Report: IM {current} → IM {target}

### Version Compatibility Summary

| Area             | Current         | Required for {target} | Status |
|------------------|-----------------|------------------------|--------|
| Java             | {detected}      | 17+                    | ✅ / ❌ |
| Spring Boot      | {detected}      | 3.x                    | ✅ / ❌ |
| Camel            | {detected}      | 4.x                    | ✅ / ❌ |
| javax → jakarta  | {found Y/N}     | Migrated               | ✅ / ❌ |

---

### MUST-FIX (Breaks at runtime without these changes)

- [ ] **javax → jakarta namespace** — {N} files affected: [list files]
  - Replace all `import javax.` with `import jakarta.` in custom Java/Groovy classes
- [ ] **Java version** — pom.xml specifies Java {X}, minimum is Java 17
  - Update `java.version` to `17` in pom.xml
- [ ] **Connection format** — {N} connection files use old format
  - Migrate to new connection JSON structure (see IM 6.x migration guide)

### SHOULD-FIX (Deprecated, will break in a future version)

- [ ] **Old property syntax** — {N} occurrences of `${...}` in route XML
  - Replace with Camel property placeholder `{{...}}` syntax
- [ ] **Camel 3.x Java DSL** — {N} files use deprecated Java route builder patterns
  - Review and update to Camel 4.x DSL (or migrate to XML routes)

### OPTIONAL (Improvements available in {target})

- [ ] **Streaming API** — routes using `pfx-csv:unmarshal` can be upgraded to `pfx-csv:streamingUnmarshal`
  - Reduces memory usage for large file imports
- [ ] **New pfx-api parameters** — review updated endpoint parameters for performance gains

---

### Files Requiring Changes

| File | Issue | Priority |
|------|-------|----------|
| {path} | {description} | MUST-FIX |
```

## Step 6: Offer Auto-Fix for Safe Changes

After displaying the checklist, ask:

**Would you like me to auto-fix any safe changes?**

Available auto-fixes:
1. **javax → jakarta** — Rename imports in Java/Groovy files (safe, mechanical replacement)
2. **Property syntax** — Replace `${placeholder}` with `{{placeholder}}` in route XML (review each one first)

If the user agrees, perform the replacements and show a diff summary.

For `javax → jakarta`:
```bash
find src/ -name "*.java" -o -name "*.groovy" | xargs sed -i 's/import javax\./import jakarta\./g'
```

Always show what was changed before and after. Never modify route XML automatically without user confirmation.
