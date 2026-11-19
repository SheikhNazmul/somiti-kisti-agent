from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from app.modules.installments.models import Installment

CENT = Decimal("0.01")


def loan_totals(
    principal: Decimal, service_charge_pct: Decimal, num_installments: int
) -> tuple[Decimal, Decimal]:
    """Total payable and the per-installment amount for a loan (rule S1)."""
    total = (principal * (1 + service_charge_pct / 100)).quantize(
        CENT, rounding=ROUND_HALF_UP
    )
    installment = (total / num_installments).quantize(
        CENT, rounding=ROUND_HALF_UP
    )
    return total, installment


def build_installments(
    loan_id: int,
    principal: Decimal,
    service_charge_pct: Decimal,
    num_installments: int,
    start_date: date,
) -> list[Installment]:
    """Build the weekly installment rows for a loan (rules S1 and S2).

    Every installment is total / num_installments, except the last one,
    which absorbs the rounding difference so the rows sum to the total.
    The first installment is due one week after the start date.
    """
    total, installment = loan_totals(
        principal, service_charge_pct, num_installments
    )
    rows = []
    for number in range(1, num_installments + 1):
        if number < num_installments:
            amount_due = installment
        else:
            amount_due = total - installment * (num_installments - 1)
        rows.append(
            Installment(
                loan_id=loan_id,
                number=number,
                due_date=start_date + timedelta(weeks=number),
                amount_due=amount_due,
                amount_paid=Decimal("0"),
            )
        )
    return rows
