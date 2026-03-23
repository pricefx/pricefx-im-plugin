export function formatMetadataTable(data) {
  if (!data?.response?.data?.[0]) {
    return "No metadata found.";
  }

  const entry = data.response.data[0];
  const properties = entry.jsonSchema?.properties || {};
  const attributeMetas = entry.attributeMetas || [];

  const metaByField = new Map();
  for (const meta of attributeMetas) {
    metaByField.set(meta.fieldName, meta);
  }

  const rows = Object.entries(properties).map(([fieldName, schema]) => {
    const meta = metaByField.get(fieldName);
    return {
      fieldName,
      type: schema.type || "unknown",
      label: meta?.label || "",
      fieldType: meta?.fieldType ?? "",
      readOnly: meta?.readOnly ?? "",
      required: meta?.requiredField ?? "",
    };
  });

  return rows;
}

const FIELD_TYPES = {
  0: "NUMERIC",
  1: "NUMERIC_LONG",
  2: "TEXT",
  3: "DATE",
  4: "DATETIME",
  5: "MATRIX",
  6: "JSON",
};

export function formatAttributeMetaTable(data) {
  if (!data || data.length === 0) return "No attribute metadata found.";

  return data.map((m) => ({
    fieldName: m.fieldName || "",
    label: m.label || "",
    fieldType: FIELD_TYPES[m.fieldType] ?? m.fieldType ?? "",
    formatType: m.formatType || "",
    required: m.requiredField ?? "",
    readOnly: m.readOnly ?? "",
  }));
}

