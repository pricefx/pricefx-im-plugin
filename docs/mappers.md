# Mapper Configuration Guide

Mappers define how input data fields are mapped to Pricefx object fields.

> **Format note:** This guide uses two XML syntaxes:
> - **Spring XML beans** (sections above "Mapper File Organization") — use `` namespace prefix, defined inside a `<beans>` wrapper in `camel-context.xml`
> - **Provisioned IM standalone files** (see "Mapper File Organization" section) — no `` prefix, no `<beans>` wrapper, one mapper per file under `mappers/`
>
> For all new integrations, use the **provisioned IM** format.

**XSD Schema:** `pricefx-integration/src/main/resources/schemas/pfx.xsd`

## Mapper Types

### `<loadMapper>` — For Loading Data

Used with `pfx-api:loaddata`. Replaces data in the target object.

```xml
<loadMapper id="productMapper">
    <body in="partNumber" out="sku"/>
    <body in="description" out="label"/>
    <body in="price" out="attribute1" converterExpression="stringToInteger"/>
</loadMapper>
```

### `<integrateMapper>` — For Upserting Data

Used with `pfx-api:integrate`. Inserts new records or updates existing ones. Supports predicates for conditional mapping.

```xml
<integrateMapper id="currencyMapper">
    <body in="name"/>
    <body in="value"/>
</integrateMapper>
```

With predicates (only on integrateMapper):

```xml
<integrateMapper id="conditionalMapper">
    <body in="status" out="attribute1" predicate="${body[status]} != null"/>
    <body in="priority" out="attribute2" predicateRef="myPredicateBean"/>
</integrateMapper>
```

### `<multilevelMapper>` — For Nested/Hierarchical Data

Used for multi-level data structures.

```xml
<multilevelMapper id="nestedMapper">
    <body in="parentField" out="parentField"/>
    <body in="childField" out="childField"/>
</multilevelMapper>
```

### `<mapper>` — Generic Mapper (Legacy)

Legacy mapper with explicit `type` attribute. Prefer `loadMapper` or `integrateMapper`.

```xml
<mapper id="myMapper" type="loaddata">
    <body in="field" out="field"/>
</mapper>
```

## Mapper Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `id` | Bean ID — referenced in route URIs (`mapper=myMapper`) | required |
| `includeUnmappedProperties` | Pass through unmapped fields as-is | `false` |
| `excludeProperties` | Comma-separated list of fields to exclude | — |
| `convertEmptyStringToNull` | Convert `""` to `null` | `false` |
| `skipInvalidRecords` | Skip records that fail mapping | `false` |

## Field Mapping Elements

### `<body>` — Map from message body field

Maps a field from the parsed input data (CSV row, JSON object, etc.).

```xml
<body in="sourceField" out="targetField"/>
```

When `out` is omitted, the input field name is used as output:

```xml
<body in="name"/>  <!-- equivalent to in="name" out="name" -->
```

### `<header>` — Map from Camel message header

```xml
<header in="CamelFileName" out="attribute1"/>
```

### `<property>` — Map from exchange property

```xml
<property in="myProperty" out="attribute2"/>
```

### `<constant>` — Set a constant value

```xml
<constant expression="FixedValue" out="name"/>
<constant expression="2024-01-01" out="validFrom"/>
```

### `<simple>` — Use Camel Simple expression

```xml
<simple expression="${date:now:yyyy-MM-dd}" out="loadDate"/>
<simple expression="${header.batchId}" out="batchRef"/>
```

### `<groovy>` — Use Groovy expression

For complex transformations. The `body` variable refers to the current record.

```xml
<groovy expression="body.Name" out="name"/>
<groovy expression="body.LastModifiedDate.split('\\.')[0]" out="lastModified"/>
<groovy expression="body.Price != null ? body.Price.toBigDecimal() : 0" out="attribute1"/>
<groovy expression="URLEncoder.encode(body.Id)" out="encodedId"/>
```

## Field Mapping Attributes

All field mapping elements (`body`, `header`, `property`) support:

| Attribute | Description |
|-----------|-------------|
| `in` | Source field name (required) |
| `out` | Target field name (defaults to `in` value) |
| `converter` | Converter bean name (registered Spring bean) |
| `converterExpression` | Built-in converter expression (see below) |
| `label` | Display label for the field |
| `description` | Field description |
| `format` | Date/number format pattern |
| `maxLength` | Maximum field length (truncates if exceeded) |
| `expression` | Optional expression for dynamic values |

Expression elements (`constant`, `simple`, `groovy`) support:

| Attribute | Description |
|-----------|-------------|
| `expression` | The expression to evaluate (required) |
| `out` | Target field name (required) |
| `converter` | Converter bean name |
| `label` | Display label |
| `description` | Field description |
| `format` | Date/number format pattern |
| `maxLength` | Maximum field length |

## Built-in Converter Expressions

Use via `converterExpression` attribute on field mappings:

