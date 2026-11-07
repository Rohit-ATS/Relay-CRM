import type { Account, Contact, Deal, DealStage, AuditEntry } from "../shared/contracts";
import type { CsvImportRow } from "./csv-import";

export type RelayData = { accounts: Account[]; contacts: Contact[]; deals: Deal[] };
const storageKey = "relay-crm-data-v1";

const id = (prefix: string) => `${prefix}_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const audit = (summary: string): AuditEntry => ({ id: id("audit"), action: "created", actor: "user", at: now(), summary });

export function seedData(): RelayData {
  const createdAt = now();
  const accountId = id("acct");
  const contactId = id("contact");
  const dealId = id("deal");
  return {
    accounts: [{ id: accountId, companyName: "Acme Robotics", domain: "acme.example", summary: "Seed account for the Relay demo.", facts: [{ key: "record_status", value: "Demo fixture", source: { type: "user", label: "Relay demo data" } }], auditHistory: [audit("Seeded demo account")], createdAt, updatedAt: createdAt }],
    contacts: [{ id: contactId, accountId, name: "Jordan Rivera", title: "Head of Operations", email: "jordan@acme.example", auditHistory: [audit("Seeded demo contact")] }],
    deals: [{ id: dealId, accountId, name: "CRM workflow pilot", stage: "engaged", value: 24000, nextStep: "Schedule product review", auditHistory: [audit("Seeded demo deal")] }],
  };
}

export function loadData(): RelayData {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    const initial = seedData();
    saveData(initial);
    return initial;
  }
  try {
    return JSON.parse(stored) as RelayData;
  } catch {
    const initial = seedData();
    saveData(initial);
    return initial;
  }
}

export function saveData(data: RelayData): void { localStorage.setItem(storageKey, JSON.stringify(data)); }

export function importRows(data: RelayData, rows: CsvImportRow[]): RelayData {
  const importedAt = now();
  rows.forEach((row) => {
    const accountId = id("acct");
    const contactId = id("contact");
    const dealId = id("deal");
    data.accounts.push({ id: accountId, companyName: row.company_name, domain: row.domain, summary: undefined, auditHistory: [audit("Imported from CSV")], createdAt: importedAt, updatedAt: importedAt });
    data.contacts.push({ id: contactId, accountId, name: row.contact_name, title: row.contact_title, email: row.contact_email, auditHistory: [audit("Imported from CSV")] });
    data.deals.push({ id: dealId, accountId, name: row.deal_name, stage: row.deal_stage ?? "prospecting", value: row.deal_value, nextStep: row.next_step, auditHistory: [audit("Imported from CSV")] });
  });
  saveData(data);
  return data;
}

export function resetData(): RelayData { const data = seedData(); saveData(data); return data; }
