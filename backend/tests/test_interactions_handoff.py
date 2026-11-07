import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_interaction_analysis_and_confirmation_loop(client: AsyncClient):
    accs_res = await client.get("/api/accounts")
    accounts = accs_res.json()
    account_id = accounts[0]["id"]

    simulated_reply = "Hi! We'd love to see a demo of this. Does this Thursday at 3pm work for your team?"

    # 1. Preview / Analyze interaction
    analysis_res = await client.post("/api/interactions", json={
        "account_id": account_id,
        "channel": "email_reply",
        "content": simulated_reply,
        "apply_immediately": False
    })
    assert analysis_res.status_code == 200
    data = analysis_res.json()
    assert data["sentiment"] == "positive"
    assert data["intent"] == "request_demo"
    assert data["applied"] is False
    assert data["proposed_update"]["proposed_stage"] in ["Demo Scheduled", "Engaged"]

    # 2. Confirm interaction updates
    confirm_res = await client.post("/api/interactions/confirm", json={
        "account_id": account_id,
        "channel": "email_reply",
        "content": simulated_reply,
        "confirmed_stage": data["proposed_update"]["proposed_stage"],
        "task_title": data["proposed_update"]["recommended_task_title"],
        "task_reason": data["proposed_update"]["recommended_task_reason"]
    })
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["status"] == "confirmed"
    assert confirm_data["task_id"] is not None

    # 3. Verify deal stage updated in CRM
    acc_detail = await client.get(f"/api/accounts/{account_id}")
    acc_data = acc_detail.json()
    deal = acc_data["deals"][0]
    assert deal["stage"] in ["Demo Scheduled", "Engaged"]

    # 4. Verify handoff task created in queue
    handoff_res = await client.get("/api/handoffs?status=pending")
    assert handoff_res.status_code == 200
    handoffs = handoff_res.json()
    assert any(h["id"] == confirm_data["task_id"] for h in handoffs)

    # 5. Verify immutable activity was recorded
    act_res = await client.get(f"/api/activities?account_id={account_id}")
    acts = act_res.json()
    assert any(a["type"] == "inbound_interaction" for a in acts)
