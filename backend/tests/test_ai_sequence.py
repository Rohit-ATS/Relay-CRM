import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_brief_generation_with_labeled_facts(client: AsyncClient):
    accs_res = await client.get("/api/accounts")
    accounts = accs_res.json()
    account_id = accounts[0]["id"]

    res = await client.post("/api/enrich", json={"account_id": account_id})
    assert res.status_code == 200
    brief = res.json()
    assert "summary" in brief
    assert len(brief["facts"]) >= 1
    for fact in brief["facts"]:
        assert fact["source_type"] in ["user-provided", "source-linked", "inference"]
        assert 0.0 <= fact["confidence"] <= 1.0


@pytest.mark.asyncio
async def test_sequence_generation_and_approval_workflow(client: AsyncClient):
    accs_res = await client.get("/api/accounts")
    accounts = accs_res.json()
    account_id = accounts[0]["id"]

    # 1. Generate sequence
    gen_res = await client.post("/api/sequence", json={"account_id": account_id})
    assert gen_res.status_code == 201
    seq = gen_res.json()
    assert seq["status"] == "pending"
    assert len(seq["steps"]) == 3
    seq_id = seq["id"]
    first_step_id = seq["steps"][0]["id"]

    # 2. Edit a draft step
    edit_res = await client.patch(
        f"/api/sequence/{seq_id}/steps/{first_step_id}",
        json={"subject": "Customized Subject Line for Founder"}
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["subject"] == "Customized Subject Line for Founder"

    # 3. Approve sequence
    approve_res = await client.post(
        f"/api/sequence/{seq_id}/approve",
        json={"notes": "Reviewed and approved by sales lead"}
    )
    assert approve_res.status_code == 200
    approved_seq = approve_res.json()
    assert approved_seq["status"] == "approved"
    assert approved_seq["approved_at"] is not None

    # 4. Check timeline activity
    act_res = await client.get(f"/api/activities?account_id={account_id}")
    activities = act_res.json()
    assert any(a["type"] == "sequence_approved" for a in activities)
