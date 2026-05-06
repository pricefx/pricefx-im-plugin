---
name: migrate-manual-to-provisioned-java-code
description: Migrate Java and Groovy files in a manual IM project to the IM 7.x package layout — fix package renames in `import` statements (com.sun.jersey, io.swagger.client, commons-lang, AggregationStrategy, ProducerUtils), rename Pricefx Java API method signatures, and rewrite javax.* → jakarta.* across all Java/Groovy sources.
---

# Migrate Manual → Provisioned: Java & Groovy Code

You are migrating Java and Groovy custom code (beans, processors, predicates) to the IM 7.x package and method-signature shape. These are mechanical search-and-replace operations.

## Inputs

- **SOURCE_DIR** — original manual project (read-only, optional — apply to TARGET if files have already been copied)
- **TARGET_DIR** — current working directory (provisioned project, files modified here)

If `$TARGET_DIR/src/main/java/` and `$TARGET_DIR/src/main/resources/repo/classes/` are empty and the source has Java/Groovy files, ask the user whether to copy them first. Default to **yes**: copy the source `*.java` and `*.groovy` files into the equivalent target paths, then apply the rewrites.

## Step 1: Fix Imports

Walk every `*.java` and `*.groovy` file in the target. Apply this exact-match replacement table to `import ...;` lines:

| Old import | New import |
|---|---|
| `import com.sun.jersey.api.client.GenericType;` | `import javax.ws.rs.core.GenericType;` |
| `import io.swagger.client.ApiClient;` | `import net.pricefx.integration.api.ApiClient;` |
| `import io.swagger.client.ApiException;` | `import net.pricefx.integration.api.ApiException;` |
| `import io.swagger.client.Pair;` | `import net.pricefx.integration.api.Pair;` |
| `import net.pricefx.integration.mapper.converter.Converter;` | `import net.pricefx.integration.api.converter.Converter;` |
| `import net.pricefx.integration.connection.PartitionConnectionFactory;` | `import net.pricefx.integration.connection.service.ConnectionLookup;` |
| `import net.pricefx.integration.api.client.ApiClientRequestBuilder;` | `import net.pricefx.integration.api.ApiResponse;` |
| `import org.apache.camel.processor.aggregate.AggregationStrategy;` | `import org.apache.camel.AggregationStrategy;` |
| `import net.pricefx.integration.component.producer.ProducerUtils;` | `import net.pricefx.integration.util.ProducerUtils;` |
| `import org.apache.commons.lang.Validate;` | `import org.apache.commons.lang3.Validate;` |
| `import org.apache.commons.lang.StringUtils;` | `import org.apache.commons.lang3.StringUtils;` |

## Step 2: javax → jakarta

Apply globally across all Java/Groovy files in TARGET:

```
import javax.   →   import jakarta.
```

This is the Spring Boot 3.x / Jakarta EE 9 namespace migration. Required for IM 7.x.

**Caveat:** Some `javax.*` packages did **not** move to Jakarta (e.g. `javax.sql`, `javax.crypto`, `javax.security.auth`, `javax.xml.transform`, `javax.naming`, `javax.management`). After the bulk replacement, scan for these specific packages and revert any erroneous rewrite:

| Keep as `javax.*` (do NOT rewrite) |
|---|
| `javax.sql.*` |
| `javax.crypto.*` |
| `javax.security.auth.*` |
| `javax.xml.transform.*`, `javax.xml.parsers.*`, `javax.xml.stream.*` |
| `javax.naming.*` |
| `javax.management.*` |
| `javax.net.ssl.*` |

Strategy: do the bulk replace, then revert specific lines. Ask the user before reverting if uncertain.

## Step 3: Pricefx API Method Signature Renames

Apply this exact-match replacement across all Java/Groovy files. These are method-name changes in IM 7.x:

| Old call | New call |
|---|---|
| `.getDatamartApi().getdataloads(` | `.getDatamartApi().datamartGetdataloads(` |
| `.getGeneralApi().asyncForcefilter(` | `.getGeneralApi().deleteAsyncBatchTypecode(` |
| `.getGeneralApi().fetchByTypeCode(` | `.getGeneralApi().fetchByTypeCodeTypecode(` |
| `.getFormulaApi().executeformula(` | `.getFormulaApi().formulamanagerExecuteformulaFormulaname(` |
| `.getDatamartApi().massedit(` | `.getDatamartApi().datamartMasseditTypeid(` |
| `.getDatamartApi().getfcs(` | `.getDatamartApi().datamartGetfcsFCtype(` |
| `.getLookuptableApi().fetchTable(` | `.getLookuptableApi().lookuptablemanagerFetchTable(` |
| `.getContractApi().save(` | `.getContractApi().contractmanagerSave(` |
| `.getDatamartApi().fetch(` | `.getDatamartApi().datamartFetchObjectid(` |
| `.getLookuptableApi().fetchValue(` | `.getLookuptableApi().lookuptablemanagerFetchValueTableid(` |
| `.getLookuptableApi().integrate(` | `.getLookuptableApi().lookuptablemanagerIntegrateTableid(` |
| `.getGeneralApi().loaddata(` | `.getGeneralApi().loaddataTypecode(` |
| `.getContractApi().fetch(` | `.getContractApi().contractmanagerFetchContractid(` |
| `.getPricegridApi().updupdateItems(` | `.getPricegridApi().pricegridmanagerUpdateItemsPGid(` |
| `.getPricegridApi().fetchItems(` | `.getPricegridApi().pricegridmanagerFetchItemsPGid(` |

**Note:** Some of these renames change the method's parameter list as well as the name. Do not assume the call site still compiles after the textual rewrite — it must be reviewed and possibly fixed. Flag every rewritten call site in the report so the developer knows to check it.

## Step 4: Manual-Action Hint — PartitionConnectionFactory

Search for `PartitionConnectionFactory.getPriceFxClient` in any Java/Groovy file. This API is gone in IM 7.x. Report the affected files with the suggestion:

> Replace `PartitionConnectionFactory.getPriceFxClient(...)` with `ConnectionLookup.lookupPriceFx(...).getClient()`. The argument list also changes — refer to the IM 7.x ConnectionLookup javadoc.

Do not auto-fix this — the call shape changes meaningfully.

## Step 5: Report

```
Java/Groovy code migration summary
==================================

Imports rewritten:
  - com.sun.jersey → javax.ws.rs:        N file(s)
  - io.swagger.client → net.pricefx.api: N file(s)
  - commons-lang → commons-lang3:        N file(s)
  - AggregationStrategy package:         N file(s)
  - ProducerUtils package:               N file(s)
  - PartitionConnectionFactory→Lookup:   N file(s)
  - other:                               N file(s)

javax.* → jakarta.*:                    N file(s) (M lines reverted as platform stayed on javax)

Pricefx API method renames:
  - .getDatamartApi().fetch(...):        N call site(s) — REVIEW: parameter shape changed
  - .getGeneralApi().loaddata(...):      N call site(s) — REVIEW: parameter shape changed
  - ... (one line per renamed method)

Manual action required:
  - PartitionConnectionFactory.getPriceFxClient: [files]
```

## Rules

- **Always confirm before applying** — show affected files first.
- API method renames produce code that compiles only if the parameter list still matches. Always flag them as **REVIEW** in the report.
- Do not invent renames — only apply the ones in the table above.
- Run this skill **after** the version bump in `pom.xml` so any compile feedback you get is for the new IM version.
