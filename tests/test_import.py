import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_sample_csv(client: AsyncClient):
    response = await client.get("/api/import/sample")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    content = response.text
    assert "name,title,company,email,website,notes" in content
    assert "FinScale AI" in content


@pytest.mark.asyncio
async def test_preview_csv(client: AsyncClient):
    csv_data = """name,title,company,email,website,notes
Alice Smith,CEO,Acme Labs,alice@acmelabs.com,https://acmelabs.com,Looking for CRM automation
Bob Jones,,Initech,bob@initech.com,,Legacy spreadsheets
"""
    response = await client.post("/api/import/preview", json={"csv_text": csv_data})
    assert response.status_code == 200
    data = response.json()
    assert data["total_rows"] == 2
    assert data["valid_rows"] == 2
    assert data["invalid_rows"] == 0
    assert len(data["preview"]) == 2
    assert data["preview"][0]["name"] == "Alice Smith"
    assert data["preview"][0]["company"] == "Acme Labs"


@pytest.mark.asyncio
async def test_import_leads_csv_text(client: AsyncClient):
    csv_data = """name,title,company,email,website,notes
Victor Vance,VP Engineering,Starlight Dev,victor@starlightdev.io,https://starlightdev.io,Series B developer tools
"""
    response = await client.post("/api/import", data={"csv_text": csv_data})
    assert response.status_code == 201
    data = response.json()
    assert data["imported_accounts"] == 1
    assert data["imported_contacts"] == 1
    assert data["imported_deals"] == 1
    account_id = data["account_ids"][0]

    # Verify created account and records
    acc_res = await client.get(f"/api/accounts/{account_id}")
    assert acc_res.status_code == 200
    acc_data = acc_res.json()
    assert acc_data["company_name"] == "Starlight Dev"
    assert len(acc_data["contacts"]) == 1
    assert acc_data["contacts"][0]["name"] == "Victor Vance"
    assert len(acc_data["deals"]) == 1
    assert acc_data["deals"][0]["stage"] == "Prospecting"
    assert any(a["type"] == "import" for a in acc_data["activities"])