| Expression | Description |
|------------|-------------|
| `stringToInteger` | Convert string to integer. Optional default: `stringToInteger('0')` |
| `stringToDecimal` | Convert string to BigDecimal. Optional locale/precision: `stringToDecimal(us,0,2)` |
| `stringToDecimalExtended` | Extended decimal conversion with more options |
| `stringToDouble` | Convert string to double |
| `stringToNumber` | Convert string to number |
| `stringToBoolean` | Convert string to boolean |
| `stringToDate` | Convert string to date |
| `stringToDateTime` | Convert string to datetime |
| `stringS4HANADateToDateTime` | Convert SAP S/4HANA date format to datetime |
| `dateToString` | Convert date to string (configurable format) |
| `dateTimeToString` | Convert datetime to string (configurable format) |
| `emptyStringToNull` | Convert empty strings to null |
| `numberToDouble` | Convert number to double |
| `negativeSAPStringToDecimal` | Convert SAP negative number format |
| `stringToPercentageTwoDecimalPlaces` | Convert string to percentage |

### Converter Expression Syntax

```
converterName
converterName('defaultValue')
converterName(locale,minFractionDigits,maxFractionDigits)
```

Examples:

```xml
<body in="price" out="attribute1" converterExpression="stringToInteger"/>
<body in="price" out="attribute1" converterExpression="stringToInteger('0')"/>
<body in="amount" out="attribute2" converterExpression="stringToDecimal(us,0,2)"/>
<body in="date" out="attribute3" converter="dateToString"/>
```

## Using `converter` vs `converterExpression`

- **`converterExpression`** — references a built-in converter by name with optional inline parameters. Preferred for standard conversions.
- **`converter`** — references a Spring bean name. Use when you need a custom-configured converter bean.

```xml
<!-- converterExpression: inline, uses built-in -->
<body in="price" out="attribute1" converterExpression="stringToDecimal(us,0,2)"/>

<!-- converter: references a bean -->
<body in="date" out="attribute3" converter="dateToString"/>
```

## Complete Examples

### CSV Product Load Mapper

```xml
<loadMapper id="productMasterDataMapper">
    <body in="partNumber"        out="sku"/>
    <body in="description"       out="label"/>
    <body in="uom"               out="attribute1"/>
    <body in="pricingType"       out="attribute2"/>
    <body in="status"            out="attribute4"/>
    <body in="price"             out="attribute5" converterExpression="stringToDecimal"/>
    <constant expression="ProductSync" out="name"/>
</loadMapper>
```

### Salesforce JSON Mapper (Groovy Expressions)

```xml
<loadMapper id="customerSFDCDataMapper">
    <groovy expression="body.Name"            out="name"/>
    <groovy expression="body.Id"              out="customerId"/>
    <groovy expression="body.Segment__c"      out="attribute1"/>
    <groovy expression="body.Country__c"      out="attribute9"/>
    <groovy expression="body.Active_Flag__c"  out="attribute23"/>
</loadMapper>
```

### Include Unmapped Properties

When `includeUnmappedProperties="true"`, all source fields pass through as-is. Only explicitly mapped fields are transformed.

```xml
<loadMapper id="passThroughMapper" includeUnmappedProperties="true">
    <constant expression="SyncName" out="name"/>
</loadMapper>
```

### Condition Records Mapper

```xml
<loadMapper id="conditionRecordsMapper">
    <constant expression="myConditionSet" out="conditionRecordSetName"/>
    <body in="key1" out="key1"/>
    <body in="validFrom" out="validFrom"/>
    <body in="validTo" out="validTo"/>
    <body in="conditionValue" out="conditionValue"/>
    <body in="currency" out="currency"/>
</loadMapper>
```

## Mapper File Organization (Provisioned IM)

In provisioned IM, mappers live in **standalone files** under `mappers/`. Each file uses a `<mappers>` root element (no `` namespace prefix, no `<?xml>` declaration):

```xml
<mappers>
    <loadMapper id="import-products.mapper">
        <body in="partNumber" out="sku"/>
        <body in="price" out="attribute1" converterExpression="stringToDecimal"/>
    </loadMapper>
</mappers>
```

**Naming rules:**
- File: `mappers/{descriptive-name}.mapper.xml`
- The `id` attribute **must match the file name** without `.mapper.xml` extension.
  - File `import-products.mapper.xml` → `id="import-products.mapper"`
  - A mismatched ID causes deployment failure — IM cannot load the mapper.
- Reference in route: `mapper=import-products.mapper`

**PX / CX mappers must include the table name as a constant:**

```xml
<loadMapper id="import-prices.mapper">
    <constant expression="Prices" out="name"/>  <!-- required: sets extension table name -->
    <body in="sku" out="sku"/>
    <body in="price" out="attribute1" converterExpression="stringToDecimal"/>
</loadMapper>
```

Without `<constant ... out="name"/>`, the PX/CX import will fail or write to the wrong table.
