// Quote every cell; prefix formula-looking cells so spreadsheets don't execute them (CSV injection).
const cell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? "");
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export const toCsv = (rows: Record<string, unknown>[]) =>
  rows.length ? [Object.keys(rows[0]).map(cell).join(","), ...rows.map((r) => Object.values(r).map(cell).join(","))].join("\n") : "";
