import type { Account, Contact, Deal, AuditEntry, Activity, HandoffTask, Sequence } from "../shared/contracts";
import type { CsvImportRow } from "./csv-import";

export type RelayData = { accounts: Account[]; contacts: Contact[]; deals: Deal[]; activities: Activity[]; handoffs: HandoffTask[]; sequences: Sequence[] };
const storageKey = "relay-crm-data-v1";
const id = (prefix: string) => `${prefix}_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const audit = (summary: string, action: AuditEntry["action"] = "created"): AuditEntry => ({ id: id("audit"), action, actor: "user", at: now(), summary });

function validIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Migrate old browser records whose dates predate the current ISO contract. */
function normalizeAccountDates(data: RelayData): boolean {
  let changed = false;
  for (const account of data.accounts) {
    const createdAt = validIsoDate(account.createdAt) ?? validIsoDate(account.auditHistory?.[0]?.at) ?? now();
    const updatedAt = validIsoDate(account.updatedAt) ?? createdAt;
    if (account.createdAt !== createdAt) { account.createdAt = createdAt; changed = true; }
    if (account.updatedAt !== updatedAt) { account.updatedAt = updatedAt; changed = true; }
  }
  return changed;
}

export function emptyWorkspaceData(): RelayData {
  return { accounts: [], contacts: [], deals: [], activities: [], handoffs: [], sequences: [] };
}

export function loadData(): RelayData {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<RelayData>;
      if (Array.isArray(parsed.accounts) && Array.isArray(parsed.contacts) && Array.isArray(parsed.deals)) {
        const data = { ...parsed, activities: parsed.activities ?? [], handoffs: parsed.handoffs ?? [], sequences: parsed.sequences ?? [] } as RelayData;
        const fixtureIds = new Set(data.accounts.filter((account) => account.facts?.some((fact) => fact.source?.label === "Relay demo fixture") || ["northstarlabs.example","vercelity.example","formwise.example","brightpath.example","pinecone.example"].includes(account.domain ?? "")).map((account) => account.id));
        if (fixtureIds.size) {
          data.accounts = data.accounts.filter((account) => !fixtureIds.has(account.id));
          data.contacts = data.contacts.filter((contact) => !fixtureIds.has(contact.accountId));
          data.deals = data.deals.filter((deal) => !fixtureIds.has(deal.accountId));
          data.activities = data.activities.filter((activity) => !fixtureIds.has(activity.accountId));
          data.handoffs = data.handoffs.filter((handoff) => !fixtureIds.has(handoff.accountId));
          data.sequences = data.sequences.filter((sequence) => !fixtureIds.has(sequence.accountId));
          localStorage.setItem(storageKey, JSON.stringify(data));
        }
        if (normalizeAccountDates(data)) localStorage.setItem(storageKey, JSON.stringify(data));
        return data;
      }
    }
  } catch { /* Recover from stale or malformed local records. */ }
  const initial = emptyWorkspaceData(); saveData(initial); return initial;
}
export function saveData(data: RelayData, notifyCloud = true): void { normalizeAccountDates(data); localStorage.setItem(storageKey, JSON.stringify(data)); if (notifyCloud && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("relay:data-saved", { detail: data })); }
export function importRows(data: RelayData, rows: CsvImportRow[]): RelayData {
  const importedAt = now();
  rows.forEach((row) => {
    const accountId = id("acct"), contactId = id("contact"), dealId = id("deal");
    data.accounts.push({ id: accountId, companyName: row.company_name, domain: row.domain, summary: "Imported from the supplied CSV.", facts: [{ key: "Record source", value: "CSV import", source: { type: "user", label: "Imported CSV" } }], auditHistory: [audit("Imported from CSV")], createdAt: importedAt, updatedAt: importedAt });
    data.contacts.push({ id: contactId, accountId, name: row.contact_name, title: row.contact_title, email: row.contact_email, linkedinUrl: row.linkedin_url, source: { type: "user", label: "Imported CSV" }, auditHistory: [audit("Imported from CSV")] });
    data.deals.push({ id: dealId, accountId, name: row.deal_name, stage: row.deal_stage ?? "prospecting", value: row.deal_value, nextStep: row.next_step, auditHistory: [audit("Imported from CSV")] });
    data.activities.push({
      id: id("activity"), accountId, contactId, type: "note",
      summary: `Lead imported from CSV for ${row.company_name}.`,
      source: { type: "user", label: "CSV import" }, createdAt: importedAt,
      auditHistory: [audit("Lead imported from CSV")],
    });
  });
  saveData(data); return data;
}
