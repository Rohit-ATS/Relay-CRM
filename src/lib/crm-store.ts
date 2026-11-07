import type { Account, Contact, Deal, AuditEntry, Activity, HandoffTask, Sequence } from "../shared/contracts";
import type { CsvImportRow } from "./csv-import";

export type RelayData = { accounts: Account[]; contacts: Contact[]; deals: Deal[]; activities: Activity[]; handoffs: HandoffTask[]; sequences: Sequence[] };
const storageKey = "relay-crm-data-v1";
const id = (prefix: string) => `${prefix}_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const audit = (summary: string, action: AuditEntry["action"] = "created"): AuditEntry => ({ id: id("audit"), action, actor: "user", at: now(), summary });

export function seedData(): RelayData {
  const createdAt = now();
  const fixtures = [
    ["northstar", "Northstar Labs", "northstarlabs.example", "AI operations platform for customer support teams.", "Avery Chen", "Founder & CEO", "avery@northstarlabs.example", "AI workflow pilot", "prospecting", 18000, "Confirm discovery call"],
    ["vercelity", "Vercelity", "vercelity.example", "Developer tooling company consolidating its revenue operations.", "Jordan Lee", "VP of Sales", "jordan@vercelity.example", "Revenue workflow review", "engaged", 32000, "Share security overview"],
    ["formwise", "Formwise", "formwise.example", "Forms and automation platform expanding its mid-market sales team.", "Alex Morgan", "Head of Growth", "alex@formwise.example", "Sales process assessment", "prospecting", 24500, "Map qualification workflow"],
    ["brightpath", "Brightpath Health", "brightpath.example", "Digital health network evaluating a shared contact workflow.", "Priya Shah", "COO", "priya@brightpath.example", "Care network pilot", "engaged", 50000, "Schedule stakeholder walkthrough"],
  ] as const;
  const accounts: Account[] = [], contacts: Contact[] = [], deals: Deal[] = [];
  for (const [slug, companyName, domain, summary, person, title, email, dealName, stage, value, nextStep] of fixtures) {
    const accountId = `acct_${slug}`, contactId = `contact_${slug}`, dealId = `deal_${slug}`;
    accounts.push({ id: accountId, companyName, domain, summary, facts: [{ key: "Company context", value: summary, source: { type: "user", label: "Relay demo fixture" } }], auditHistory: [audit("Loaded seeded demo record")], createdAt, updatedAt: createdAt });
    contacts.push({ id: contactId, accountId, name: person, title, email, source: { type: "user", label: "Relay demo fixture" }, auditHistory: [audit("Loaded seeded demo contact")] });
    deals.push({ id: dealId, accountId, name: dealName, stage, value, nextStep, auditHistory: [audit("Loaded seeded demo opportunity")] });
  }
  return { accounts, contacts, deals, activities: [], handoffs: [], sequences: [] };
}

export function loadData(): RelayData {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<RelayData>;
      if (Array.isArray(parsed.accounts) && Array.isArray(parsed.contacts) && Array.isArray(parsed.deals)) {
        return { ...parsed, activities: parsed.activities ?? [], handoffs: parsed.handoffs ?? [], sequences: parsed.sequences ?? [] } as RelayData;
      }
    }
  } catch { /* Recover from stale or malformed local demo data. */ }
  const initial = seedData(); saveData(initial); return initial;
}
export function saveData(data: RelayData, notifyCloud = true): void { localStorage.setItem(storageKey, JSON.stringify(data)); if (notifyCloud && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("relay:data-saved", { detail: data })); }
export function importRows(data: RelayData, rows: CsvImportRow[]): RelayData {
  const importedAt = now();
  rows.forEach((row) => {
    const accountId = id("acct"), contactId = id("contact"), dealId = id("deal");
    data.accounts.push({ id: accountId, companyName: row.company_name, domain: row.domain, summary: "Imported from the supplied CSV.", facts: [{ key: "Record source", value: "CSV import", source: { type: "user", label: "Imported CSV" } }], auditHistory: [audit("Imported from CSV")], createdAt: importedAt, updatedAt: importedAt });
    data.contacts.push({ id: contactId, accountId, name: row.contact_name, title: row.contact_title, email: row.contact_email, source: { type: "user", label: "Imported CSV" }, auditHistory: [audit("Imported from CSV")] });
    data.deals.push({ id: dealId, accountId, name: row.deal_name, stage: row.deal_stage ?? "prospecting", value: row.deal_value, nextStep: row.next_step, auditHistory: [audit("Imported from CSV")] });
  });
  saveData(data); return data;
}
export function resetData(): RelayData { const data = seedData(); saveData(data); return data; }
