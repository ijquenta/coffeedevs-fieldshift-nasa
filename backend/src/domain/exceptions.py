class FieldShiftDomainException(Exception):
    """Excepción base del dominio FieldShift."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class SessionNotFoundError(FieldShiftDomainException):
    """Lanzada cuando no se encuentra una sesión activa."""

    def __init__(self, session_id: str) -> None:
        super().__init__(f"Sesión de chat '{session_id}' no encontrada.")
        self.session_id = session_id


class FieldNotFoundError(FieldShiftDomainException):
    """Lanzada cuando no se encuentra una parcela."""

    def __init__(self, field_id: str) -> None:
        super().__init__(f"Parcela '{field_id}' no encontrada en el repositorio satelital.")
        self.field_id = field_id


class AIProviderError(FieldShiftDomainException):
    """Lanzada cuando ocurre un error con el proveedor de IA."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Error del proveedor de IA: {detail}")
        self.detail = detail
