# Pricefx Integration Manager — Filters

Filters are used with `pfx-api:fetch` and `pfx-api:delete` to select which records to process. They are defined in separate XML files in `src/main/resources/repo/filters/`.

## Filter File Structure

```xml
<filter id="{route-name}.filter"
        sortBy="{field-name}"
        resultFields="{comma-separated-fields}">
    <and>
        <criterion fieldName="{field}" operator="{operator}" value="{value}"/>
    </and>
</filter>
```

### Filter Attributes

| Attribute | Description |
|---|---|
| `id` | Must match file name without `.xml` (e.g., file `export-products.filter.xml` → `id="export-products.filter"`) |
| `sortBy` | Field to sort results by (e.g., `lastUpdateDate`, `sku`, `attribute1`) |
| `resultFields` | Comma-separated list of fields to return (e.g., `sku,attribute1,attribute2`) |

## Available Operators

### Comparison Operators

| Operator | Description | Value Example |
|---|---|---|
| `equals` | Exact match | `value="Active"` |
| `notEqual` | Not equal to | `value="Inactive"` |
| `greaterThan` | Greater than (numbers, dates) | `value="100"` |
| `greaterOrEqual` | Greater than or equal to | `value="100"` |
| `lessThan` | Less than | `value="200"` |
| `lessOrEqual` | Less than or equal to | `value="200"` |
| `between` | Value in range (exclusive) | `value="100;200"` |
| `betweenInclusive` | Value in range (inclusive) | `value="100;200"` |

### String Operators (case-sensitive)

| Operator | Description | Value Example |
|---|---|---|
| `contains` | String contains substring | `value="test"` |
| `notContains` | String does not contain | `value="test"` |
| `startsWith` | String starts with | `value="ABC"` |
| `notStartsWith` | String does not start with | `value="ABC"` |
| `endsWith` | String ends with | `value="XYZ"` |
| `notEndsWith` | String does not end with | `value="XYZ"` |

### String Operators (case-insensitive, prefix `i`)

| Operator | Description | Value Example |
|---|---|---|
| `iEqual` | Case-insensitive equals | `value="active"` |
| `iNotEqual` | Case-insensitive not equal | `value="inactive"` |
| `iContains` | Case-insensitive contains | `value="test"` |
| `iNotContains` | Case-insensitive not contains | `value="test"` |
| `iStartsWith` | Case-insensitive starts with | `value="abc"` |
| `iNotStartsWith` | Case-insensitive not starts with | `value="abc"` |
| `iEndsWith` | Case-insensitive ends with | `value="xyz"` |
| `iNotEndsWith` | Case-insensitive not ends with | `value="xyz"` |

### Null Operators

| Operator | Description |
|---|---|
| `isNull` | Field is empty/null (no `value` needed) |
| `notNull` | Field is not empty/null (no `value` needed) |

### Set Operators

| Operator | Description | Value Example |
|---|---|---|
| `inSet` | Value is in comma-separated list | `value="A,B,C"` |
| `notInSet` | Value is not in list | `value="X,Y,Z"` |

## Logical Combinations

### AND — all conditions must match

```xml
<filter id="my-filter" sortBy="sku" resultFields="sku,attribute1">
    <and>
        <criterion fieldName="attribute10" operator="equals" value="Active"/>
        <criterion fieldName="attribute9" operator="greaterOrEqual" value="100"/>
    </and>
</filter>
```

### OR — at least one condition must match

```xml
<filter id="my-filter" sortBy="sku" resultFields="sku,attribute1">
    <or>
        <criterion fieldName="attribute6" operator="equals" value="TypeA"/>
        <criterion fieldName="attribute6" operator="equals" value="TypeB"/>
    </or>
</filter>
```

### Nested logic — AND/OR combinations

```xml
<filter id="my-filter" sortBy="sku" resultFields="sku,attribute1">
    <and>
        <criterion fieldName="attribute10" operator="equals" value="Active"/>
        <or>
            <criterion fieldName="attribute6" operator="equals" value="TypeA"/>
            <criterion fieldName="attribute6" operator="equals" value="TypeB"/>
        </or>
    </and>
</filter>
```

## Dynamic Values

Use the `simple:` prefix to reference Camel headers or expressions in filter values:

```xml
<criterion fieldName="lastUpdateDate" operator="greaterThan" value="simple:${headers.lastExportTimestamp}"/>
```

This is commonly used in delta sync patterns to filter records modified since the last run.

## PX/CX Extension Table Filter

When fetching from PX or CX, you **must** include a `name` criterion to specify which extension table to query:

```xml
<filter id="export-px-prices.filter"
        sortBy="lastUpdateDate"
        resultFields="sku,attribute1,attribute2,attribute3">
    <and>
        <criterion fieldName="name" operator="equals" value="Prices"/>
        <!-- additional criteria here -->
    </and>
</filter>
```

For P (Product), C (Customer), and DS (Data Source), the `name` criterion is not needed.

## Common Patterns

### Filter by status

```xml
<criterion fieldName="attribute10" operator="equals" value="Active"/>
```

### Filter by numeric range

```xml
<criterion fieldName="attribute9" operator="greaterOrEqual" value="100"/>
<criterion fieldName="attribute9" operator="lessOrEqual" value="200"/>
```

Or using `betweenInclusive`:

```xml
<criterion fieldName="attribute9" operator="betweenInclusive" value="100;200"/>
```

### Filter by non-empty field

```xml
<criterion fieldName="attribute5" operator="notNull"/>
```

### Filter by date range

```xml
<criterion fieldName="attribute13" operator="greaterOrEqual" value="2025-01-01"/>
<criterion fieldName="attribute13" operator="lessThan" value="2026-01-01"/>
```

### Filter by list of values

```xml
<criterion fieldName="attribute2" operator="inSet" value="AUTO,DIST,RETAIL"/>
```

### Case-insensitive string match

```xml
<criterion fieldName="attribute1" operator="iContains" value="widget"/>
```

### Delta sync filter (only changed records)

```xml
<criterion fieldName="lastUpdateDate" operator="greaterThan" value="simple:${headers.lastExportTimestamp}"/>
<criterion fieldName="lastUpdateDate" operator="lessOrEqual" value="simple:${headers.currentExportTimestamp}"/>
```
