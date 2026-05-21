# Migrate Manual → Provisioned: Java Code — References

Lookup tables, flag-for-review detection rules, and the ConnectionLookup snippet referenced from `SKILL.md`. The SKILL document is the procedure; this file is the data the procedure operates on.

---

## Import renames (Step 3)

For every file now in `classes/` (both newly-converted and pre-existing Groovy), apply this exact-match replacement table to `import ...` lines (the trailing `;` may or may not be present after step 2a).

**Caveat:** the rewrite operates on raw text and **also touches commented-out imports** (`//import com.foo.Bar;`). This is harmless — the comment stays a comment — but it can be confusing if the file already has the active modern import on another line. After the rewrite pass, scan each file for **duplicate active import lines** (i.e. two non-commented `import X;` lines with the same fully-qualified name) and report them; do not remove duplicates automatically. Surfaced by `dieteren-integration` where `ProductsAggregationStrategy.java` had `// import org.apache.camel.processor.aggregate.AggregationStrategy;` (commented) alongside the active modern `import org.apache.camel.AggregationStrategy;`.

| Old import | New import |
|---|---|
| `import com.sun.jersey.api.client.GenericType` | `import jakarta.ws.rs.core.GenericType` |
| `import io.swagger.client.ApiClient` | `import net.pricefx.integration.api.ApiClient` |
| `import io.swagger.client.ApiException` | `import net.pricefx.integration.api.ApiException` |
| `import io.swagger.client.Pair` | `import net.pricefx.integration.api.Pair` |
| `import net.pricefx.integration.mapper.converter.Converter` | `import net.pricefx.integration.api.converter.Converter` |
| `import net.pricefx.integration.connection.PartitionConnectionFactory` | `import net.pricefx.integration.connection.service.ConnectionLookup` |
| `import net.pricefx.integration.api.client.ApiClientRequestBuilder` | (do NOT auto-rewrite — flag for review; the IMigrator's old mapping to `ApiResponse` was wrong because the classes are unrelated. The replacement depends on call-site intent: a request builder caller usually wants a different class than a response holder.) |
| `import org.apache.camel.processor.aggregate.AggregationStrategy` | `import org.apache.camel.AggregationStrategy` |
| `import net.pricefx.integration.component.producer.ProducerUtils` | `import net.pricefx.integration.util.ProducerUtils` |
| `import org.apache.commons.lang.Validate` | `import org.apache.commons.lang3.Validate` |
| `import org.apache.commons.lang.StringUtils` | `import org.apache.commons.lang3.StringUtils` |
| `import org.apache.commons.collections.MapUtils` | `import org.apache.commons.collections4.MapUtils` |
| `import org.apache.commons.collections.CollectionUtils` | `import org.apache.commons.collections4.CollectionUtils` |
| `import org.apache.commons.collections.ListUtils` | `import org.apache.commons.collections4.ListUtils` |
| `import org.apache.commons.collections.SetUtils` | `import org.apache.commons.collections4.SetUtils` |
| `import org.apache.commons.collections.` (any other) | `import org.apache.commons.collections4.` (same suffix) |
| `import org.springframework.beans.factory.annotation.Autowired` | (do NOT auto-rewrite — flag for review; in IM 7.x sandbox, prefer constructor injection or `connectionLookup`) |

Original IMigrator mapped `com.sun.jersey.api.client.GenericType` → `javax.ws.rs.core.GenericType`, but for IM 7.x (Spring Boot 3 / Jakarta EE 9) the new package is `jakarta.ws.rs.core.GenericType` — that's the form to use.

---

## Pricefx API method renames (Step 5)

Apply this exact-match replacement across all files now in `classes/`:

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

**These method renames change the parameter list as well as the name.** The textual rewrite produces code that compiles only if the parameter shape happens to match — usually it doesn't. Flag every rewritten call site as **REVIEW** in the report.

---

## Flag-for-review check: Legacy Pricefx API client imports (Step 5b)

The `net.pricefx.integration.api.client.*` package (including `PriceFxClient`, `FetchFilterBuilder`, `FilterCriteriaBuilder`, `FetchRequest`, `FetchResponse`, `FilterCriteria`, `Response`, `MassEditBuilder`, `FcResponse`, `FormulaExecuteRequest`, `MasseditRequest`, `MasseditResponse`, `ApiClientRequestBuilder`) was reorganised in IM 7.x. The package paths often moved to `net.pricefx.integration.api.client.builder.*` or `net.pricefx.integration.api.client.model.*` in IM 6, and again in IM 7. There is no single mechanical rewrite that holds across all IM versions, so:

- **Do NOT auto-rewrite.** Flag every import that starts with `net.pricefx.integration.api.client.` as **REVIEW**.
- Suggest the developer cross-check against the IM 7.x javadoc and replace with the correct types from `net.pricefx.integration.api.*`.

Likewise flag these other internal-Pricefx package roots that have shifted between IM lines (validated against `cargill-anh-tca-integration`):

- `net.pricefx.integration.command.*` (e.g. `Command`)
- `net.pricefx.integration.component.bean.*` (e.g. `Filter`)
- `net.pricefx.integration.filter.*` (e.g. `FilterConverter`)
- `net.pricefx.integration.util.ExpressionUtils`

These are all flag-for-review.

---

## Flag-for-review check: Apache HttpClient 4 (Step 5c)

Spring Boot 3 (IM 7.x baseline) replaced Apache HttpClient 4 with HttpClient 5. The package root changed from `org.apache.http.*` to `org.apache.hc.*` (with substantial API changes — not a pure rename).

- **Do NOT auto-rewrite** — the API differences require code changes, not just import renames.
- Flag every import starting with `org.apache.http.` as **REVIEW**, with the suggestion: "Migrate to `org.apache.hc.client5.*` / `org.apache.hc.core5.*`. The fluent API and connection-management classes changed significantly."

This was surfaced by `cargill-anh-tca-integration` where `AzureAuthentication.java` uses `CloseableHttpClient`, `HttpClientBuilder`, `BasicResponseHandler`, `UrlEncodedFormEntity`, `BasicNameValuePair` from HC4.

---

## Flag-for-review check: Class names that shadow Groovy auto-imports (Step 5d)

When a Java class name matches a type that Groovy auto-imports for every script, the converted `.groovy` class can cause subtle resolution bugs in inline `<groovy>` blocks elsewhere in the project. Groovy auto-imports include:

```
java.io.*       (File, FileInputStream, ...)
java.lang.*     (String, Integer, Exception, ...)
java.util.*     (List, Map, Set, Date, ...)
java.net.*      (URL, ...)
java.math.*     (BigDecimal, BigInteger)
groovy.lang.*
groovy.util.*
```

After conversion, scan the target `classes/` for any `.groovy` file whose **simple class name** matches a Groovy auto-imported type (e.g. `File`, `String`, `List`, `Map`, `Set`, `Date`, `Exception`, `URL`).

- **Do NOT rename automatically** — that would break every reference site.
- Flag for review: "Class `{name}` shadows the Groovy auto-imported `{auto-import-target}`. Inline `<groovy>` blocks that reference `{name}` unqualified will resolve to the auto-import, not your class. Consider renaming the class (e.g. `File` → `FileService`) or always using the fully-qualified name."

This was surfaced by `cargill-anh-tca-integration` where `net.pricefx.integration.cargill.service.File` shadows `java.io.File`.

---

## ConnectionLookup snippet (Step 6b)

When fixing the call sites flagged in Step 6a, the canonical IM 7.x replacement is:

```groovy
import org.apache.camel.spi.Registry
import net.pricefx.integration.connection.service.ConnectionLookup

Registry registry = exchange.getContext().getRegistry()
def client = ConnectionLookup.lookupPriceFx(registry, "pricefx").getClient()
```

Use `"pricefx"` for the default connection; for multi-partition projects, pull the connection name from a header (e.g. `exchange.getIn().getHeader("partitionPfxApi", String.class)`).

There is also a 2-arg overload `ConnectionLookup.lookupPriceFx(exchange, connectionName)` returning a `PriceFxConnection` if you need the connection object rather than just the client.

This is **report-only** — the developer must apply the fix manually because surrounding code (state, caching, exception handling) usually needs adjustment too.
