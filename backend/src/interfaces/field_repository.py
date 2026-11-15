from typing import Protocol

from src.schemas.chat import FieldMockContext


class FieldRepository(Protocol):
    """Contrato mínimo para obtener el contexto satelital de una parcela."""

    def get_field_context(self, field_id: str) -> FieldMockContext: ...
