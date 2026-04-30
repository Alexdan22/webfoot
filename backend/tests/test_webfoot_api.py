"""Backend tests for Webfoot API (leads + status + root)."""
import os
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read from frontend env file
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Root ----------
class TestRoot:
    def test_root_returns_200_with_message(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "message" in data
        assert isinstance(data["message"], str)
        assert len(data["message"]) > 0


# ---------- Leads ----------
class TestLeads:
    def test_create_lead_valid_returns_201(self, api_client):
        payload = {
            "name": "TEST_Alex Buyer",
            "email": "TEST_alex_buyer@example.com",
            "phone": "+1234567890",
            "business_type": "Restaurant",
            "message": "TEST_Interested in a simple landing page."
        }
        r = api_client.post(f"{API}/leads", json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert "id" in data and isinstance(data["id"], str) and len(data["id"]) > 0
        assert "created_at" in data
        # parse created_at
        datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
        assert data["name"] == payload["name"]
        assert data["email"] == payload["email"]
        assert data["phone"] == payload["phone"]
        assert data["business_type"] == payload["business_type"]
        assert data["message"] == payload["message"]
        assert "_id" not in data

    def test_create_lead_minimal_required_only(self, api_client):
        payload = {
            "name": "TEST_Minimal",
            "email": "TEST_minimal@example.com",
            "message": "TEST_Hello"
        }
        r = api_client.post(f"{API}/leads", json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["phone"] is None
        assert data["business_type"] is None
        assert "_id" not in data

    def test_create_lead_invalid_email_returns_422(self, api_client):
        payload = {
            "name": "TEST_BadEmail",
            "email": "not-an-email",
            "message": "TEST_Invalid email"
        }
        r = api_client.post(f"{API}/leads", json=payload)
        assert r.status_code == 422, r.text

    def test_create_lead_missing_name_returns_422(self, api_client):
        payload = {
            "email": "TEST_missing_name@example.com",
            "message": "TEST_missing name"
        }
        r = api_client.post(f"{API}/leads", json=payload)
        assert r.status_code == 422, r.text

    def test_create_lead_missing_message_returns_422(self, api_client):
        payload = {
            "name": "TEST_NoMsg",
            "email": "TEST_nomsg@example.com"
        }
        r = api_client.post(f"{API}/leads", json=payload)
        assert r.status_code == 422, r.text

    def test_create_lead_empty_name_returns_422(self, api_client):
        payload = {
            "name": "",
            "email": "TEST_empty_name@example.com",
            "message": "TEST_empty"
        }
        r = api_client.post(f"{API}/leads", json=payload)
        assert r.status_code == 422, r.text

    def test_list_leads_returns_list_sorted_desc(self, api_client):
        r = api_client.get(f"{API}/leads")
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        # verify no _id
        for it in items:
            assert "_id" not in it
            assert "id" in it
            assert "created_at" in it
        # verify desc sort
        timestamps = [
            datetime.fromisoformat(it["created_at"].replace("Z", "+00:00"))
            for it in items
        ]
        for i in range(len(timestamps) - 1):
            assert timestamps[i] >= timestamps[i + 1], "leads not sorted desc by created_at"

    def test_list_leads_contains_recently_created(self, api_client):
        marker_email = "TEST_marker_lookup@example.com"
        create_payload = {
            "name": "TEST_Marker",
            "email": marker_email,
            "message": "TEST_findme"
        }
        cr = api_client.post(f"{API}/leads", json=create_payload)
        assert cr.status_code == 201
        created_id = cr.json()["id"]

        r = api_client.get(f"{API}/leads", params={"limit": 500})
        assert r.status_code == 200
        items = r.json()
        found = [it for it in items if it["id"] == created_id]
        assert found, f"created lead {created_id} not found in list"
        assert found[0]["email"] == marker_email

    def test_list_leads_limit_param(self, api_client):
        # ensure at least 2 leads exist
        for i in range(2):
            api_client.post(f"{API}/leads", json={
                "name": f"TEST_LimitUser{i}",
                "email": f"TEST_limit{i}@example.com",
                "message": "TEST_limit"
            })
        r = api_client.get(f"{API}/leads", params={"limit": 1})
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1

    def test_list_leads_limit_clamped_low(self, api_client):
        # limit=0 should clamp to 1
        r = api_client.get(f"{API}/leads", params={"limit": 0})
        assert r.status_code == 200
        items = r.json()
        assert len(items) <= 1

    def test_list_leads_limit_clamped_high(self, api_client):
        # limit=9999 should clamp to 500; just verify 200 response
        r = api_client.get(f"{API}/leads", params={"limit": 9999})
        assert r.status_code == 200
        items = r.json()
        assert len(items) <= 500


# ---------- Status (regression) ----------
class TestStatus:
    def test_post_status(self, api_client):
        r = api_client.post(f"{API}/status", json={"client_name": "TEST_client"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["client_name"] == "TEST_client"
        assert "id" in data
        assert "timestamp" in data
        assert "_id" not in data

    def test_get_status(self, api_client):
        r = api_client.get(f"{API}/status")
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert "_id" not in it
