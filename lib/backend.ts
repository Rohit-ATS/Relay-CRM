import type { Account, Activity, Handoff } from "./types";

type ApiRecord = Record<string, any>;
const asList = async (path: string): Promise<ApiRecord[]> => {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Relay API request failed (${response.status})`);
  const body = await response.json();
  return Array.isArray(body) ? body : [];
};
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const palette = ["violet", "orange", "teal", "blue"];

export async function loadWorkspace(): Promise<{ accounts: Account[]; handoffs: Handoff[] }> {
  const [accounts, contacts, deals, activities, sequences, handoffs] = await Promise.all([
    asList("/api/accounts"), asList("/api/contacts"), asList("/api/deals"),
    asList("/api/activities"), Promise.resolve([] as ApiRecord[]), asList("/api/handoffs"),
  ]);
  const mapped = accounts.map((account, index): Account => {
    const accountId = String(account.id);
    const contact = contacts.find((item) => String(item.account_id ?? item.accountId) === accountId);
    const deal = deals.find((item) => String(item.account_id ?? item.accountId) === accountId);
    const accountActivities: Activity[] = activities
      .filter((item) => String(item.account_id ?? item.accountId) === accountId)
      .map((item) => ({ id: String(item.id), type: String(item.type), summary: String(item.summary), when: new Date(item.created_at ?? item.createdAt).toLocaleString(), source: String(item.source ?? "CRM") }));
    const accountSequence = sequences.find((item) => String(item.account_id ?? item.accountId) === accountId);
    return {
      id: accountId,
      company: String(account.company_name ?? account.companyName ?? "Account"),
      domain: String(account.domain ?? ""),
      industry: String(account.industry ?? "General"),
      initials: initials(String(account.company_name ?? account.companyName ?? "Account")),
      color: palette[index % palette.length],
      summary: String(account.summary ?? ""),
      sourceNotes: String(account.source_notes ?? account.sourceNotes ?? "Imported CRM record"),
      contact: { id: String(contact?.id ?? ""), name: String(contact?.name ?? "Unassigned contact"), title: String(contact?.title ?? ""), email: String(contact?.email ?? ""), status: String(contact?.status ?? "Lead") },
      deal: { name: String(deal?.name ?? "New opportunity"), stage: String(deal?.stage ?? "Prospecting"), value: Number(deal?.value ?? 0), nextStep: String(deal?.next_step ?? deal?.nextStep ?? "Review account") },
      activities: accountActivities,
      sequenceStatus: accountSequence?.status === "approved" ? "Approved · no message sent" : accountSequence ? "Ready for review" : "Draft",
    };
  });
  const mappedHandoffs: Handoff[] = handoffs.map((task) => {
    const account = mapped.find((item) => item.id === String(task.account_id ?? task.accountId));
    return { id: String(task.id), accountId: String(task.account_id ?? task.accountId), company: account?.company ?? "Account", contact: account?.contact.name ?? "Contact", reason: String(task.reason ?? task.title ?? "Follow up"), due: task.due_at ? new Date(task.due_at).toLocaleDateString() : "No due date", status: ["completed", "done", "dismissed"].includes(String(task.status)) ? "done" : "open" };
  });
  return { accounts: mapped, handoffs: mappedHandoffs };
}
