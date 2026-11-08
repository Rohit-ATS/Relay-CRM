import { dealStageValues, type DealStage } from "../shared/contracts";

export const requiredCsvHeaders = ["company_name", "contact_name", "deal_name"] as const;
export const supportedCsvHeaders = [
  ...requiredCsvHeaders,
  "domain",
  "linkedin_url",
  "contact_title",
  "contact_email",
  "deal_stage",
  "deal_value",
  "next_step",
] as const;

export type CsvImportRow = {
  company_name: string;
  domain?: string;
  linkedin_url?: string;
  contact_name: string;
  contact_title?: string;
  contact_email?: string;
  deal_name: string;
  deal_stage?: DealStage;
  deal_value?: number;
  next_step?: string;
};

export type CsvRowError = { row: number; message: string };
export type CsvPreview = { rows: CsvImportRow[]; errors: CsvRowError[]; headers: string[] };

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function isEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

export function parseCsv(text: string): CsvPreview {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], errors: [{ row: 1, message: "CSV is empty." }] };

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const missingHeaders = requiredCsvHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    return { headers, rows: [], errors: [{ row: 1, message: `Missing required header(s): ${missingHeaders.join(", ")}.` }] };
  }

  const rows: CsvImportRow[] = [];
  const errors: CsvRowError[] = [];
  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? ""]));
    const companyName = String(record.company_name ?? "").trim();
    const contactName = String(record.contact_name ?? "").trim();
    const dealName = String(record.deal_name ?? "").trim();
    const rowErrors: string[] = [];
    if (!companyName) rowErrors.push("company_name is required");
    if (!contactName) rowErrors.push("contact_name is required");
    if (!dealName) rowErrors.push("deal_name is required");
    if (record.contact_email && !isEmail(record.contact_email)) rowErrors.push("contact_email is invalid");
    if (record.deal_stage && !dealStageValues.includes(record.deal_stage as DealStage)) {
      rowErrors.push(`deal_stage must be one of: ${dealStageValues.join(", ")}`);
    }
    const dealValue = record.deal_value ? Number(record.deal_value) : undefined;
    if (record.deal_value && (!Number.isFinite(dealValue) || Number(dealValue) < 0)) rowErrors.push("deal_value must be a positive number");

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, message: rowErrors.join("; ") });
      return;
    }
    rows.push({
      company_name: companyName,
      domain: record.domain?.trim() || undefined,
      linkedin_url: record.linkedin_url?.trim() || undefined,
      contact_name: contactName,
      contact_title: record.contact_title?.trim() || undefined,
      contact_email: record.contact_email?.trim() || undefined,
      deal_name: dealName,
      deal_stage: (record.deal_stage?.trim() || "prospecting") as DealStage,
      deal_value: dealValue,
      next_step: record.next_step?.trim() || undefined,
    });
  });

  return { headers, rows, errors };
}

export const sampleCsv = [...supportedCsvHeaders].join(",");
