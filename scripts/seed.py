"""Seed the database with starter data from scripts/data/*.json.

Run with:  uv run python -m scripts.seed

The script talks to the database directly through SessionLocal
(no FastAPI involved) and inserts in foreign-key order:
areas -> users -> members -> loans (+ installments) -> gata.
Every row is checked first by its natural unique key, so running
the script twice never creates duplicates.
"""

import asyncio
import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.modules.areas.models import Area, CollectionDay
from app.modules.gata.models import GataGroup, GataMember, GataPayment
from app.modules.installments.models import Installment
from app.modules.loans.models import Loan
from app.modules.members.models import AccountType, Member
from app.modules.users.models import User, UserRole

DATA_DIR = Path(__file__).parent / "data"
password_hasher = PasswordHash.recommended()


def load_json(filename: str) -> list[dict]:
    with open(DATA_DIR / filename, encoding="utf-8") as file:
        return json.load(file)


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


async def seed_areas(session: AsyncSession) -> dict[str, Area]:
    areas: dict[str, Area] = {}
    for item in load_json("areas.json"):
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


async def seed_users(session: AsyncSession) -> dict[str, User]:
    users: dict[str, User] = {}
    for item in load_json("users.json"):
        user = await session.scalar(
            select(User).where(User.email == item["email"])
        )
        if user is None:
            user = User(
                email=item["email"],
                password_hash=password_hasher.hash(item["password"]),
                full_name=item["full_name"],
                role=UserRole(item["role"]),
            )
            session.add(user)
            await session.flush()
        users[user.email] = user
    return users


async def seed_members(
    session: AsyncSession, areas: dict[str, Area]
) -> dict[str, Member]:
    members: dict[str, Member] = {}
    for item in load_json("members.json"):
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


async def seed_loans(
    session: AsyncSession,
    members: dict[str, Member],
    collector: User,
) -> None:
    for item in load_json("loans.json"):
        member = members[item["member_phone"]]
        principal = money(item["principal"])
        start_date = date.fromisoformat(item["start_date"])
        existing = await session.scalar(
            select(Loan).where(
                Loan.member_id == member.id,
                Loan.start_date == start_date,
                Loan.principal == principal,
            )
        )
        if existing is not None:
            continue
        total_payable = money(
            principal * (1 + money(item["service_charge_pct"]) / 100)
        )
        installment_amount = money(total_payable / item["num_installments"])
        loan = Loan(
            member_id=member.id,
            principal=principal,
            service_charge_pct=money(item["service_charge_pct"]),
            total_payable=total_payable,
            num_installments=item["num_installments"],
            installment_amount=installment_amount,
            start_date=start_date,
        )
        session.add(loan)
        await session.flush()
        for number in range(1, item["num_installments"] + 1):
            due_date = start_date + timedelta(weeks=number)
            paid = number <= item["paid_installments"]
            session.add(
                Installment(
                    loan_id=loan.id,
                    number=number,
                    due_date=due_date,
                    amount_due=installment_amount,
                    amount_paid=installment_amount if paid else Decimal("0"),
                    paid_on=due_date if paid else None,
                    collected_by=collector.id if paid else None,
                )
            )
        await session.flush()


async def seed_gata(
    session: AsyncSession, members: dict[str, Member]
) -> None:
    for item in load_json("gata.json"):
        group = await session.scalar(
            select(GataGroup).where(GataGroup.name == item["name"])
        )
        if group is None:
            group = GataGroup(
                name=item["name"],
                amount=money(item["amount"]),
                start_date=date.fromisoformat(item["start_date"]),
            )
            session.add(group)
            await session.flush()
        start_date = date.fromisoformat(item["start_date"])
        for position, phone in enumerate(item["member_phones"], start=1):
            member = members[phone]
            gata_member = await session.scalar(
                select(GataMember).where(
                    GataMember.group_id == group.id,
                    GataMember.member_id == member.id,
                )
            )
            if gata_member is None:
                gata_member = GataMember(
                    group_id=group.id, member_id=member.id, position=position
                )
                session.add(gata_member)
                await session.flush()
            if phone == item["winner_phone"] and not gata_member.has_won:
                gata_member.has_won = True
                gata_member.won_round = 1
            for round_number in range(1, item["paid_rounds"] + 1):
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
                            amount=money(item["amount"]),
                            paid_on=start_date
                            + timedelta(weeks=round_number - 1),
                        )
                    )
        await session.flush()


async def main() -> None:
    async with SessionLocal() as session:
        areas = await seed_areas(session)
        users = await seed_users(session)
        members = await seed_members(session, areas)
        collector = next(
            user for user in users.values() if user.role == UserRole.collector
        )
        await seed_loans(session, members, collector)
        await seed_gata(session, members)
        await session.commit()
    print("Seed complete: areas, users, members, loans and gata are in place.")


if __name__ == "__main__":
    asyncio.run(main())
