/** Minimal RFC 4180-style CSV parser (no external deps). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
      if (c === "\r") i++;
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

export function toCsv(
  rows: Array<Record<string, string | number>>,
  headers: string[]
): string {
  const escape = (value: string | number) => {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ];
  return lines.join("\r\n");
}

export const PRODUCT_IMPORT_HEADERS = [
  "sku",
  "name",
  "brand",
  "category",
  "barcode",
  "low_stock_threshold",
  "bike_brand",
  "bike_model",
  "year",
] as const;

export const PRODUCT_IMPORT_TEMPLATE = toCsv(
  [
    {
      sku: "SP-CLICK-001",
      name: "NGK Spark Plug",
      brand: "NGK",
      category: "Ignition",
      barcode: "8851234567890",
      low_stock_threshold: 5,
      bike_brand: "Honda",
      bike_model: "Click",
      year: 2020,
    },
    {
      sku: "SP-CLICK-001",
      name: "NGK Spark Plug",
      brand: "NGK",
      category: "Ignition",
      barcode: "",
      low_stock_threshold: "",
      bike_brand: "Honda",
      bike_model: "Wave",
      year: 2019,
    },
  ],
  [...PRODUCT_IMPORT_HEADERS]
);
