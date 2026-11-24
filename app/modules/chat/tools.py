from typing import Any

from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.gata import services as gata_services
from app.modules.installments import services as installment_services
from app.modules.knowledge import services as knowledge_services
from app.modules.loans import repositories as loan_repositories
from app.modules.members import services as member_services

# Read-only tools the chat assistant may call to answer with real data.
# The model never touches the database itself: it asks for a tool by name,
# execute_tool runs the matching service and returns plain data.
TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="find_member",
        description=(
            "Find somiti members by name or phone number. Use this first "
            "when a question mentions a member by name, to get the member id."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "search": types.Schema(
                    type=types.Type.STRING,
                    description="Part of the member's name, or a phone number.",
                )
            },
            required=["search"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_member_balance",
        description=(
            "Get one member's loan totals: total payable, total paid and "
            "remaining balance. Needs the member id from find_member."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "member_id": types.Schema(type=types.Type.INTEGER)
            },
            required=["member_id"],
        ),
    ),
    types.FunctionDeclaration(
        name="list_due_installments",
        description=(
            "List installments that are due and not fully paid, optionally "
            "for one area. Returns the total count and the first few items."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "area_id": types.Schema(type=types.Type.INTEGER)
            },
        ),
    ),
    types.FunctionDeclaration(
        name="list_gata_groups",
        description="List all gata groups with their status.",
        parameters=types.Schema(type=types.Type.OBJECT, properties={}),
    ),
    types.FunctionDeclaration(
        name="get_gata_status",
        description=(
            "Get one gata group's status: current round, how many winners "
            "so far, and which members have not paid in the current round."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "group_id": types.Schema(type=types.Type.INTEGER)
            },
            required=["group_id"],
        ),
    ),
    types.FunctionDeclaration(
        name="search_knowledge",
        description=(
            "Search the somiti's rule book for how things work: loan and "
            "installment rules, gata rules, membership rules. Use this for "
            "questions about rules and procedures, not for one member's "
            "personal numbers."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "query": types.Schema(
                    type=types.Type.STRING,
                    description="The rule question, in the user's own words.",
                )
            },
            required=["query"],
        ),
    ),
]


async def _find_member(session: AsyncSession, args: dict[str, Any]) -> dict:
    members = await member_services.list_members(
        session, search=str(args["search"]), limit=5
    )
    return {
        "members": [
            {
                "id": member.id,
                "full_name": member.full_name,
                "phone": member.phone,
                "area_id": member.area_id,
                "account_type": member.account_type.value,
            }
            for member in members
        ]
    }


async def _get_member_balance(
    session: AsyncSession, args: dict[str, Any]
) -> dict:
    balance = await member_services.get_balance(session, int(args["member_id"]))
    return {
        "member_id": balance.member_id,
        "loan_total": str(balance.loan_total),
        "total_paid": str(balance.total_paid),
        "remaining": str(balance.remaining),
    }


async def _list_due_installments(
    session: AsyncSession, args: dict[str, Any]
) -> dict:
    area_id = args.get("area_id")
    due = await installment_services.list_due(
        session, area_id=int(area_id) if area_id is not None else None
    )
    items = []
    for installment in due[:10]:
        loan = await loan_repositories.get_loan_by_id(
            session, installment.loan_id
        )
        member = None
        if loan is not None:
            member = await member_services.get_member(session, loan.member_id)
        items.append(
            {
                "member_name": member.full_name if member else None,
                "loan_id": installment.loan_id,
                "due_date": installment.due_date.isoformat(),
                "amount_due": str(installment.amount_due),
                "amount_paid": str(installment.amount_paid),
            }
        )
    return {"total_due": len(due), "items": items}


async def _list_gata_groups(session: AsyncSession, args: dict[str, Any]) -> dict:
    groups = await gata_services.list_groups(session)
    return {
        "groups": [
            {
                "id": group.id,
                "name": group.name,
                "amount": str(group.amount),
                "frequency": group.frequency.value,
                "total_slots": group.total_slots,
                "status": group.status.value,
            }
            for group in groups
        ]
    }


async def _get_gata_status(session: AsyncSession, args: dict[str, Any]) -> dict:
    status = await gata_services.get_status(session, int(args["group_id"]))
    return {
        "group_id": status.group_id,
        "status": status.status.value,
        "current_round": status.current_round,
        "total_rounds": status.total_rounds,
        "winners_count": status.winners_count,
        "unpaid_member_names": status.unpaid_member_names,
    }


async def _search_knowledge(
    session: AsyncSession, args: dict[str, Any]
) -> dict:
    result = await knowledge_services.search_knowledge(
        session, str(args["query"])
    )
    return {"passages": [row["content"] for row in result["results"]]}


_HANDLERS = {
    "find_member": _find_member,
    "get_member_balance": _get_member_balance,
    "list_due_installments": _list_due_installments,
    "list_gata_groups": _list_gata_groups,
    "get_gata_status": _get_gata_status,
    "search_knowledge": _search_knowledge,
}


async def execute_tool(
    session: AsyncSession, name: str, args: dict[str, Any]
) -> dict:
    """Run one tool call and return plain data for the model.

    Expected failures (for example an unknown member id) come back as an
    error dict so the model can explain them instead of crashing the chat.
    """
    handler = _HANDLERS.get(name)
    if handler is None:
        return {"error": f"Unknown tool: {name}"}
    try:
        return await handler(session, args)
    except AppError as error:
        return {"error": error.message}
