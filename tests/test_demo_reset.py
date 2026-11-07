import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_demo_reset_and_overview(client: AsyncClient):
    # 1. Reset database with seed=True
    reset_res = await client.post("/api/reset?seed=true")
    assert reset_res.status_code == 200
    res_data = reset_res.json()
    assert res_data["status"] == "reset_and_seeded"
    assert len(res_data["seeded_accounts"]) >= 3

    # 2. Check demo data overview
    overview_res = await client.get("/api/demo-data")
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert overview["count"] >= 3
    assert any(a["company_name"] == "FinScale AI" for a in overview["accounts"])


@pytest.mark.asyncio
async def test_wren_qa_workflows(client: AsyncClient):
    # Status endpoint
    status_res = await client.get("/api/qa/status")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "ready"

    # Workflow A verification
    wf_a_res = await client.get("/api/qa/verify-import")
    assert wf_a_res.status_code == 200
    wf_a_data = wf_a_res.json()
    assert wf_a_data["passed"] is True
    assert wf_a_data["workflow"] == "Workflow A: Import and prepare"

    # Workflow B verification
    wf_b_res = await client.get("/api/qa/verify-handoff")
    assert wf_b_res.status_code == 200
    wf_b_data = wf_b_res.json()
    assert wf_b_data["passed"] is True
    assert wf_b_data["workflow"] == "Workflow B: Update and hand off"
