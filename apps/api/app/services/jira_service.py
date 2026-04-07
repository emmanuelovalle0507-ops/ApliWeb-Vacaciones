"""
Jira integration service.
Queries Jira REST API to fetch issues assigned to an employee
within a given date range.  Uses Basic Auth (email + API token).
"""
import logging
from datetime import date

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 15  # seconds


def _is_configured() -> bool:
    return bool(settings.jira_base_url and settings.jira_user_email and settings.jira_api_token)


def _auth() -> httpx.BasicAuth:
    return httpx.BasicAuth(settings.jira_user_email, settings.jira_api_token)


def _base_url() -> str:
    return settings.jira_base_url.rstrip("/")


def get_employee_issues(
    employee_email: str,
    start_date: date,
    end_date: date,
    *,
    max_results: int = 50,
) -> dict:
    """
    Fetch Jira issues assigned to *employee_email* that overlap with
    the [start_date, end_date] range.

    Returns:
      {
        "configured": bool,
        "success": bool,
        "total": int,
        "issues": [ {key, summary, status, priority, due_date, sprint, project, url} ],
        "high_priority_count": int,
        "due_during_period": int,
        "error": str | None,
      }
    """
    if not _is_configured():
        return {
            "configured": False,
            "success": False,
            "total": 0,
            "issues": [],
            "high_priority_count": 0,
            "due_during_period": 0,
            "error": "Jira no está configurado.",
        }

    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    # JQL: issues assigned to employee that are not Done,
    # either with duedate in range OR no duedate but in open sprint
    jql = (
        f'assignee = "{employee_email}" '
        f"AND statusCategory != Done "
        f"AND ("
        f"  (duedate >= \"{start_str}\" AND duedate <= \"{end_str}\")"
        f"  OR duedate is EMPTY"
        f"  OR sprint in openSprints()"
        f")"
        f" ORDER BY priority DESC, duedate ASC"
    )

    fields = "summary,status,priority,duedate,project,sprint,issuetype"

    try:
        resp = httpx.post(
            f"{_base_url()}/rest/api/3/search/jql",
            json={"jql": jql, "fields": fields.split(","), "maxResults": max_results},
            auth=_auth(),
            timeout=_TIMEOUT,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("Jira API HTTP error: %s – %s", exc.response.status_code, exc.response.text[:300])
        return {
            "configured": True,
            "success": False,
            "total": 0,
            "issues": [],
            "high_priority_count": 0,
            "due_during_period": 0,
            "error": f"Error de Jira: {exc.response.status_code}",
        }
    except httpx.RequestError as exc:
        logger.warning("Jira API request error: %s", exc)
        return {
            "configured": True,
            "success": False,
            "total": 0,
            "issues": [],
            "high_priority_count": 0,
            "due_during_period": 0,
            "error": f"No se pudo conectar a Jira: {exc}",
        }

    # Parse issues
    issues = []
    high_priority_count = 0
    due_during_period = 0

    priority_map = {"highest": "Crítica", "high": "Alta", "medium": "Media", "low": "Baja", "lowest": "Muy baja"}

    for item in data.get("issues", []):
        fields_data = item.get("fields", {})

        # Priority
        prio_obj = fields_data.get("priority") or {}
        prio_name_raw = (prio_obj.get("name") or "Medium").lower()
        prio_display = priority_map.get(prio_name_raw, prio_obj.get("name", "Media"))

        # Status
        status_obj = fields_data.get("status") or {}
        status_name = status_obj.get("name", "Desconocido")

        # Due date
        due_raw = fields_data.get("duedate")
        due_display = None
        if due_raw:
            due_display = due_raw  # "YYYY-MM-DD"
            try:
                due_dt = date.fromisoformat(due_raw)
                if start_date <= due_dt <= end_date:
                    due_during_period += 1
            except ValueError:
                pass

        # Sprint (can be a list, take the most recent)
        sprint_obj = fields_data.get("sprint")
        sprint_name = None
        if isinstance(sprint_obj, dict):
            sprint_name = sprint_obj.get("name")
        elif isinstance(sprint_obj, list) and sprint_obj:
            sprint_name = sprint_obj[-1].get("name") if isinstance(sprint_obj[-1], dict) else None

        # Project
        project_obj = fields_data.get("project") or {}
        project_name = project_obj.get("name", "")
        project_key = project_obj.get("key", "")

        # Issue key & URL
        issue_key = item.get("key", "")
        issue_url = f"{_base_url()}/browse/{issue_key}"

        if prio_name_raw in ("highest", "high"):
            high_priority_count += 1

        issues.append({
            "key": issue_key,
            "summary": fields_data.get("summary", ""),
            "status": status_name,
            "priority": prio_display,
            "priority_raw": prio_name_raw,
            "due_date": due_display,
            "sprint": sprint_name,
            "project": f"{project_name} ({project_key})" if project_key else project_name,
            "url": issue_url,
            "type": (fields_data.get("issuetype") or {}).get("name", "Task"),
        })

    return {
        "configured": True,
        "success": True,
        "total": len(issues),
        "issues": issues,
        "high_priority_count": high_priority_count,
        "due_during_period": due_during_period,
        "error": None,
    }


def test_connection() -> dict:
    """Test the Jira connection and return basic info."""
    if not _is_configured():
        return {"connected": False, "error": "Jira no está configurado."}

    try:
        resp = httpx.get(
            f"{_base_url()}/rest/api/3/myself",
            auth=_auth(),
            timeout=_TIMEOUT,
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "connected": True,
            "display_name": data.get("displayName", ""),
            "email": data.get("emailAddress", ""),
            "account_id": data.get("accountId", ""),
            "error": None,
        }
    except Exception as exc:
        logger.warning("Jira connection test failed: %s", exc)
        return {"connected": False, "error": str(exc)}
