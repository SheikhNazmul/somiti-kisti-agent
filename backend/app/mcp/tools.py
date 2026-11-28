"""The seven read-only tools, as plain functions.

server.py registers each of these with the MCP server. Every one
forwards to app.modules.chat.tools.execute_tool through run_tool, so
the answers are identical to the chat's.
"""

from typing import Any

from app.mcp.dependencies import run_tool


async def find_member(search: str) -> dict:
    """Find somiti members by name or phone number.

    Use this first when a question mentions a member by name, to get the
    member id that the other tools need.
    """
    return await run_tool("find_member", {"search": search})


async def get_member_balance(member_id: int) -> dict:
    """Get one member's loan totals: total payable, total paid, remaining.

    Needs the member id from find_member.
    """
    return await run_tool("get_member_balance", {"member_id": member_id})


async def list_due_installments(area_id: int | None = None) -> dict:
    """List installments that are due and not fully paid.

    Optionally limit the list to one area. Returns the total count and
    the first few items.
    """
    args: dict[str, Any] = {}
    if area_id is not None:
        args["area_id"] = area_id
    return await run_tool("list_due_installments", args)


async def list_gata_groups() -> dict:
    """List all gata (rotating group savings) groups with their status."""
    return await run_tool("list_gata_groups", {})


async def get_gata_status(group_id: int) -> dict:
    """Get one gata group's status.

    The current round, how many winners so far, and which members have
    not paid in the current round.
    """
    return await run_tool("get_gata_status", {"group_id": group_id})


async def search_knowledge(query: str) -> dict:
    """Search the somiti's rule book.

    Use this for questions about rules and procedures: loan and
    installment rules, gata rules, membership rules. Returns the closest
    rule passages.
    """
    return await run_tool("search_knowledge", {"query": query})


async def get_collection_summary(
    period: str = "last_7_days",
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """Get the total money collected in a period.

    Loan installments paid plus gata payments, each part and the grand
    total. period is today, last_7_days, this_month or custom; custom
    also needs start_date and end_date as YYYY-MM-DD.
    """
    args: dict[str, Any] = {"period": period}
    if start_date is not None:
        args["start_date"] = start_date
    if end_date is not None:
        args["end_date"] = end_date
    return await run_tool("get_collection_summary", args)
