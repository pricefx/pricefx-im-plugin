# Mapper Configuration Guide

Mappers define how input data fields are mapped to Pricefx object fields. They are defined as XML beans using the `pfx` namespace.

**XSD Schema:** `pricefx-integration/src/main/resources/schemas/pfx.xsd`

## Mapper Types

### `<pfx:loadMapper>` — For Loading Data

Used with `pfx-api:loaddata`. Replaces data in the target object.

```xml
<pfx:loadMapper id="productMapper">
    <pfx:body in="partNumber" out="sku"/>
    <pfx:body in="description" out="label"/>
    <pfx:body in="price" out="attribute1" converterExpression="stringToInteger"/>
</pfx:loadMapper>
```

### `<pfx:integrateMapper>` — For Upserting Data

Used with `pfx-api:integrate`. Inserts new records or updates existing ones. Supports predicates for conditional mapping.

```xml
<pfx:integrateMapper id="currencyMapper">
    <pfx:body in="name"/>
    <pfx:body in="value"/>
</pfx:integrateMapper>
```

With predicates (only on integrateMapper):

```xml
<pfx:integrateMapper id="conditionalMapper">
    <pfx:body in="status" out="attribute1" predicate="${body[status]} != null"/>
    <pfx:body in="priority" out="attribute2" predicateRef="myPredicateBean"/>
</pfx:integrateMapper>
```

### `<pfx:multilevelMapper>` — For Nested/Hierarchical Data

Used for multi-level data structures.

```xml
<pfx:multilevelMapper id="nestedMapper">
    <pfx:body in="parentField" out="parentField"/>
    <pfx:body in="childField" out="childField"/>
</pfx:multilevelMapper>
```

### `<pfx:mapper>` — Generic Mapper (Legacy)

Legacy mapper with explicit `type` attribute. Prefer `loadMapper` or `integrateMapper`.

```xml
<pfx:mapper id="myMapper" type="loaddata">
    <pfx:body in="field" out="field"/>
</pfx:mapper>
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

### `<pfx:body>` — Map from message body field

Maps a field from the parsed input data (CSV row, JSON object, etc.).

```xml
<pfx:body in="sourceField" out="targetField"/>
```

When `out` is omitted, the input field name is used as output:

```xml
<pfx:body in="name"/>  <!-- equivalent to in="name" out="name" -->
```

### `<pfx:header>` — Map from Camel message header

```xml
<pfx:header in="CamelFileName" out="attribute1"/>
```

### `<pfx:property>` — Map from exchange property

```xml
<pfx:property in="myProperty" out="attribute2"/>
```

### `<pfx:constant>` — Set a constant value

```xml
<pfx:constant expression="FixedValue" out="name"/>
<pfx:constant expression="2024-01-01" out="validFrom"/>
```

### `<pfx:simple>` — Use Camel Simple expression

```xml
<pfx:simple expression="${date:now:yyyy-MM-dd}" out="loadDate"/>
<pfx:simple expression="${header.batchId}" out="batchRef"/>
```

### `<pfx:groovy>` — Use Groovy expression

For complex transformations. The `body` variable refers to the current record.

```xml
<pfx:groovy expression="body.Name" out="name"/>
<pfx:groovy expression="body.LastModifiedDate.split('\\.')[0]" out="lastModified"/>
<pfx:groovy expression="body.Price != null ? body.Price.toBigDecimal() : 0" out="attribute1"/>
<pfx:groovy expression="URLEncoder.encode(body.Id)" out="encodedId"/>
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
<pfx:body in="price" out="attribute1" converterExpression="stringToInteger"/>
<pfx:body in="price" out="attribute1" converterExpression="stringToInteger('0')"/>
<pfx:body in="amount" out="attribute2" converterExpression="stringToDecimal(us,0,2)"/>
<pfx:body in="date" out="attribute3" converter="dateToString"/>
```

## Using `converter` vs `converterExpression`

- **`converterExpression`** — references a built-in converter by name with optional inline parameters. Preferred for standard conversions.
- **`converter`** — references a Spring bean name. Use when you need a custom-configured converter bean.

```xml
<!-- converterExpression: inline, uses built-in -->
<pfx:body in="price" out="attribute1" converterExpression="stringToDecimal(us,0,2)"/>

<!-- converter: references a bean -->
<pfx:body in="date" out="attribute3" converter="dateToString"/>
```

## Complete Examples

### CSV Product Load Mapper

```xml
<pfx:loadMapper id="productMasterDataMapper">
    <pfx:body in="partNumber"        out="sku"/>
    <pfx:body in="description"       out="label"/>
    <pfx:body in="uom"               out="attribute1"/>
    <pfx:body in="pricingType"       out="attribute2"/>
    <pfx:body in="status"            out="attribute4"/>
    <pfx:body in="price"             out="attribute5" converterExpression="stringToDecimal"/>
    <pfx:constant expression="ProductSync" out="name"/>
</pfx:loadMapper>
```

### Salesforce JSON Mapper (Groovy Expressions)

```xml
<pfx:loadMapper id="customerSFDCDataMapper">
    <pfx:groovy expression="body.Name"            out="name"/>
    <pfx:groovy expression="body.Id"              out="customerId"/>
    <pfx:groovy expression="body.Segment__c"      out="attribute1"/>
    <pfx:groovy expression="body.Country__c"      out="attribute9"/>
    <pfx:groovy expression="body.Active_Flag__c"  out="attribute23"/>
</pfx:loadMapper>
```

### Include Unmapped Properties

When `includeUnmappedProperties="true"`, all source fields pass through as-is. Only explicitly mapped fields are transformed.

```xml
<pfx:loadMapper id="passThroughMapper" includeUnmappedProperties="true">
    <pfx:constant expression="SyncName" out="name"/>
</pfx:loadMapper>
```

### Condition Records Mapper

```xml
<pfx:loadMapper id="conditionRecordsMapper">
    <pfx:constant expression="myConditionSet" out="conditionRecordSetName"/>
    <pfx:body in="key1" out="key1"/>
    <pfx:body in="validFrom" out="validFrom"/>
    <pfx:body in="validTo" out="validTo"/>
    <pfx:body in="conditionValue" out="conditionValue"/>
    <pfx:body in="currency" out="currency"/>
</pfx:loadMapper>
```

## Mapper File Organization (Provisioned IM)

In provisioned IM, mappers live in **standalone files** under `mappers/`. Each file uses a `<mappers>` root element (no `pfx:` namespace prefix, no `<?xml>` declaration):

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
