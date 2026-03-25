#!/usr/bin/env node

import { Command } from "commander";
import { PricefxClient } from "../lib/client.mjs";
import { getConnectionConfig } from "../lib/config.mjs";
import { formatMetadataTable, formatAttributeMetaTable, printTable, printResponsiveTable, printBoxTable, printTransposedBoxTable, printMarkdownTable } from "../lib/formatters.mjs";

const program = new Command();

program
  .name("pfx")
  .description("CLI for Pricefx REST API")
  .version("1.0.0")
;

// --- product-extensions ---
program
  .command("product-extensions")
  .description("List all Product Extension (PX) tables")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const extensions = await client.listProductExtensions();

      if (opts.json) {
        console.log(JSON.stringify(extensions, null, 2));
      } else {
        printExtensionTable(extensions, "product");
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- customer-extensions ---
program
  .command("customer-extensions")
  .description("List all Customer Extension (CX) tables")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const extensions = await client.listCustomerExtensions();

      if (opts.json) {
        console.log(JSON.stringify(extensions, null, 2));
      } else {
        printExtensionTable(extensions, "customer");
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- product-extension <name> (singular) ---
program
  .command("product-extension <name>")
  .description("Show metadata for a Product Extension (PX) table")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const result = await client.fetchMetadata("PX", name);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const rows = formatMetadataTable(result);
        if (typeof rows === "string") {
          console.log(rows);
        } else {
          printTable(rows);
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- customer-extension <name> (singular) ---
program
  .command("customer-extension <name>")
  .description("Show metadata for a Customer Extension (CX) table")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const result = await client.fetchMetadata("CX", name);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const rows = formatMetadataTable(result);
        if (typeof rows === "string") {
          console.log(rows);
        } else {
          printTable(rows);
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- product-metadata ---
program
  .command("product-metadata")
  .description("Show Product (P) attribute metadata")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const data = await client.fetchProductAttributeMeta();
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        const rows = formatAttributeMetaTable(data);
        if (typeof rows === "string") {
          console.log(rows);
        } else {
          printTable(rows);
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- product-extension-metadata <name> ---
program
  .command("product-extension-metadata <name>")
  .description("Show attribute metadata for a Product Extension (PX) table")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const data = await client.fetchProductExtensionAttributeMeta(name);
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        const rows = formatAttributeMetaTable(data);
        if (typeof rows === "string") {
          console.log(rows);
        } else {
          printTable(rows);
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- customer-extension-metadata <name> ---
program
  .command("customer-extension-metadata <name>")
  .description("Show attribute metadata for a Customer Extension (CX) table")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const data = await client.fetchExtensionAttributeMeta("customer", name);
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        const rows = formatAttributeMetaTable(data);
        if (typeof rows === "string") {
          console.log(rows);
        } else {
          printTable(rows);
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- create-product-extension ---
program
  .command("create-product-extension <name>")
  .description("Create a new Product Extension (PX) table")
  .option("--label <label>", "Display label")
  .option("--attributes <n>", "Number of attributes", parseInt, 10)
  .option("--json", "Output raw JSON")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const result = await client.createExtension("product", name, {
        label: opts.label,
        numberOfAttributes: opts.attributes,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Product extension "${name}" created.`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- create-customer-extension ---
program
  .command("create-customer-extension <name>")
  .description("Create a new Customer Extension (CX) table")
  .option("--label <label>", "Display label")
  .option("--attributes <n>", "Number of attributes", parseInt, 10)
  .option("--json", "Output raw JSON")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const result = await client.createExtension("customer", name, {
        label: opts.label,
        numberOfAttributes: opts.attributes,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Customer extension "${name}" created.`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- set-attribute ---
const FIELD_TYPES = {
  REAL: 1, FLOAT: 1,
  STRING: 2, TEXT: 2,
  INTEGER: 3, INT: 3,
  DATE: 4,
  DATETIME: 5,
  LINK: 6,
  ENTITY_REFERENCE: 8,
  BOOLEAN: 9,
};

program
  .command("set-attribute <kind> <extensionName> <fieldName>")
  .description("Set attribute metadata on a PX or CX extension (kind: PX or CX)")
  .option("--label <label>", "Display label")
  .option("--type <type>", "Field type: STRING, REAL, INTEGER, DATE, DATETIME, BOOLEAN, LINK")
  .option("--format <format>", "Format type: TEXT, NUMERIC, MONEY, PERCENT, DATE, DATETIME, INTEGER, LINK")
  .option("--json", "Output raw JSON")
  .action(async (kind, extensionName, fieldName, opts) => {
    try {
      const k = kind.toUpperCase();
      if (k !== "PX" && k !== "CX") {
        throw new Error('Kind must be "PX" or "CX".');
      }
      const type = k === "PX" ? "product" : "customer";
      const fieldType = opts.type ? FIELD_TYPES[opts.type.toUpperCase()] : undefined;
      if (opts.type && fieldType === undefined) {
        throw new Error(`Unknown field type "${opts.type}". Valid: ${Object.keys(FIELD_TYPES).join(", ")}`);
      }
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const result = await client.setAttribute(type, extensionName, fieldName, {
        label: opts.label,
        fieldType,
        formatType: opts.format?.toUpperCase(),
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Attribute "${fieldName}" on ${k} "${extensionName}" updated.`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- data-sources ---
program
  .command("data-sources")
  .description("List all Data Source (DS) tables")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const config = await client.listDataSources();

      if (opts.json) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        printDataSourceTable(config);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- data-source <name> ---
program
  .command("data-source <name>")
  .description("Show metadata for a Data Source (DS) table")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const result = await client.fetchMetadata("DMDS", name);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const rows = formatMetadataTable(result);
        if (typeof rows === "string") {
          console.log(rows);
        } else {
          printTable(rows);
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- data-source-metadata <name> ---
program
  .command("data-source-metadata <name>")
  .description("Show attribute metadata for a Data Source (DS) table")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const data = await client.fetchDataSourceAttributeMeta(name);
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        const rows = formatAttributeMetaTable(data);
        if (typeof rows === "string") {
          console.log(rows);
        } else {
          printTable(rows);
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- pricing-parameters ---
program
  .command("pricing-parameters")
  .description("List all Pricing Parameter (Company Parameter) tables")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const data = await client.listPricingParameters();

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        printPricingParameterTable(data);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- pricing-parameter <name> ---
program
  .command("pricing-parameter <name>")
  .description("Show metadata and sample data for a Pricing Parameter table")
  .option("--limit <n>", "Number of data rows to fetch", parseInt, 10)
  .option("--json", "Output raw JSON instead of a table")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const allParams = await client.listPricingParameters();

      // Find the parameter by uniqueName or label (case-insensitive)
      const param = allParams.find(
        (p) =>
          p.uniqueName === name ||
          p.label === name ||
          (p.uniqueName && p.uniqueName.toLowerCase() === name.toLowerCase()) ||
          (p.label && p.label.toLowerCase() === name.toLowerCase())
      );

      if (!param) {
        const available = allParams.map((p) => p.uniqueName || p.label).join(", ");
        throw new Error(`Pricing parameter "${name}" not found. Available: ${available}`);
      }

      if (opts.json) {
        // Fetch data too for JSON output
        const data = await client.fetchPricingParameterData(param.typedId, "en");
        console.log(JSON.stringify({ parameter: param, data }, null, 2));
      } else {
        // Print parameter info
        const type = param.simulationDimension > 0 ? "MLTV2" : "LTV";
        const keys = (param.valueArray || []).filter((v) => v.key).map((v) => v.name || v.fieldName);
        const attrs = (param.valueArray || []).filter((v) => !v.key).map((v) => v.name || v.fieldName);
        console.log(`\nPricing Parameter: ${param.uniqueName || param.label}`);
        console.log(`  Type:       ${type} (${type === "LTV" ? "Single-key Lookup" : "Multi-key Matrix"})`);
        console.log(`  Label:      ${param.label || ""}`);
        console.log(`  TypedId:    ${param.typedId}`);
        if (keys.length > 0) console.log(`  Keys:       ${keys.join(", ")}`);
        if (attrs.length > 0) console.log(`  Attributes: ${attrs.join(", ")}`);
        console.log("");

        // Print field details
        if (param.valueArray && param.valueArray.length > 0) {
          const rows = param.valueArray.map((v) => ({
            fieldName: v.name || v.fieldName || "",
            label: v.label || "",
            type: v.key ? "KEY" : "VALUE",
            fieldType: v.fieldType != null ? formatPpvFieldType(v.fieldType) : "",
          }));
          printTable(rows);
        }

        // Fetch and print sample data
        const data = await client.fetchPricingParameterData(param.typedId, "en");
        if (data.length > 0) {
          const sample = data.slice(0, opts.limit);
          console.log(`\nSample data (${sample.length} of ${data.length} rows):\n`);
          // Build display rows from the actual data keys
          const skipFields = new Set(["version", "typedId", "createDate", "createdBy", "lastUpdateDate", "lastUpdateBy", "lookupTableId", "lookupTable"]);
          const allKeys = Object.keys(sample[0]).filter((k) => !skipFields.has(k));
          const keysWithData = allKeys.filter((k) => sample.some((row) => row[k] != null && row[k] !== ""));
          const displayRows = sample.map((row) => {
            const r = {};
            for (const k of keysWithData) {
              r[k] = row[k] ?? "";
            }
            return r;
          });
          printResponsiveTable(displayRows);
        } else {
          console.log("\nNo data rows found.");
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- create-pricing-parameter ---
program
  .command("create-pricing-parameter <name>")
  .description("Create a new Pricing Parameter (Company Parameter) table")
  .option("--label <label>", "Display label")
  .option("--type <type>", "Table type: SIMPLE (LTV), MATRIX (MLTV2), MATRIX2 (MLTV2 v2), MATRIX3, MATRIX4, MATRIX5, MATRIX6", "SIMPLE")
  .option("--value-type <valueType>", "Value type: REAL, STRING, INTEGER, DATE, DATETIME, BOOLEAN", "REAL")
  .option("--valid-after <date>", "Valid after date (YYYY-MM-DD), defaults to today")
  .option("--json", "Output raw JSON")
  .action(async (name, opts) => {
    try {
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const result = await client.createPricingParameter(name, {
        label: opts.label,
        type: opts.type.toUpperCase(),
        valueType: opts.valueType.toUpperCase(),
        validAfter: opts.validAfter,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Pricing parameter "${name}" created.`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- test-connection ---
program
  .command("test-connection")
  .description("Test if Pricefx credentials in .env are valid")
  .action(async () => {
    try {
      const connOpts = getConnectionConfig();
      console.log(`Connecting to ${connOpts.url} (partition: ${connOpts.partition}, user: ${connOpts.username})...`);
      const client = new PricefxClient(connOpts);
      await client.testConnection();
      console.log("Connection successful.");
    } catch (err) {
      console.error(`Connection failed: ${err.message}`);
      process.exit(1);
    }
  });

// --- fetch-sample ---
program
  .command("fetch-sample <objectType>")
  .description("Fetch sample rows from a Pricefx table (P, PX, CX, DMDS)")
  .option("--name <name>", "Extension or data source name (required for PX, CX, DMDS)")
  .option("--limit <n>", "Number of rows to fetch", parseInt, 5)
  .option("--labels", "Replace attributeN headers with labels from metadata")
  .option("--vertical", "Display each row vertically (one field per line)")
  .option("--box", "Output as fixed-width box table")
  .option("--transpose", "Transpose: fields as rows, records as columns")
  .option("--columns <cols>", "Show only these columns (comma-separated, e.g., sku,attribute1,attribute9)")
  .option("--markdown", "Output as markdown table")
  .option("--csv", "Output as CSV")
  .option("--plain", "Output as plain padded table (no borders)")
  .option("--json", "Output raw JSON instead of a table")
  .action(async (objectType, opts) => {
    try {
      const ot = objectType.toUpperCase();
      if ((ot === "PX" || ot === "CX" || ot === "DMDS") && !opts.name) {
        throw new Error(`--name is required for ${ot}. Example: pfx fetch-sample ${ot} --name MyTable`);
      }
      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const data = await client.fetchSample(ot, { name: opts.name, limit: opts.limit });

      // Fetch labels if requested
      let labelMap = {};
      if (opts.labels && opts.name && (ot === "PX" || ot === "CX")) {
        const type = ot === "PX" ? "product" : "customer";
        const meta = await client.fetchExtensionAttributeMeta(type, opts.name);
        for (const m of meta) {
          if (m.fieldName && m.label) labelMap[m.fieldName] = m.label;
        }
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
      } else if (data.length === 0) {
        console.log("No data found.");
      } else {
        // Pick relevant fields (skip internal fields for readability)
        const skipFields = new Set(["version", "typedId", "createDate", "createdBy", "lastUpdateDate", "lastUpdateBy"]);
        const allKeys = Object.keys(data[0]).filter((k) => !skipFields.has(k));
        // Filter out empty attributeN fields
        const keysWithData = allKeys.filter((k) => {
          if (!k.startsWith("attribute")) return true;
          return data.some((row) => row[k] != null && row[k] !== "");
        });
        // Filter columns if --columns specified
        let finalKeys = keysWithData;
        if (opts.columns) {
          const wanted = new Set(opts.columns.split(",").map((c) => c.trim()));
          finalKeys = keysWithData.filter((k) => wanted.has(k));
        }

        if (opts.transpose) {
          // For transpose, keep original field names and pass labelMap
          const rows = data.map((row) => {
            const r = {};
            for (const k of finalKeys) {
              r[k] = row[k] ?? "";
            }
            return r;
          });
          printTransposedBoxTable(rows, { labelMap });
        } else {
          // Rename keys: "Label (attributeN)" when label available
          const displayKeys = finalKeys.map((k) => {
            const label = labelMap[k];
            return label ? `${label} (${k})` : k;
          });
          const rows = data.map((row) => {
            const r = {};
            for (let i = 0; i < finalKeys.length; i++) {
              r[displayKeys[i]] = row[finalKeys[i]] ?? "";
            }
            return r;
          });
          if (opts.csv) {
            const cols = Object.keys(rows[0]);
            const escape = (v) => {
              const s = String(v ?? "");
              return s.includes(",") || s.includes('"') || s.includes("\n") ? '"' + s.replace(/"/g, '""') + '"' : s;
            };
            console.log(cols.map(escape).join(","));
            for (const r of rows) {
              console.log(cols.map((c) => escape(r[c])).join(","));
            }
          } else if (opts.plain) {
            printTable(rows, { vertical: opts.vertical });
          } else if (opts.box) {
            printBoxTable(rows);
          } else if (opts.markdown) {
            printMarkdownTable(rows);
          } else {
            // Default: responsive table that fits terminal width with word-wrap
            printResponsiveTable(rows);
          }
        }
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// --- set-attributes (batch) ---
program
  .command("set-attributes <kind> <extensionName>")
  .description("Set multiple attribute metadata at once on a PX or CX extension")
  .argument("<attrs...>", 'Attributes in format "fieldName:TYPE:FORMAT:Label" (e.g., "attribute1:STRING:TEXT:Product Name")')
  .option("--json", "Output raw JSON")
  .action(async (kind, extensionName, attrs, opts) => {
    try {
      const k = kind.toUpperCase();
      if (k !== "PX" && k !== "CX") {
        throw new Error('Kind must be "PX" or "CX".');
      }
      const type = k === "PX" ? "product" : "customer";

      const attributes = attrs.map((a) => {
        const parts = a.split(":");
        if (parts.length < 1) throw new Error(`Invalid attribute format: "${a}". Expected "fieldName:TYPE:FORMAT:Label"`);
        const [fieldName, typeStr, formatType, ...labelParts] = parts;
        const fieldType = typeStr ? FIELD_TYPES[typeStr.toUpperCase()] : undefined;
        if (typeStr && fieldType === undefined) {
          throw new Error(`Unknown field type "${typeStr}" in "${a}". Valid: ${Object.keys(FIELD_TYPES).join(", ")}`);
        }
        return {
          fieldName,
          fieldType,
          formatType: formatType?.toUpperCase() || null,
          label: labelParts.join(":") || fieldName,
        };
      });

      const connOpts = getConnectionConfig();
      const client = new PricefxClient(connOpts);
      const results = await client.setAttributes(type, extensionName, attributes);

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        for (const r of results) {
          console.log(`${r.action}: ${r.fieldName}`);
        }
        console.log(`\n${results.length} attributes set on ${k} "${extensionName}".`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

function printDataSourceTable(dataSources) {
  if (!Array.isArray(dataSources) || dataSources.length === 0) {
    console.log("No data sources found.");
    return;
  }
  const rows = dataSources.map((ds) => {
    const fields = ds.fields || [];
    const keys = fields.filter((f) => f.key).map((f) => f.name);
    return {
      name: ds.uniqueName,
      label: ds.label || "",
      fields: fields.length,
      keys: keys.join(", "),
    };
  });
  printTable(rows);
}

function printExtensionTable(extensions, type) {
  const names = Object.keys(extensions);
  if (names.length === 0) {
    console.log(`No ${type} extensions found.`);
    return;
  }
  const rows = names.map((name) => ({
    name,
    label: extensions[name].label || "",
    attributes: extensions[name].numberOfAttributes ?? "",
    searchable: extensions[name].allowSearch ?? "",
    businessKey: (extensions[name].businessKey || []).join(", "),
  }));
  printTable(rows);
}

function printPricingParameterTable(params) {
  if (!Array.isArray(params) || params.length === 0) {
    console.log("No pricing parameters found.");
    return;
  }
  const rows = params.map((p) => {
    const type = p.simulationDimension > 0 ? "MLTV2" : "LTV";
    const keys = (p.valueArray || []).filter((v) => v.key).map((v) => v.name || v.fieldName);
    const values = (p.valueArray || []).filter((v) => !v.key).map((v) => v.name || v.fieldName);
    return {
      name: p.uniqueName || "",
      label: p.label || "",
      type,
      typedId: p.typedId || "",
      keys: keys.join(", "),
      values: values.join(", "),
    };
  });
  printTable(rows);
}

function formatPpvFieldType(code) {
  const types = { 0: "NUMERIC", 1: "NUMERIC_LONG", 2: "TEXT", 3: "INTEGER", 4: "DATE", 5: "DATETIME", 9: "BOOLEAN" };
  return types[code] || String(code);
}

program.parse();
