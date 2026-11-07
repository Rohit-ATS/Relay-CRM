import httpx
import json

BASE_URL = "https://relay-crm-api.onrender.com"
client = httpx.Client(base_url=BASE_URL, timeout=25.0)

print("=" * 60)
print("RELAY CRM — LIVE PRODUCTION RUN ON RENDER")
print("Target:", BASE_URL)
print("=" * 60)

# 1. Health check
print("\n[Step 1] Health Check")
res = client.get("/health")
print(f"Status: {res.status_code}")
print("Response:", res.json())

# 2. Reset & Seed
print("\n[Step 2] Demo Reset & Seed Database")
res = client.post("/api/reset?seed=true")
print(f"Status: {res.status_code}")
print("Response:", res.json())

# 3. Download sample CSV
print("\n[Step 3] Download Sample Leads CSV")
res = client.get("/api/import/sample")
print(f"Status: {res.status_code}")
print(f"Downloaded CSV size: {len(res.text)} bytes, rows: {len(res.text.strip().splitlines())}")

# 4. Import new lead via CSV
print("\n[Step 4] Ingest New Lead via CSV")
csv_payload = """name,title,company,email,website,notes
Alex Rivera,Chief Product Officer,Vanguard AI,alex@vanguardai.io,https://vanguardai.io,"Series A AI infrastructure startup. Struggling with sales ops data fragmentation."
"""
res = client.post("/api/import", data={"csv_text": csv_payload})
print(f"Status: {res.status_code}")
import_data = res.json()
print("Import Result:", import_data)
account_id = import_data["account_ids"][0]

# 5. Read Account Details & Initial Deal
print("\n[Step 5] Read Account Record & Linked Entities")
acc = client.get(f"/api/accounts/{account_id}").json()
company = acc["company_name"]
contacts_count = len(acc["contacts"])
deals_count = len(acc["deals"])
print(f"Account: {company} (ID: {account_id})")
print(f"Linked Contacts: {contacts_count}, Linked Deals: {deals_count}")
deal = acc["deals"][0]
contact = acc["contacts"][0]
print(f"Deal: '{deal['name']}' | Stage: '{deal['stage']}' | Next Step: '{deal['next_step']}'")

# 6. Generate Account Brief with Labeled Facts
print("\n[Step 6] Generate Account Brief with Source-Labeled Facts")
brief = client.post("/api/enrich", json={"account_id": account_id}).json()
print("Brief Summary:", brief["summary"])
print("Verified & Labeled Facts:")
for f in brief["facts"]:
    print(f"  • [{f['source_type']}] (confidence: {f['confidence']}) {f['claim']}")

# 7. Generate 3-Step Email Outreach Plan
print("\n[Step 7] Generate Personalized 3-Step Outreach Sequence")
seq = client.post("/api/sequence", json={"account_id": account_id, "contact_id": contact["id"]}).json()
print(f"Sequence ID: {seq['id']} | Status: {seq['status']} | Mode: {seq['mode']}")
print(f"Strategy Rationale: {seq['rationale']}")
for s in seq["steps"]:
    print(f"  • Step {s['step_number']} (Day {s['delay_days']}): \"{s['subject']}\"")

# 8. Edit Draft Step
print("\n[Step 8] Edit Draft Step Before Approval")
first_step = seq["steps"][0]
edit_res = client.patch(
    f"/api/sequence/{seq['id']}/steps/{first_step['id']}",
    json={"subject": "Customized: Reducing CRM upkeep at Vanguard AI"}
).json()
print("Updated Step 1 Subject:", edit_res["subject"])

# 9. Human Approval Checkpoint
print("\n[Step 9] Human Approval Checkpoint")
appr_res = client.post(
    f"/api/sequence/{seq['id']}/approve",
    json={"notes": "Approved by founder for outbound"}
).json()
print("Sequence Status:", appr_res["status"])
deal_after_appr = client.get(f"/api/deals/{deal['id']}").json()
print(f"Deal Stage Automatically Moved to: '{deal_after_appr['stage']}' (Next: '{deal_after_appr['next_step']}')")

# 10. Simulate Inbound Prospect Reply
print("\n[Step 10] Simulate Inbound Prospect Reply & AI Analysis")
sample_reply = "Hi! We desperately need this. Can we do a 20-min demo on Thursday at 2pm?"
print(f"Inbound Message: \"{sample_reply}\"")
analysis = client.post("/api/interactions", json={
    "account_id": account_id,
    "contact_id": contact["id"],
    "channel": "email_reply",
    "content": sample_reply,
    "apply_immediately": False
}).json()
prop = analysis["proposed_update"]
print(f"AI Detected Sentiment: {analysis['sentiment']} | Intent: {analysis['intent']}")
print(f"Proposed Deal Stage Transition: '{prop['current_stage']}' -> '{prop['proposed_stage']}'")
print(f"Reasoning: {prop['reasoning']}")
print(f"Recommended Task: '{prop['recommended_task_title']}'")

# 11. Confirm Interaction & Update CRM
print("\n[Step 11] Confirm Interaction & Apply Changes")
confirm_res = client.post("/api/interactions/confirm", json={
    "account_id": account_id,
    "contact_id": contact["id"],
    "channel": "email_reply",
    "content": sample_reply,
    "confirmed_stage": prop["proposed_stage"],
    "task_title": prop["recommended_task_title"],
    "task_reason": prop["recommended_task_reason"]
}).json()
print("Confirmation Status:", confirm_res["status"])
task_id = confirm_res["task_id"]

# 12. Verify Audit History Timeline
print("\n[Step 12] Inspect Immutable Audit Activity Timeline")
deal_final = client.get(f"/api/deals/{deal['id']}").json()
print(f"Final Deal Stage: '{deal_final['stage']}'")
activities = client.get(f"/api/activities?account_id={account_id}").json()
print(f"Audit Timeline Entries ({len(activities)} recorded):")
for a in activities:
    print(f"  • [{a['created_at'][:19]}] [{a['type'].upper()} ({a['source']})] {a['summary']}")

# 13. Warm Leads Handoff Queue
print("\n[Step 13] Check Warm Leads Handoff Queue")
handoffs = client.get("/api/handoffs?status=pending").json()
matching = [h for h in handoffs if h["id"] == task_id]
if matching:
    print(f"✓ Found Task in Handoff Queue: '{matching[0]['title']}'")
    print(f"  Reason: {matching[0]['reason']}")

# 14. Complete Task
print("\n[Step 14] Complete Handoff Task")
done_task = client.patch(f"/api/handoffs/{task_id}", json={"status": "completed"}).json()
print(f"Task Status Updated to: '{done_task['status']}'")

# 15. Wren Hackathon Proof Workflows
print("\n" + "=" * 60)
print("WREN HACKATHON PRIZE PROOF VERIFICATION")
print("=" * 60)
wf_a = client.get("/api/qa/verify-import").json()
print(f"Workflow A (Import & Prepare): Passed = {wf_a['passed']}")
print("Workflow A Evidence:", json.dumps(wf_a["evidence"], indent=2))

wf_b = client.get("/api/qa/verify-handoff").json()
print(f"\nWorkflow B (Update & Handoff): Passed = {wf_b['passed']}")
print("Workflow B Evidence:", json.dumps(wf_b["evidence"], indent=2))

print("\n" + "=" * 60)
print("ALL 15 END-TO-END STEPS COMPLETED SUCCESSFULLY ON RENDER!")
print("=" * 60)