export function printTable(rows, { vertical = false } = {}) {
  if (rows.length === 0) {
    console.log("No data.");
    return;
  }

  if (vertical) {
    printVertical(rows);
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = {};

  for (const col of columns) {
    widths[col] = Math.max(
      col.length,
      ...rows.map((r) => String(r[col]).length)
    );
  }

  const header = columns.map((c) => c.padEnd(widths[c])).join("  ");
  const separator = columns.map((c) => "-".repeat(widths[c])).join("  ");

  console.log(header);
  console.log(separator);
  for (const row of rows) {
    console.log(columns.map((c) => String(row[c]).padEnd(widths[c])).join("  "));
  }
}

function printVertical(rows) {
  const columns = Object.keys(rows[0]);
  const labelWidth = Math.max(...columns.map((c) => c.length));

  for (let i = 0; i < rows.length; i++) {
    if (i > 0) console.log("");
    console.log(`--- Row ${i + 1} ---`);
    for (const col of columns) {
      const val = String(rows[i][col] ?? "");
      if (val === "") continue;
      console.log(`  ${col.padEnd(labelWidth)}  ${val}`);
    }
  }
}

export function printResponsiveTable(rows) {
  if (rows.length === 0) {
    console.log("No data.");
    return;
  }

  const columns = Object.keys(rows[0]);
  const termWidth = process.stdout.columns || 120;

  // Calculate natural widths (max content width per column)
  const naturalWidths = {};
  for (const col of columns) {
    naturalWidths[col] = Math.max(
      col.length,
      ...rows.map((r) => String(r[col] ?? "").length)
    );
  }

  // Available width: terminal - borders (│ per column + 1) - padding (2 per column)
  const bordersAndPadding = columns.length * 3 + 1;
  const available = termWidth - bordersAndPadding;
  const totalNatural = columns.reduce((s, c) => s + naturalWidths[c], 0);

  // Distribute widths
  const colWidths = {};
  if (totalNatural <= available) {
    // Everything fits
    for (const col of columns) colWidths[col] = naturalWidths[col];
  } else {
    // Proportional distribution with minimum width of 4
    const minWidth = 4;
    for (const col of columns) {
      colWidths[col] = Math.max(minWidth, Math.floor((naturalWidths[col] / totalNatural) * available));
    }
    // Distribute remaining space to columns that need it most
    let used = columns.reduce((s, c) => s + colWidths[c], 0);
    const sorted = [...columns].sort((a, b) => naturalWidths[b] - naturalWidths[a]);
    let i = 0;
    while (used < available && i < sorted.length * 3) {
      const col = sorted[i % sorted.length];
      if (colWidths[col] < naturalWidths[col]) {
        colWidths[col]++;
        used++;
      }
      i++;
    }
  }

  // Word-wrap function
  function wrapText(text, width) {
    const str = String(text ?? "");
    if (str.length <= width) return [str];
    const lines = [];
    let remaining = str;
    while (remaining.length > width) {
      // Try to break at space
      let breakAt = remaining.lastIndexOf(" ", width);
      if (breakAt <= 0) breakAt = width; // Hard break if no space
      lines.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
    if (remaining) lines.push(remaining);
    return lines;
  }

  // Build horizontal lines
  const top    = "┌" + columns.map((c) => "─".repeat(colWidths[c] + 2)).join("┬") + "┐";
  const mid    = "├" + columns.map((c) => "─".repeat(colWidths[c] + 2)).join("┼") + "┤";
  const bottom = "└" + columns.map((c) => "─".repeat(colWidths[c] + 2)).join("┴") + "┘";

  // Render a multi-line row
  function renderRow(cells) {
    const wrapped = columns.map((c) => wrapText(cells[c], colWidths[c]));
    const maxLines = Math.max(...wrapped.map((w) => w.length));
    const lines = [];
    for (let l = 0; l < maxLines; l++) {
      lines.push(
        "│" +
        columns.map((c, i) => {
          const text = wrapped[i][l] || "";
          return " " + text.padEnd(colWidths[c]) + " ";
        }).join("│") +
        "│"
      );
    }
    return lines;
  }

  // Header
  const header = {};
  for (const c of columns) header[c] = c;

  console.log(top);
  renderRow(header).forEach((l) => console.log(l));
  console.log(mid);
  for (let i = 0; i < rows.length; i++) {
    renderRow(rows[i]).forEach((l) => console.log(l));
    if (i < rows.length - 1) console.log(mid);
  }
  console.log(bottom);
}

export function printBoxTable(rows) {
  if (rows.length === 0) {
    console.log("No data.");
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = {};

  for (const col of columns) {
    widths[col] = Math.max(
      col.length,
      ...rows.map((r) => String(r[col]).length)
    );
  }

  const top    = "┌" + columns.map((c) => "─".repeat(widths[c] + 2)).join("┬") + "┐";
  const mid    = "├" + columns.map((c) => "─".repeat(widths[c] + 2)).join("┼") + "┤";
  const bottom = "└" + columns.map((c) => "─".repeat(widths[c] + 2)).join("┴") + "┘";
  const row = (r) => "│" + columns.map((c) => " " + String(r[c]).padEnd(widths[c]) + " ").join("│") + "│";

  const header = {};
  for (const c of columns) header[c] = c;

  console.log(top);
  console.log(row(header));
  console.log(mid);
  for (const r of rows) {
    console.log(row(r));
  }
  console.log(bottom);
}

export function printTransposedBoxTable(rows, { labelMap = {} } = {}) {
  if (rows.length === 0) {
    console.log("No data.");
    return;
  }

  const fields = Object.keys(rows[0]);
  const fieldLabels = fields.map((f) => {
    const label = labelMap[f];
    return label ? `${label} (${f})` : f;
  });

  const labelWidth = Math.max(...fieldLabels.map((l) => l.length));
  const colWidths = rows.map((r) =>
    Math.max(...fields.map((f) => String(r[f] ?? "").length))
  );

  const top    = "┌" + "─".repeat(labelWidth + 2) + "┬" + colWidths.map((w) => "─".repeat(w + 2)).join("┬") + "┐";
  const mid    = "├" + "─".repeat(labelWidth + 2) + "┼" + colWidths.map((w) => "─".repeat(w + 2)).join("┼") + "┤";
  const bottom = "└" + "─".repeat(labelWidth + 2) + "┴" + colWidths.map((w) => "─".repeat(w + 2)).join("┴") + "┘";

  console.log(top);

  // Header row with SKUs or row numbers
  const skuField = fields.includes("sku") ? "sku" : null;
  if (skuField) {
    const headerCells = rows.map((r, i) => " " + String(r[skuField]).padEnd(colWidths[i]) + " ");
    console.log("│ " + "".padEnd(labelWidth) + " │" + headerCells.join("│") + "│");
    console.log(mid);
  }

  for (const [fi, f] of fields.entries()) {
    if (f === skuField) continue;
    const cells = rows.map((r, i) => " " + String(r[f] ?? "").padEnd(colWidths[i]) + " ");
    console.log("│ " + fieldLabels[fi].padEnd(labelWidth) + " │" + cells.join("│") + "│");
  }

  console.log(bottom);
}

export function printMarkdownTable(rows) {
  if (rows.length === 0) {
    console.log("No data.");
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = {};

  for (const col of columns) {
    widths[col] = Math.max(
      col.length,
      ...rows.map((r) => String(r[col]).length)
    );
  }

  const header = "| " + columns.map((c) => c.padEnd(widths[c])).join(" | ") + " |";
  const separator = "| " + columns.map((c) => "-".repeat(widths[c])).join(" | ") + " |";

  console.log(header);
  console.log(separator);
  for (const row of rows) {
    console.log("| " + columns.map((c) => String(row[c]).padEnd(widths[c])).join(" | ") + " |");
  }
}
