import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_90_second_demo_journey(client: AsyncClient):
    """
    Complete end-to-end test simulating the 90-second live hackathon demo:
    1. Reset database to clean seeded state
    2. Import new CSV lead
    3. Generate and verify account brief
    4. Generate and approve 3-step sequence
    5. Inbound simulated prospect response
    6. Confirm deal stage transition & warm handoff task creation
    7. Complete handoff task
    8. Check timeline audit trail integrity
    """
    # Step 1: Demo Reset
    reset_res = await client.post("/api/reset?seed=true")
    assert reset_res.status_code == 200

    # Step 2: Import new lead
    csv_payload = """name,title,company,email,website,notes
Jordan Lee,Head of Sales,HyperGrowth AI,jordan@hypergrowth.ai,https://hypergrowth.ai,"Outbound scaling bottleneck. 50 SDRs struggling with CRM upkeep."
"""
    import_res = await client.post("/api/import", data={"csv_text": csv_payload})
    assert import_res.status_code == 201
    account_id = import_res.json()["account_ids"][0]

    # Verify Account details
    acc_res = await client.get(f"/api/accounts/{account_id}")
    assert acc_res.status_code == 200
    account_data = acc_res.json()
    assert account_data["company_name"] == "HyperGrowth AI"
    assert len(account_data["contacts"]) == 1
    assert len(account_data["deals"]) == 1
    deal_id = account_data["deals"][0]["id"]
    contact_id = account_data["contacts"][0]["id"]

    # Step 3: Generate Brief with labeled facts
    brief_res = await client.post("/api/enrich", json={"account_id": account_id})
    assert brief_res.status_code == 200
    brief = brief_res.json()
    assert len(brief["facts"]) >= 2
    for f in brief["facts"]:
        assert f["source_type"] in ["user-provided", "source-linked", "inference"]

    # Step 4: Generate Sequence
    seq_gen_res = await client.post("/api/sequence", json={"account_id": account_id, "contact_id": contact_id})
    assert seq_gen_res.status_code == 201
    seq = seq_gen_res.json()
    seq_id = seq["id"]
    assert seq["status"] == "pending"
    assert len(seq["steps"]) == 3

    # Approve Sequence
    appr_res = await client.post(f"/api/sequence/{seq_id}/approve", json={"notes": "Approved for Jordan Lee"})
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "approved"

    # Verify Deal moved to 'Outreach'
    deal_check = await client.get(f"/api/deals/{deal_id}")
    assert deal_check.json()["stage"] == "Outreach"

    # Step 5: Simulate Prospect Reply
    reply_text = "Hi! We desperately need this. Can we set up a 20-min demo on Thursday at 2pm?"
    analysis_res = await client.post("/api/interactions", json={
        "account_id": account_id,
        "contact_id": contact_id,
        "channel": "email_reply",
        "content": reply_text,
        "apply_immediately": False
    })
    assert analysis_res.status_code == 200
    analysis = analysis_res.json()
    assert analysis["sentiment"] == "positive"
    assert analysis["intent"] == "request_demo"

    # Step 6: Confirm interaction
    confirm_res = await client.post("/api/interactions/confirm", json={
        "account_id": account_id,
        "contact_id": contact_id,
        "channel": "email_reply",
        "content": reply_text,
        "confirmed_stage": analysis["proposed_update"]["proposed_stage"],
        "task_title": analysis["proposed_update"]["recommended_task_title"],
        "task_reason": analysis["proposed_update"]["recommended_task_reason"]
    })
    assert confirm_res.status_code == 200
    task_id = confirm_res.json()["task_id"]

    # Verify Deal stage updated to Demo Scheduled / Engaged
    deal_after = await client.get(f"/api/deals/{deal_id}")
    assert deal_after.json()["stage"] in ["Demo Scheduled", "Engaged"]

    # Step 7: Complete handoff task
    task_patch = await client.patch(f"/api/handoffs/{task_id}", json={"status": "completed"})
    assert task_patch.status_code == 200
    assert task_patch.json()["status"] == "completed"

    # Step 8: Verify timeline audit history
    act_res = await client.get(f"/api/activities?account_id={account_id}")
    assert act_res.status_code == 200
    acts = act_res.json()
    act_types = [a["type"] for a in acts]
    assert "import" in act_types
    assert "brief_generated" in act_types
    assert "sequence_generated" in act_types
    assert "sequence_approved" in act_types
    assert "inbound_interaction" in act_types
