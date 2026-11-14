"""Grupos de parámetros POWER útiles para agricultura (comunidad AG)."""

PARAMETER_PRESETS: dict[str, list[str]] = {
    "temperature": ["T2M", "T2M_MAX", "T2M_MIN", "T2M_RANGE", "TS", "T2MDEW"],
    "precipitation": ["PRECTOTCORR"],
    "humidity": ["RH2M", "QV2M"],
    "wind": ["WS2M", "WS10M", "WD2M"],
    "solar": [
        "ALLSKY_SFC_SW_DWN",
        "CLRSKY_SFC_SW_DWN",
        "ALLSKY_SFC_PAR_TOT",
        "ALLSKY_SFC_LW_DWN",
    ],
    "soil_moisture": ["GWETTOP", "GWETROOT", "GWETPROF"],
    "evapotranspiration": ["EVPTRNS", "EVLAND"],
    "pressure": ["PS"],
}
PARAMETER_PRESETS["agro_all"] = [
    p for group in list(PARAMETER_PRESETS.values()) for p in group
]

# Parámetros de los presets que POWER no ofrece a resolución horaria.
HOURLY_UNAVAILABLE = {
    "T2M_MAX", "T2M_MIN", "T2M_RANGE", "GWETTOP", "GWETROOT", "GWETPROF",
    "EVPTRNS", "EVLAND",
}


def resolve_parameters(
    parameters: list[str], presets: list[str], hourly: bool
) -> list[str]:
    result: list[str] = [p.strip().upper() for p in parameters if p.strip()]
    for name in presets:
        group = PARAMETER_PRESETS[name]
        if hourly:
            group = [p for p in group if p not in HOURLY_UNAVAILABLE]
        result.extend(group)
    return list(dict.fromkeys(result))
