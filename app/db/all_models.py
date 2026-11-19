"""Import all models here."""

from app.modules.areas.models import Area  # noqa: F401
from app.modules.gata.models import (  # noqa: F401
    GataGroup,
    GataMember,
    GataPayment,
)
from app.modules.installments.models import Installment  # noqa: F401
from app.modules.loans.models import Loan  # noqa: F401
from app.modules.members.models import Member  # noqa: F401
from app.modules.users.models import User  # noqa: F401
