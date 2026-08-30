// Bulk contact import/export for the Calling Sheet. Reuses the generic
// CSV parse/escape/download helpers already proven for Live Quiz's
// question bank import — only the row-shape logic here is new.

import { parseCsv, csvEscape, downloadCsvFile } from "../quiz/quizCsvService";
import type { CallingAppContactForm, CallingAppCustomFieldDef, CallingAppContact, CallingAppDisposition, CallingAppAdmin, CallingAppCustomFieldValue } from "../../types/callingApp";

export const BASE_HEADERS = ["Name", "Mobile", "Email", "Project"];

export function buildSampleCsv(fieldDefs: CallingAppCustomFieldDef[]): string {
  const headers = [...BASE_HEADERS, ...fieldDefs.map((f) => f.label)];
  const sampleRow = ["Rahul Sharma", "9876543210", "rahul@example.com", "Skyline Towers", ...fieldDefs.map(() => "")];
  return [headers, sampleRow].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

export interface ParsedContactRow {
  form: CallingAppContactForm;
  customFieldValues: { field_def_id: string; value_text: string }[];
}

export interface CsvImportResult {
  rows: ParsedContactRow[];
  errors: string[];
}

/** Header row matched case-insensitively by name, column order doesn't matter. */
export function parseContactsCsv(text: string, fieldDefs: CallingAppCustomFieldDef[]): CsvImportResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length < 2) return { rows: [], errors: ["The file has no data rows (only a header, or is empty)."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const idx = { name: col("name"), mobile: col("mobile"), email: col("email"), project: col("project") };

  if (idx.name === -1 || idx.mobile === -1) {
    return { rows: [], errors: ['The file must have at least "Name" and "Mobile" columns.'] };
  }

  const fieldCols = fieldDefs.map((f) => ({ def: f, colIndex: col(f.label) }));

  const parsed: ParsedContactRow[] = [];
  rows.slice(1).forEach((r, i) => {
    const rowNum = i + 2;
    const name = (r[idx.name] ?? "").trim();
    const mobile = (r[idx.mobile] ?? "").trim();
    if (!name || !mobile) {
      errors.push(`Row ${rowNum}: needs both Name and Mobile — skipped.`);
      return;
    }

    parsed.push({
      form: {
        list_id: null,
        name,
        mobile_no: mobile,
        email: idx.email >= 0 ? (r[idx.email] ?? "").trim() || null : null,
        project_name: idx.project >= 0 ? (r[idx.project] ?? "").trim() || null : null,
        assigned_to: null,
        disposition_id: null,
        remarks: null,
        next_call_at: null,
      },
      customFieldValues: fieldCols
        .filter((fc) => fc.colIndex >= 0 && (r[fc.colIndex] ?? "").trim() !== "")
        .map((fc) => ({ field_def_id: fc.def.id, value_text: (r[fc.colIndex] ?? "").trim() })),
    });
  });

  return { rows: parsed, errors };
}

export function exportContactsCsv(
  contacts: CallingAppContact[],
  fieldDefs: CallingAppCustomFieldDef[],
  fieldValues: CallingAppCustomFieldValue[],
  dispositionById: Map<string, CallingAppDisposition>,
  adminById: Map<string, CallingAppAdmin>
): string {
  const valuesByContact = new Map<string, Map<string, string>>();
  fieldValues.forEach((v) => {
    if (!valuesByContact.has(v.contact_id)) valuesByContact.set(v.contact_id, new Map());
    valuesByContact.get(v.contact_id)!.set(v.field_def_id, v.value_text ?? "");
  });

  const headers = [...BASE_HEADERS, "Disposition", "Assigned To", "Attempts", "Next Call", ...fieldDefs.map((f) => f.label)];
  const rows = contacts.map((c) => [
    c.name,
    c.mobile_no,
    c.email ?? "",
    c.project_name ?? "",
    c.disposition_id ? dispositionById.get(c.disposition_id)?.label ?? "" : "",
    c.assigned_to ? adminById.get(c.assigned_to)?.display_name ?? "" : "",
    String(c.attempt_count),
    c.next_call_at ?? "",
    ...fieldDefs.map((f) => valuesByContact.get(c.id)?.get(f.id) ?? ""),
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

export { downloadCsvFile };
