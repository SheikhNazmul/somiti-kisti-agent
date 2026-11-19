import random
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.gata import repositories
from app.modules.gata.models import (
    GataGroup,
    GataGroupStatus,
    GataMember,
    GataPayment,
)
from app.modules.gata.schemas import (
    GataGroupCreate,
    GataPaymentCreate,
    GataPayoutOut,
    GataStatusOut,
)
from app.modules.members import repositories as member_repositories
from app.modules.members.models import AccountType
from app.modules.users.models import User


def choose_winner(candidates: list[GataMember]) -> GataMember:
    """Lottery: pick one member at random from those who have not won."""
    return random.choice(candidates)


async def get_group(session: AsyncSession, group_id: int) -> GataGroup:
    group = await repositories.get_group_by_id(session, group_id)
    if group is None:
        raise NotFoundError("Gata group not found")
    return group


async def current_round(session: AsyncSession, group: GataGroup) -> int:
    members = await repositories.list_members(session, group.id)
    winners = sum(1 for m in members if m.has_won)
    return min(winners + 1, group.total_slots)


async def create_group(
    session: AsyncSession, data: GataGroupCreate
) -> GataGroup:
    existing = await repositories.get_group_by_name(session, data.name)
    if existing is not None:
        raise ConflictError("A gata group with this name already exists")
    group = GataGroup(
        name=data.name,
        amount=data.amount,
        frequency=data.frequency,
        total_slots=data.total_slots,
        start_date=data.start_date,
        status=GataGroupStatus.forming,
    )
    await repositories.add_group(session, group)
    await session.refresh(group)
    return group


async def list_groups(
    session: AsyncSession,
    status: GataGroupStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[GataGroup]:
    return await repositories.list_groups(
        session, status=status, limit=limit, offset=offset
    )


async def add_member(
    session: AsyncSession, group_id: int, member_id: int
) -> GataMember:
    group = await get_group(session, group_id)
    if group.status != GataGroupStatus.forming:
        raise ConflictError(
            "Members can only be added while the group is forming"
        )
    member = await member_repositories.get_member_by_id(session, member_id)
    if member is None:
        raise NotFoundError("Member not found")
    if member.account_type == AccountType.loan:
        raise ConflictError("A loan-only member cannot join a gata group")
    existing = await repositories.get_gata_member(
        session, group_id, member_id
    )
    if existing is not None:
        raise ConflictError("Member is already in this group")
    count = await repositories.count_members(session, group_id)
    if count >= group.total_slots:
        raise ConflictError("The group is full")
    gata_member = GataMember(
        group_id=group_id, member_id=member_id, position=count + 1
    )
    await repositories.add_gata_member(session, gata_member)
    await session.refresh(gata_member)
    return gata_member


async def start_group(session: AsyncSession, group_id: int) -> GataGroup:
    group = await get_group(session, group_id)
    if group.status != GataGroupStatus.forming:
        raise ConflictError("Only a forming group can be started")
    count = await repositories.count_members(session, group_id)
    if count != group.total_slots:
        raise ConflictError(
            f"Group is not full: {count} of {group.total_slots} members"
        )
    group.status = GataGroupStatus.running
    await session.flush()
    await session.refresh(group)
    return group


async def record_payment(
    session: AsyncSession,
    group_id: int,
    data: GataPaymentCreate,
    current_user: User,
) -> GataPayment:
    group = await get_group(session, group_id)
    if group.status != GataGroupStatus.running:
        raise ConflictError(
            "Payments are only accepted in a running group"
        )
    gata_member = await repositories.get_gata_member(
        session, group_id, data.member_id
    )
    if gata_member is None:
        raise NotFoundError("Member is not in this group")
    round_now = await current_round(session, group)
    if data.round_number != round_now:
        raise ConflictError(
            f"Payments are only accepted for the current round ({round_now})"
        )
    existing = await repositories.get_payment(
        session, group_id, data.member_id, data.round_number
    )
    if existing is not None:
        raise ConflictError(
            f"Member has already paid for round {data.round_number}"
        )
    payment = GataPayment(
        group_id=group_id,
        member_id=data.member_id,
        round_number=data.round_number,
        amount=data.amount,
        paid_on=date.today(),
        collected_by=current_user.id,
    )
    await repositories.add_payment(session, payment)
    await session.refresh(payment)
    return payment


async def payout(session: AsyncSession, group_id: int) -> GataPayoutOut:
    group = await get_group(session, group_id)
    if group.status != GataGroupStatus.running:
        raise ConflictError("Payout is only possible in a running group")
    members = await repositories.list_members(session, group.id)
    round_now = await current_round(session, group)
    payments = await repositories.list_payments_for_round(
        session, group.id, round_now
    )
    paid_ids = {p.member_id for p in payments}
    unpaid = [m for m in members if m.member_id not in paid_ids]
    if unpaid:
        names = []
        for gata_member in unpaid:
            member = await member_repositories.get_member_by_id(
                session, gata_member.member_id
            )
            names.append(member.full_name if member else str(gata_member.member_id))
        raise ConflictError(
            f"Cannot pay out round {round_now}: "
            f"these members have not paid: {', '.join(names)}"
        )
    candidates = [m for m in members if not m.has_won]
    if not candidates:
        raise ConflictError("Every member has already won")
    winner = choose_winner(candidates)
    winner.has_won = True
    winner.won_round = round_now
    if round_now >= group.total_slots:
        group.status = GataGroupStatus.completed
    await session.flush()
    member = await member_repositories.get_member_by_id(
        session, winner.member_id
    )
    return GataPayoutOut(
        group_id=group.id,
        round_number=round_now,
        winner_member_id=winner.member_id,
        winner_name=member.full_name if member else "",
        payout_amount=group.amount * group.total_slots,
        group_status=group.status,
    )


async def get_status(
    session: AsyncSession, group_id: int
) -> GataStatusOut:
    group = await get_group(session, group_id)
    members = await repositories.list_members(session, group.id)
    round_now = await current_round(session, group)
    payments = await repositories.list_payments_for_round(
        session, group.id, round_now
    )
    paid_ids = {p.member_id for p in payments}
    unpaid = [m for m in members if m.member_id not in paid_ids]
    unpaid_names = []
    for gata_member in unpaid:
        member = await member_repositories.get_member_by_id(
            session, gata_member.member_id
        )
        if member is not None:
            unpaid_names.append(member.full_name)
    return GataStatusOut(
        group_id=group.id,
        status=group.status,
        current_round=round_now,
        total_rounds=group.total_slots,
        winners_count=sum(1 for m in members if m.has_won),
        paid_member_ids=sorted(paid_ids),
        unpaid_member_ids=[m.member_id for m in unpaid],
        unpaid_member_names=unpaid_names,
        not_won_member_ids=[m.member_id for m in members if not m.has_won],
    )
