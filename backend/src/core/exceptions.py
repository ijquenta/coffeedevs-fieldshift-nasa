from typing import Any


class PowerAPIError(Exception):
    """Error devuelto por NASA POWER o fallo de red hacia ella."""

    def __init__(self, status_code: int, detail: Any):
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail
