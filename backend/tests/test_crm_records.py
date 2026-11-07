import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_accounts_crud(client: AsyncClient):
    # List seeded accounts
    res = await client.get("/api/accounts")
    assert res.status_code == 200
    accounts = res.json()
    assert len(accounts) >= 3

    # Search accounts
    search_res = await client.get("/api/accounts?query=FinScale")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data) == 1
    assert search_data[0]["company_name"] == "FinScale AI"

    # Create new account
    create_res = await client.post("/api/accounts", json={
        "company_name": "Nexus Dynamics",
        "domain": "nexusdyn.com",
        "industry": "Robotics",
        "summary": "Autonomous logistics systems."
    })
    assert create_res.status_code == 201
    new_acc = create_res.json()
    acc_id = new_acc["id"]

    # Read account detail
    detail_res = await client.get(f"/api/accounts/{acc_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["company_name"] == "Nexus Dynamics"

    # Update account
    update_res = await client.patch(f"/api/accounts/{acc_id}", json={
        "industry": "Advanced Robotics"
    })
    assert update_res.status_code == 200
    assert update_res.json()["industry"] == "Advanced Robotics"


@pytest.mark.asyncio
async def test_deals_stage_progression_and_audit(client: AsyncClient):
    # Find a seeded deal
    deals_res = await client.get("/api/deals")
    assert deals_res.status_code == 200
    deals = deals_res.json()
    target_deal = deals[0]
    deal_id = target_deal["id"]
    acc_id = target_deal["account_id"]

    # Update deal stage
    patch_res = await client.patch(f"/api/deals/{deal_id}", json={
        "stage": "Engaged",
        "audit_reason": "Prospect confirmed receipt of architecture paper and requested followup"
    })
    assert patch_res.status_code == 200
    updated_deal = patch_res.json()
    assert updated_deal["stage"] == "Engaged"

    # Check that Activity was logged in audit history
    act_res = await client.get(f"/api/activities?account_id={acc_id}")
    assert act_res.status_code == 200
    activities = act_res.json()
    assert any("Engaged" in a["summary"] for a in activities)
