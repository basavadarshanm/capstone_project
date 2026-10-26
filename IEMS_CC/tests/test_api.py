from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def api_client(monkeypatch):
    import app

    monkeypatch.setattr(app, "_LEADS_STORE", [])
    return TestClient(app.app)


def test_health_endpoint(api_client):
    response = api_client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_lead_submission_and_listing(api_client):
    payload = {
        "name": "Test Customer",
        "phone": "+91 90000 00000",
        "city": "Mathura",
        "monthly_bill_inr": 2400,
        "recommended_system": "3 kW Solar + 5 kWh Battery",
    }

    created = api_client.post("/api/leads", json=payload)
    listed = api_client.get("/api/leads")

    assert created.status_code == 200
    assert created.json()["status"] == "success"
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["leads"][0]["name"] == "Test Customer"


def test_lead_validation_rejects_missing_required_fields(api_client):
    response = api_client.post("/api/leads", json={"name": "Incomplete"})

    assert response.status_code == 422
