import asyncio
import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.modules.areas.models import Area, CollectionDay
from app.modules.gata.models import (
    GataFrequency,
    GataGroup,
    GataGroupStatus,
    GataMember,
    GataPayment,
)
from app.modules.loans.calculations import build_installments, loan_totals
from app.modules.loans.models import Loan, LoanStatus
from app.modules.members.models import AccountType, Member
from app.modules.users.models import User, UserRole

DATA_DIR = Path(__file__).parent / "data"


def load(name: str) -> list | dict:
    return json.loads((DATA_DIR / name).read_text())


async def seed_areas(session) -> dict[str, Area]:
    areas = {}
    for item in load("areas.json"):
        area = await session.scalar(
            select(Area).where(Area.name == item["name"])
        )
        if area is None:
            area = Area(
                name=item["name"],
                collection_day=CollectionDay(item["collection_day"]),
            )
            session.add(area)
            await session.flush()
        areas[area.name] = area
    return areas


async def seed_users(session) -> list[User]:
    users = []
    for item in load("users.json"):
        user = await session.scalar(
            select(User).where(User.email == item["email"])
        )
        if user is None:
            user = User(
                email=item["email"],
                password_hash=hash_password(item["password"]),
                full_name=item["full_name"],
                role=UserRole(item["role"]),
            )
            session.add(user)
            await session.flush()
        users.append(user)
    return users


async def seed_members(session, areas: dict[str, Area]) -> dict[str, Member]:
    members = {}
    for item in load("members.json"):
        member = await session.scalar(
            select(Member).where(Member.phone == item["phone"])
        )
        if member is None:
            member = Member(
                full_name=item["full_name"],
                phone=item["phone"],
                nid_last4=item["nid_last4"],
                area_id=areas[item["area"]].id,
                account_type=AccountType(item["account_type"]),
                joined_on=date.fromisoformat(item["joined_on"]),
            )
            session.add(member)
            await session.flush()
        members[member.phone] = member
    return members


async def seed_loans(session, members: dict[str, Member], collector: User) -> None:
    for item in load("loans.json"):
        member = members[item["member_phone"]]
        start_date = date.fromisoformat(item["start_date"])
        existing = await session.scalar(
            select(Loan).where(
                Loan.member_id == member.id, Loan.start_date == start_date
            )
        )
        if existing is not None:
            continue
        principal = Decimal(str(item["principal"]))
        pct = Decimal(str(item["service_charge_pct"]))
        total, installment_amount = loan_totals(
            principal, pct, item["num_installments"]
        )
        loan = Loan(
            member_id=member.id,
            principal=principal,
            service_charge_pct=pct,
            total_payable=total,
            num_installments=item["num_installments"],
            installment_amount=installment_amount,
            start_date=start_date,
            status=LoanStatus(item["status"]),
        )
        session.add(loan)
        await session.flush()
        rows = build_installments(
            loan.id,
            principal,
            pct,
            item["num_installments"],
            start_date,
        )
        for row in rows[: item["paid_installments"]]:
            row.amount_paid = row.amount_due
            row.paid_on = row.due_date
            row.collected_by = collector.id
        session.add_all(rows)
        await session.flush()


async def seed_gata(session, members: dict[str, Member], collector: User) -> None:
    data = load("gata.json")
    group = await session.scalar(
        select(GataGroup).where(GataGroup.name == data["name"])
    )
    if group is None:
        group = GataGroup(
            name=data["name"],
            amount=Decimal(str(data["amount"])),
            frequency=GataFrequency(data["frequency"]),
            total_slots=data["total_slots"],
            start_date=date.fromisoformat(data["start_date"]),
            status=GataGroupStatus(data["status"]),
        )
        session.add(group)
        await session.flush()
    rounds_completed = data["rounds_completed"]
    for position, phone in enumerate(data["member_phones"], start=1):
        member = members[phone]
        gata_member = await session.scalar(
            select(GataMember).where(
                GataMember.group_id == group.id,
                GataMember.member_id == member.id,
            )
        )
        if gata_member is None:
            won_round = position if position <= rounds_completed else None
            session.add(
                GataMember(
                    group_id=group.id,
                    member_id=member.id,
                    position=position,
                    has_won=won_round is not None,
                    won_round=won_round,
                )
            )
        for round_number in range(1, rounds_completed + 1):
            payment = await session.scalar(
                select(GataPayment).where(
                    GataPayment.group_id == group.id,
                    GataPayment.member_id == member.id,
                    GataPayment.round_number == round_number,
                )
            )
            if payment is None:
                session.add(
                    GataPayment(
                        group_id=group.id,
                        member_id=member.id,
                        round_number=round_number,
                        amount=group.amount,
                        paid_on=group.start_date
                        + timedelta(weeks=round_number - 1),
                        collected_by=collector.id,
                    )
                )
    await session.flush()


async def main() -> None:
    async with SessionLocal() as session:
        areas = await seed_areas(session)
        users = await seed_users(session)
        members = await seed_members(session, areas)
        collector = next(u for u in users if u.role == UserRole.collector)
        await seed_loans(session, members, collector)
        await seed_gata(session, members, collector)
        await session.commit()
    print("Seed complete: areas, users, members, loans and gata are in place.")


if __name__ == "__main__":
    asyncio.run(main())
