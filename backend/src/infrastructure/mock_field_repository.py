from typing import Dict

from src.domain.exceptions import FieldNotFoundError
from src.schemas.chat import (
    ClimateNasaPower,
    FieldMockContext,
    RotationStrategy,
    SoilMoistureSMAP,
    TopographySRTM,
    VegetationSentinel2,
)


class MockFieldRepository:
    """Repositorio en memoria con datos satelitales realistas de parcelas agrícolas."""

    def __init__(self) -> None:
        self._fields: Dict[str, FieldMockContext] = self._cargar_parcelas_iniciales()

    def get_field_context(self, field_id: str) -> FieldMockContext:
        """Retorna las métricas satelitales y rotaciones de la parcela solicitada."""
        if field_id not in self._fields:
            raise FieldNotFoundError(field_id)
        return self._fields[field_id]

    def register_plot(self, plot_context: FieldMockContext) -> None:
        """Permite registrar nuevas parcelas dinámicamente cumpliendo el principio Open/Closed."""
        self._fields[plot_context.field_id] = plot_context

    def _cargar_parcelas_iniciales(self) -> Dict[str, FieldMockContext]:
        parcelas: Dict[str, FieldMockContext] = {}

        altiplano = FieldMockContext(
            field_id="plot-altiplano-01",
            name="Parcela Chijmuni - Altiplano Norte",
            department_or_region="La Paz / Altiplano Central",
            area_hectares=3.5,
            soil_moisture_smap=SoilMoistureSMAP(
                surface_moisture_m3_m3=0.14,
                rootzone_deficit_pct=-18.0,
                moisture_status="Déficit hídrico estacional moderado-severo en zona radicular",
            ),
            climate_nasa_power=ClimateNasaPower(
                annual_precipitation_mm=480.0,
                frost_risk_window="Mayo a Agosto (con picos en Junio/Julio)",
                min_temperature_frost_c=-6.2,
                avg_temperature_c=9.8,
            ),
            topography_srtm=TopographySRTM(
                elevation_masl=3820.0,
                slope_pct=6.0,
                erosion_risk="Moderado a alto por vientos invernales en rastrojo descubierto",
            ),
            vegetation_sentinel2=VegetationSentinel2(
                ndvi_current=0.18,
                bare_soil_months=["Agosto", "Septiembre", "Octubre"],
                canopy_coverage_pct=14.5,
            ),
            rotation_strategies=[
                RotationStrategy(
                    id="rot-actual",
                    title="1. Rotación Actual / Convencional (Línea Base)",
                    crops_cycle=[
                        "Año 1: Papa nativa / Waych'a",
                        "Invierno: Barbecho desnudo (suelo pelado)",
                        "Año 2: Papa o Cebada monocultivo",
                    ],
                    soil_cover_improvement="Baja o nula. Deja el suelo expuesto a desecación solar y viento entre agosto y octubre.",
                    water_retention_impact="Baja. Pérdida del 35% de humedad residual por evaporación directa.",
                    economic_tradeoff="Tradicional de bajo costo inmediato, pero con pérdida progresiva de materia orgánica y nutrientes.",
                    climate_resilience_rating="Baja (vulnerable a sequías y heladas radiativas)",
                ),
                RotationStrategy(
                    id="rot-conservation",
                    title="2. Rotación de Conservación de Agua y Suelo (Recomendada)",
                    crops_cycle=[
                        "Año 1: Papa con aporques altos",
                        "Post-cosecha/Invierno: Cultivo de cobertura Vicia villosa + Avena forrajera",
                        "Año 2: Quinua o Haba incorporando rastrojo acolchado (mulch)",
                    ],
                    soil_cover_improvement="Alta. Cubre el 75% del suelo durante los meses críticos (agosto-octubre), frenando la erosión.",
                    water_retention_impact="Excelente. Reduce la evaporación en 30-35% y maximiza la retención de las primeras lluvias de primavera.",
                    economic_tradeoff="Requiere inversión modesta en semillas de forraje, compensada con alimento animal en invierno o abono verde.",
                    climate_resilience_rating="Alta (mitiga heladas al conservar calor de suelo y retiene humedad SMAP)",
                ),
                RotationStrategy(
                    id="rot-nutrients",
                    title="3. Rotación de Recuperación de Nutrientes y Alto Rendimiento",
                    crops_cycle=[
                        "Año 1: Papa",
                        "Año 2: Leguminosa Haba criolla (fijación biológica de nitrógeno atmosférico)",
                        "Año 3: Quinua Real de exportación",
                    ],
                    soil_cover_improvement="Media a buena durante primavera-verano. Cobertura parcial en invierno.",
                    water_retention_impact="Moderada. Aporte de materia orgánica mejora la capacidad de retención de agua a mediano plazo.",
                    economic_tradeoff="Mayor retorno financiero por venta de haba verde y quinua, requiere manejo cuidadoso de fechas de siembra.",
                    climate_resilience_rating="Media-Alta (vigilar ventana de heladas para la siembra del haba)",
                ),
            ],
        )
        parcelas[altiplano.field_id] = altiplano

        valle = FieldMockContext(
            field_id="plot-valle-02",
            name="Parcela La Quebrada - Valle Bajo",
            department_or_region="Cochabamba / Valle Interandino",
            area_hectares=2.1,
            soil_moisture_smap=SoilMoistureSMAP(
                surface_moisture_m3_m3=0.18,
                rootzone_deficit_pct=-24.0,
                moisture_status="Déficit hídrico severo en época de estiaje",
            ),
            climate_nasa_power=ClimateNasaPower(
                annual_precipitation_mm=550.0,
                frost_risk_window="Junio a Julio (heladas esporádicas ligeras)",
                min_temperature_frost_c=-1.5,
                avg_temperature_c=16.4,
            ),
            topography_srtm=TopographySRTM(
                elevation_masl=2650.0,
                slope_pct=14.0,
                erosion_risk="Alto riesgo de escorrentía superficial y cárcavas en pendientes",
            ),
            vegetation_sentinel2=VegetationSentinel2(
                ndvi_current=0.22,
                bare_soil_months=["Julio", "Agosto", "Septiembre"],
                canopy_coverage_pct=22.0,
            ),
            rotation_strategies=[
                RotationStrategy(
                    id="rot-actual-valle",
                    title="1. Rotación Actual / Monocultivo Maíz",
                    crops_cycle=["Año 1: Maíz blanco", "Invierno: Rastrojo pastoreado", "Año 2: Maíz"],
                    soil_cover_improvement="Baja. El sobrepastoreo en invierno deja surcos vulnerables a deslaves.",
                    water_retention_impact="Baja. Rápido escurrimiento y pérdida del 40% del agua de lluvia.",
                    economic_tradeoff="Bajo costo pero empobrecimiento acelerado del suelo fértil.",
                    climate_resilience_rating="Baja",
                ),
                RotationStrategy(
                    id="rot-conservation-valle",
                    title="2. Conservación en Terrazas / Curvas a Nivel con Canavalia",
                    crops_cycle=[
                        "Año 1: Maíz intercalado con pasto vetiver en curvas de nivel",
                        "Invierno: Canavalia ensiformis como abono verde",
                        "Año 2: Fríjol / Leguminosa de porte medio",
                    ],
                    soil_cover_improvement="Muy Alta. Reduce el arrastre de suelo en más de un 60%.",
                    water_retention_impact="Alta. Incrementa la infiltración del agua de lluvia.",
                    economic_tradeoff="Requiere mano de obra inicial para trazo de curvas de nivel.",
                    climate_resilience_rating="Muy Alta",
                ),
                RotationStrategy(
                    id="rot-nutrients-valle",
                    title="3. Rotación Intensiva Maíz - Arveja - Hortalizas",
                    crops_cycle=["Año 1: Maíz forrajero", "Invierno: Arveja para vaina fresca", "Año 2: Cebolla/Zapallo"],
                    soil_cover_improvement="Media con cobertura invernal de arveja.",
                    water_retention_impact="Media con necesidad de riego suplementario por goteo.",
                    economic_tradeoff="Ingresos monetarios continuos a lo largo de 3 campañas.",
                    climate_resilience_rating="Media (requiere disponibilidad de agua de riego)",
                ),
            ],
        )
        parcelas[valle.field_id] = valle

        return parcelas
