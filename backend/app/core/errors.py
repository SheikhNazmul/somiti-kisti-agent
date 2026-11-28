class AppError(Exception):
    """Base error for expected API failures.

    Carries the HTTP status, a short machine-readable code and a safe
    message that may be shown to the client.
    """

    status_code: int = 500
    code: str = "app_error"
    default_message: str = "Something went wrong"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    default_message = "Resource not found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    default_message = "The operation conflicts with existing data"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"
    default_message = "Unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"
    default_message = "Forbidden"
