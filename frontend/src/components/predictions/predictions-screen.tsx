"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Activity, AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, Check, CircleHelp, CloudRain, Droplets, FlaskConical, Leaf, LoaderCircle, MapPinned, Mountain, RotateCcw, Send, ShieldAlert, Snowflake, Sprout, Thermometer, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeProduct, getPrediction } from "../../services/predictions";
import { PredictionServiceError } from "../../types/predictions";
import type { AnalyzeProductRequest, Confidence, GeoPolygon, Position, PredictionResponse, ProductAnalysisResponse, Signal } from "../../types/predictions";

const PredictionGlobe = dynamic(() => import("./prediction-globe"), { ssr: false, loading: () => <div className="grid h-full min-h-[380px] place-items-center bg-[#071124] text-sm text-slate-400"><LoaderCircle className="mr-2 animate-spin" size={16} /> Preparando el globo 3D…</div> });
const MAX_AREA_HA = Number(process.env.NEXT_PUBLIC_MAX_PREDICTION_AREA_HA) || 500;
const CROPS = ["Quinua", "Papa", "Haba", "Cebada", "Avena", "Alfalfa", "Maíz"];

type PeriodMode = "range" | "day";
type GlobeMode = "draw" | "edit" | "view";
const dateOffset = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function areaAndCenter(points: Position[]) {
  if (points.length < 3) return { area: 0, center: [0, 0] as Position };
  const lat0 = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const scaleX = 111.32 * Math.cos(lat0 * Math.PI / 180);
  const scaleY = 110.574;
  const planar = points.map(([lng, lat]) => [lng * scaleX, lat * scaleY] as Position);
  let area2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < planar.length; i += 1) {
    const [x1, y1] = planar[i], [x2, y2] = planar[(i + 1) % planar.length];
    const cross = x1 * y2 - x2 * y1;
    area2 += cross; cx += (x1 + x2) * cross; cy += (y1 + y2) * cross;
  }
  const area = Math.abs(area2) / 2;
  if (Math.abs(area2) < .001) return { area: 0, center: [0, 0] as Position };
  const centerX = cx / (3 * area2), centerY = cy / (3 * area2);
  return { area: area * 100, center: [centerX / scaleX, centerY / scaleY] as Position };
}

function makePolygon(vertices: Position[]): GeoPolygon {
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...vertices, vertices[0]]] } };
}

function validatePolygon(points: Position[], area: number): string | null {
  if (points.length < 3) return "Dibuja una parcela con al menos 3 vértices.";
  if (new Set(points.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`)).size < 3) return "Agrega tres puntos distintos para delimitar el campo.";
  const intersects = (a: Position, b: Position, c: Position, d: Position) => {
    const orientation = (p: Position, q: Position, r: Position) => (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
    const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
    return o1 * o2 < 0 && o3 * o4 < 0;
  };
  for (let i = 0; i < points.length; i += 1) {
    const nextI = (i + 1) % points.length;
    for (let j = i + 1; j < points.length; j += 1) {
      const nextJ = (j + 1) % points.length;
      if (i === j || nextI === j || nextJ === i) continue;
      if (intersects(points[i], points[nextI], points[j], points[nextJ])) return "El límite se cruza consigo mismo. Mueve los vértices para formar una parcela simple.";
    }
  }
  if (area < .01) return "El polígono es demasiado pequeño o sus puntos están alineados.";
  if (area > MAX_AREA_HA) return `El área estimada supera el máximo de ${MAX_AREA_HA} ha. Ajusta el polígono o configura el límite.`;
  return null;
}

export default function PredictionsScreen() {
  const [vertices, setVertices] = useState<Position[]>([]);
  const [mode, setMode] = useState<GlobeMode>("view");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("range");
  const [dateFrom, setDateFrom] = useState("2026-11-08");
  const [dateTo, setDateTo] = useState("2026-11-14");
  const [priority, setPriority] = useState("Agua disponible");
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState("");
  const [analysis, setAnalysis] = useState<ProductAnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const analysisRequestRef = useRef<AbortController | null>(null);
  const geometry = useMemo(() => areaAndCenter(vertices), [vertices]);
  const polygonError = useMemo(() => validatePolygon(vertices, geometry.area), [vertices, geometry.area]);
  const dateError = dateFrom > dateTo ? "La fecha inicial no puede ser posterior a la fecha final." : "";

  useEffect(() => () => { requestRef.current?.abort(); analysisRequestRef.current?.abort(); }, []);

  const applyShortcut = (days: number) => { setDateFrom(dateOffset(0)); setDateTo(dateOffset(days)); setPeriodMode("range"); };
  const startSeason = () => { const month = new Date().getMonth(); const target = new Date(); target.setMonth(month >= 8 ? 9 : 3, 1); setDateFrom(target.toISOString().slice(0, 10)); target.setMonth(target.getMonth() + 3); setDateTo(target.toISOString().slice(0, 10)); setPeriodMode("range"); };

  const submitPrediction = useCallback(async () => {
    if (polygonError || dateError) { setError(polygonError || dateError); return; }
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(""); setPrediction(null);
    try {
      const response = await getPrediction({ polygon: makePolygon(vertices), dateFrom: periodMode === "day" ? dateFrom : dateFrom, dateTo: periodMode === "day" ? dateFrom : dateTo, priorities: [priority] }, controller.signal);
      setPrediction(response);
    } catch (reason) {
      if (reason instanceof PredictionServiceError && reason.code === "aborted") return;
      setError(reason instanceof Error ? reason.message : "No se pudo generar la predicción.");
    } finally { if (requestRef.current === controller) setLoading(false); }
  }, [dateError, dateFrom, dateTo, periodMode, polygonError, priority, vertices]);

  const runAnalysis = async () => {
    if (!product.trim()) { setAnalysisError("Escribe un cultivo para iniciar el análisis."); return; }
    if (polygonError || dateError) { setAnalysisError(polygonError || dateError); return; }
    analysisRequestRef.current?.abort();
    const controller = new AbortController(); analysisRequestRef.current = controller;
    setAnalysisLoading(true); setAnalysisError(""); setAnalysis(null);
    const request: AnalyzeProductRequest = { polygon: makePolygon(vertices), dateFrom, dateTo: periodMode === "day" ? dateFrom : dateTo, product: product.trim(), priorities: [priority] };
    try { setAnalysis(await analyzeProduct(request, controller.signal)); }
    catch (reason) { if (reason instanceof PredictionServiceError && reason.code === "aborted") return; setAnalysisError(reason instanceof Error ? reason.message : "No se pudo analizar el cultivo."); }
    finally { if (analysisRequestRef.current === controller) setAnalysisLoading(false); }
  };

  const clearPolygon = () => { requestRef.current?.abort(); setVertices([]); setPrediction(null); setAnalysis(null); setError(""); setMode("view"); };

  return <main className="min-h-screen bg-[#030918] pb-16 text-white">
    <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-9">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-[#c9ed9c]"><ArrowLeft size={15} /> Volver al dashboard</Link><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-[#b8dc91]"><span className="h-px w-7 bg-[#b8dc91]" /> Laboratorio de campo · Bolivia</div><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Predicciones <span className="text-[#b8dc91]">para tu parcela</span></h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Combina señales satelitales y el calendario de tu cultivo para explorar posibles escenarios.</p></div>
        <div className="flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[.07] px-3 py-2 text-[10px] font-semibold tracking-[.12em] text-amber-200"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" /> PROTOTIPO · DATOS SIMULADOS</div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#081426] shadow-2xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] p-4 sm:px-5">
            <div><div className="flex items-center gap-2 text-sm font-semibold"><MapPinned size={16} className="text-[#b8dc91]" /> Delimita tu parcela</div><p className="mt-1 text-xs text-slate-500">Haz clic sobre el globo para agregar vértices.</p></div>
            <div className="flex flex-wrap gap-2">
              <ToolButton onClick={() => { setVertices([]); setMode("draw"); setPrediction(null); setError(""); }} active={mode === "draw"}><Sprout size={14} /> Dibujar</ToolButton>
              <ToolButton onClick={() => setMode("edit")} active={mode === "edit"} disabled={vertices.length < 3}><Activity size={14} /> Editar</ToolButton>
              {mode === "draw" && vertices.length >= 3 && <ToolButton onClick={() => setMode("view")}><Check size={14} /> Terminar</ToolButton>}
              {vertices.length > 0 && <ToolButton onClick={clearPolygon} danger><RotateCcw size={14} /> Borrar</ToolButton>}
            </div>
          </div>
          <div className="relative h-[390px] min-h-[360px] overflow-hidden bg-[#071124] sm:h-[470px]">
            <PredictionGlobe vertices={vertices} mode={mode} onVerticesChange={setVertices} />
            <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-[#06101f]/90 px-3 py-2.5 shadow-xl backdrop-blur"><div className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">Área aproximada</div><div className="mt-1 text-xl font-semibold text-[#d5f5a9]">{geometry.area.toFixed(2)} <span className="text-xs font-normal text-slate-400">ha</span></div></div>
            {vertices.length >= 3 && <div className="pointer-events-none absolute right-4 top-4 rounded-xl border border-white/10 bg-[#06101f]/90 px-3 py-2.5 text-right shadow-xl backdrop-blur"><div className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">Centroide</div><div className="mt-1 font-mono text-xs text-slate-200">{Math.abs(geometry.center[1]).toFixed(4)}° S · {Math.abs(geometry.center[0]).toFixed(4)}° O</div></div>}
            <div className="pointer-events-none absolute bottom-4 left-4 max-w-[82%] rounded-lg border border-white/10 bg-[#06101f]/85 px-3 py-2 text-[10px] leading-4 text-slate-400 backdrop-blur">{mode === "draw" ? "Acércate con la rueda hasta ver tu campo · clic para marcar el límite · Termina arriba" : mode === "edit" ? "Arrastra los puntos luminosos para ajustar el límite" : "Globo 3D · arrastra para rotar · rueda para acercarte a tu parcela"}</div>
            <div className="pointer-events-none absolute bottom-4 right-4 hidden items-center gap-2 text-[9px] tracking-widest text-white/50 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#b8dc91]" /> NAVEGACIÓN 3D</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.08] px-4 py-3 sm:px-5">
            <p className="flex min-h-5 items-center gap-2 text-xs text-slate-400">{polygonError ? <><CircleHelp size={14} className="text-slate-500" /> {vertices.length ? polygonError : "Sin parcela seleccionada"}</> : <><Check size={14} className="text-[#b8dc91]" /> Parcela lista para explorar · {vertices.length} vértices</>}</p>
            <span className="text-[10px] text-slate-500">Máximo configurable: {MAX_AREA_HA} ha</span>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#081426] p-4 shadow-xl sm:p-5">
          <div className="mb-5 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#b8dc91]/10 text-[#b8dc91]"><Activity size={17} /></div><div><h2 className="text-sm font-semibold">Ventana de análisis</h2><p className="mt-1 text-xs text-slate-500">Elige el periodo para consultar.</p></div></div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#030918] p-1"><button onClick={() => setPeriodMode("range")} className={`rounded-lg px-3 py-2 text-xs font-medium ${periodMode === "range" ? "bg-[#15253a] text-white shadow" : "text-slate-500 hover:text-white"}`}>Rango de fechas</button><button onClick={() => setPeriodMode("day")} className={`rounded-lg px-3 py-2 text-xs font-medium ${periodMode === "day" ? "bg-[#15253a] text-white shadow" : "text-slate-500 hover:text-white"}`}>Un día</button></div>
          <div className={`mt-4 grid gap-3 ${periodMode === "range" ? "grid-cols-2" : "grid-cols-1"}`}><DateInput label={periodMode === "day" ? "Día del análisis" : "Desde"} value={dateFrom} onChange={(value) => { setDateFrom(value); if (periodMode === "day") setDateTo(value); }} /><DateInput label="Hasta" value={dateTo} onChange={setDateTo} disabled={periodMode === "day"} /></div>
          <div className="mt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Atajos de periodo</p><div className="flex flex-wrap gap-2"><Shortcut onClick={() => { setDateFrom(dateOffset(0)); setDateTo(dateOffset(0)); setPeriodMode("day"); }}>Hoy</Shortcut><Shortcut onClick={() => applyShortcut(6)}>7 días</Shortcut><Shortcut onClick={() => applyShortcut(29)}>30 días</Shortcut><Shortcut onClick={() => applyShortcut(89)}>3 meses</Shortcut><Shortcut onClick={startSeason}>Próxima temporada</Shortcut></div></div>
          <label className="mt-5 block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Prioridad para tu decisión</span><select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0e1b2e] px-3 py-3 text-sm text-white outline-none focus:border-[#b8dc91]/60"><option>Agua disponible</option><option>Evitar heladas</option><option>Recuperar el suelo</option><option>Reducir riesgo productivo</option></select></label>
          {dateError && <p className="mt-3 flex gap-2 text-xs text-rose-300"><AlertCircle size={14} /> {dateError}</p>}
          <button onClick={submitPrediction} disabled={loading || Boolean(polygonError) || Boolean(dateError)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8dc91] px-4 py-3.5 text-sm font-semibold text-[#102318] transition hover:bg-[#d0eba9] disabled:cursor-not-allowed disabled:opacity-40">{loading ? <><LoaderCircle className="animate-spin" size={16} /> Analizando señales…</> : <>Generar predicción <ArrowRight size={16} /></>}</button>
          {error && <div role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/[.08] p-3 text-xs leading-5 text-rose-100"><div className="flex gap-2"><AlertCircle className="mt-0.5 shrink-0" size={14} /><span>{error}</span></div><button onClick={submitPrediction} className="mt-2 underline underline-offset-2">Intentar de nuevo</button></div>}
          <p className="mt-4 text-[10px] leading-4 text-slate-500">La estimación usa coordenadas de la parcela y productos satelitales de resolución regional. Confirma siempre las condiciones en campo.</p>
        </section>
      </div>

      {loading && <LoadingState />}
      {prediction && <PredictionResults prediction={prediction} onProduct={setProduct} />}

      <section className="mt-8 rounded-2xl border border-[#b8dc91]/20 bg-gradient-to-br from-[#0d1d27] to-[#10251f] p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#b8dc91]"><FlaskConical size={14} /> Exploración de cultivos</div><h2 className="mt-3 text-2xl font-semibold tracking-tight">¿Y si sembraras <span className="text-[#b8dc91]">algo distinto?</span></h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Compara un cultivo con las señales ambientales de tu parcela. Escribe libremente o elige una opción sugerida.</p><div className="mt-5 flex flex-wrap gap-2">{CROPS.slice(0, 5).map((crop) => <button key={crop} onClick={() => { setProduct(crop); setAnalysis(null); }} className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-slate-300 transition hover:border-[#b8dc91]/50 hover:text-[#d8f2b6]">{crop}</button>)}</div></div>
          <div>
            <label htmlFor="crop-input" className="mb-2 block text-xs font-medium text-slate-300">Nombre del cultivo</label><div className="flex flex-col gap-2 sm:flex-row"><input id="crop-input" list="crop-options" value={product} onChange={(event) => setProduct(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runAnalysis(); }} placeholder="Ej. tarwi, papa, quinua…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#030918]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#b8dc91]/60" /><datalist id="crop-options">{CROPS.map((crop) => <option key={crop} value={crop} />)}</datalist><button onClick={() => void runAnalysis()} disabled={analysisLoading || !product.trim()} className="flex items-center justify-center gap-2 rounded-xl border border-[#b8dc91]/30 bg-[#b8dc91]/10 px-4 py-3 text-sm font-semibold text-[#d5f5a9] transition hover:bg-[#b8dc91]/20 disabled:opacity-40">{analysisLoading ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={15} />} Analizar con IA</button></div>
            {analysisError && <p role="alert" className="mt-3 text-xs text-rose-300">{analysisError}</p>}
            {analysisLoading && <div className="mt-4 h-28 animate-pulse rounded-xl bg-white/[.04]" />}
            {analysis && <ProductAnalysis result={analysis} />}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center rounded-2xl border border-amber-200/15 bg-amber-300/[.045] p-5">
        <div><h2 className="flex items-center gap-2 text-sm font-semibold text-amber-100"><ShieldAlert size={16} className="text-amber-300" /> Qué no sabemos y qué debe revisar un experto local</h2><p className="mt-2 max-w-4xl text-xs leading-5 text-slate-400">Los satélites no observan la variedad sembrada, textura y profundidad efectiva del suelo, riego aplicado, plagas ni decisiones de manejo. La nubosidad y la resolución espacial pueden dejar vacíos. Verifica fechas, estado del cultivo y condiciones del terreno con un agricultor o técnico de la zona.</p></div>
        <div className="max-w-sm rounded-xl border border-amber-200/15 bg-[#030918]/40 p-3 text-xs leading-5 text-amber-100/90">Esta herramienta apoya, no reemplaza, el criterio del agricultor ni la asesoría agrícola local.</div>
      </section>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-600"><span>Field Shift · NASA Space Apps Challenge 2026</span><span className="flex items-center gap-1"><CircleHelp size={12} /> NDVI: vigor relativo de la vegetación · ET: evapotranspiración estimada</span></div>
    </div>
  </main>;
}

function ToolButton({ children, onClick, active, disabled, danger }: { children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; danger?: boolean }) { return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${danger ? "border-rose-300/20 text-rose-200 hover:bg-rose-400/10" : active ? "border-[#b8dc91]/35 bg-[#b8dc91]/10 text-[#d5f5a9]" : "border-white/10 bg-white/[.025] text-slate-300 hover:border-white/20 hover:bg-white/[.06]"}`}>{children}</button>; }
function DateInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) { return <label><span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-xl border border-white/10 bg-[#0e1b2e] px-3 py-3 text-xs text-white outline-none [color-scheme:dark] focus:border-[#b8dc91]/60 disabled:opacity-45" /></label>; }
function Shortcut({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="rounded-full border border-white/[.09] bg-white/[.025] px-2.5 py-1.5 text-[10px] text-slate-400 transition hover:border-[#b8dc91]/40 hover:text-[#d5f5a9]">{children}</button>; }

function LoadingState() { return <div className="mt-8 rounded-2xl border border-white/10 bg-[#081426] p-5"><div className="mb-5 flex items-center gap-3"><LoaderCircle className="animate-spin text-[#b8dc91]" size={18} /><div><h2 className="text-sm font-semibold">Leyendo señales del territorio</h2><p className="mt-1 text-xs text-slate-500">Cruzando humedad, lluvia, temperatura y relieve…</p></div></div><div className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-28 rounded-xl bg-white/[.04]" />)}</div></div>; }

function PredictionResults({ prediction, onProduct }: { prediction: PredictionResponse; onProduct: (product: string) => void }) {
  const { variables, metadatos } = prediction;
  const metrics = [
    { key: "humedadSuelo", title: "Humedad del suelo", icon: Droplets }, { key: "lluvia", title: "Lluvia acumulada", icon: CloudRain }, { key: "temperatura", title: "Temperatura", icon: Thermometer }, { key: "riesgoHelada", title: "Riesgo de helada", icon: Snowflake }, { key: "balanceHidrico", title: "Balance hídrico", icon: Waves }, { key: "estresVegetacion", title: "Estrés de vegetación", icon: Leaf }, { key: "erosionPendiente", title: "Pendiente / erosión", icon: Mountain },
  ] as const;
  return <section className="mt-8 scroll-mt-20" aria-live="polite">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#b8dc91]"><Activity size={14} /> Lectura del territorio</div><h2 className="mt-2 text-2xl font-semibold">Escenario para tu parcela</h2></div><div className="flex flex-wrap items-center gap-2"><ExampleBadge /><span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-slate-400">{metadatos.areaHa.toFixed(2)} ha · {metadatos.zona}</span></div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{metrics.map(({ key, title, icon: Icon }) => <MetricCard key={key} title={title} icon={<Icon size={16} />} value={variables[key]} extra={key === "temperatura" ? `${variables.temperatura.minima}° / ${variables.temperatura.media}° / ${variables.temperatura.maxima}° mín · media · máx` : undefined} />)}</div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <section className="rounded-2xl border border-white/10 bg-[#081426] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Cómo podrían cambiar las señales</h3><p className="mt-1 text-xs text-slate-500">Rango sombreado = incertidumbre · tooltip al enfocar un punto</p></div><span className="rounded-full bg-white/[.04] px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500">{prediction.serieTemporal.length} cortes</span></div><TimeSeries points={prediction.serieTemporal} /><div className="mt-2 flex flex-wrap gap-4 text-[10px] text-slate-400"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-sky-400" /> Lluvia estimada (mm)</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#b8dc91]" /> Humedad estimada (%)</span><span className="text-slate-600">Rango probabilístico ilustrativo</span></div></section>
      <section className="rounded-2xl border border-white/10 bg-[#081426] p-4 sm:p-5"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-300/10 text-sky-200"><CloudRain size={16} /></span><div><h3 className="font-semibold">Balance que merece atención</h3><p className="text-[10px] text-slate-500">Cruce de precipitación y demanda estimada</p></div></div><div className="mt-5 text-3xl font-semibold">{variables.balanceHidrico.min}–{variables.balanceHidrico.max} <span className="text-sm font-normal text-slate-400">{variables.balanceHidrico.unidad}</span></div><SignalPill signal={variables.balanceHidrico.senal} /><p className="mt-3 text-xs leading-5 text-slate-400">{variables.balanceHidrico.motivoConfianza}</p><div className="mt-4 flex flex-wrap gap-1.5">{prediction.fuentes.slice(0, 4).map((source) => <span key={source} className="rounded-full border border-white/[.08] px-2 py-1 text-[9px] text-slate-500">{source.split(" · ")[0]}</span>)}</div></section>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-[1.12fr_.88fr]">
      <section className="rounded-2xl border border-white/10 bg-[#081426] p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#b8dc91]">Aptitud orientativa</div><h3 className="mt-1 text-lg font-semibold">Cultivos que vale la pena comparar</h3></div><span className="text-[10px] text-slate-500">No es garantía de rendimiento</span></div><div className="mt-4 space-y-3">{prediction.cultivos.slice(0, 5).map((crop, index) => <CropCard key={crop.cultivo} crop={crop} rank={index + 1} onSelect={() => onProduct(crop.cultivo)} />)}</div></section>
      <section className="rounded-2xl border border-white/10 bg-[#081426] p-4 sm:p-5"><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#b8dc91]">Planifica a más de una cosecha</div><h3 className="mt-1 text-lg font-semibold">Tres rutas de rotación</h3><div className="mt-4 space-y-3">{prediction.rotaciones.slice(0, 3).map((rotation) => <div key={rotation.nombre} className={`rounded-xl border p-3 ${rotation.actual ? "border-[#b8dc91]/25 bg-[#b8dc91]/[.055]" : "border-white/[.08] bg-white/[.02]"}`}><div className="flex items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2 text-sm font-medium">{rotation.nombre}{rotation.actual && <span className="rounded-full bg-[#b8dc91]/15 px-2 py-0.5 text-[9px] text-[#c8eaa3]">ROTACIÓN ACTUAL</span>}</div><span className="text-xs text-[#b8dc91]">{rotation.puntaje}/100</span></div><div className="mt-2 flex flex-wrap items-center gap-2">{rotation.cultivos.map((crop, index) => <span key={`${crop}-${index}`} className="flex items-center gap-2 rounded-lg bg-[#030918]/60 px-2.5 py-1.5 text-[10px] text-slate-300">{crop}{index < rotation.cultivos.length - 1 && <ArrowRight size={11} className="text-[#b8dc91]" />}</span>)}</div><p className="mt-2 text-[10px] leading-4 text-slate-500">{rotation.nota}</p></div>)}</div></section>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-white/10 bg-[#081426] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><CircleHelp size={15} className="text-amber-200" /> Vacíos de información</h3><ul className="mt-3 grid gap-2 sm:grid-cols-2">{prediction.vaciosDeInformacion.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-slate-400"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300" />{item}</li>)}</ul></section><section className="rounded-2xl border border-white/10 bg-[#081426] p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert size={15} className="text-orange-200" /> Consideraciones del escenario</h3><ul className="mt-3 space-y-2">{prediction.riesgos.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-slate-400"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-orange-300" />{item}</li>)}</ul><p className="mt-3 border-t border-white/[.07] pt-3 text-[10px] leading-4 text-slate-600">Fuentes posibles: {prediction.fuentes.join(" · ")}</p></section></div>
  </section>;
}

function MetricCard({ title, icon, value, extra }: { title: string; icon: React.ReactNode; value: { min: number; max: number; unidad: string; confianza: Confidence; motivoConfianza: string; senal: Signal }; extra?: string }) { return <article className="rounded-xl border border-white/10 bg-[#081426] p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs text-slate-300">{icon}<span>{title}</span></div><SignalPill signal={value.senal} /></div><div className="mt-4 text-2xl font-semibold tracking-tight">{value.min}–{value.max} <span className="text-xs font-normal text-slate-500">{value.unidad}</span></div>{extra && <p className="mt-1 text-[10px] text-slate-500">{extra}</p>}<div className="mt-3 flex items-center justify-between gap-2"><ConfidenceLabel confidence={value.confianza} /><span title={value.motivoConfianza} className="max-w-[64%] cursor-help truncate text-right text-[9px] text-slate-500">{value.motivoConfianza}</span></div></article>; }
function SignalPill({ signal }: { signal: Signal }) { const map = { favorable: "bg-emerald-300/10 text-emerald-200", atencion: "bg-amber-300/10 text-amber-200", riesgo: "bg-rose-300/10 text-rose-200" }; const label = { favorable: "Favorable", atencion: "Atención", riesgo: "Riesgo" }; return <span className={`rounded-full px-2 py-1 text-[9px] ${map[signal]}`}>{label[signal]}</span>; }
function ConfidenceLabel({ confidence }: { confidence: Confidence }) { return <span className="text-[9px] uppercase tracking-wider text-slate-500">Confianza <b className={confidence === "alta" ? "text-emerald-200" : confidence === "media" ? "text-amber-200" : "text-rose-200"}>{confidence}</b></span>; }
function ExampleBadge() { return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[.07] px-2.5 py-1.5 text-[9px] font-bold tracking-[.12em] text-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> DATOS DE EJEMPLO</span>; }

function TimeSeries({ points }: { points: PredictionResponse["serieTemporal"] }) {
  const width = 760, height = 210, padX = 36, padY = 16;
  if (!points.length) return <div className="grid h-48 place-items-center text-xs text-slate-500">Sin puntos disponibles para graficar.</div>;
  const maxRain = Math.max(1, ...points.map((point) => point.lluvia.max));
  const x = (i: number) => padX + (points.length === 1 ? (width - padX * 2) / 2 : i * (width - padX * 2) / (points.length - 1));
  const yRain = (value: number) => height - padY - value / maxRain * (height - padY * 2);
  const yMoisture = (value: number) => height - padY - value / 100 * (height - padY * 2);
  const rainArea = `${points.map((p, i) => `${i ? "L" : "M"}${x(i)},${yRain(p.lluvia.max)}`).join(" ")} ${points.slice().reverse().map((p, reverseIndex) => { const i = points.length - 1 - reverseIndex; return `L${x(i)},${yRain(p.lluvia.min)}`; }).join(" ")} Z`;
  const moistureBand = `${points.map((p, i) => `${i ? "L" : "M"}${x(i)},${yMoisture(p.humedad.max)}`).join(" ")} ${points.slice().reverse().map((p, reverseIndex) => { const i = points.length - 1 - reverseIndex; return `L${x(i)},${yMoisture(p.humedad.min)}`; }).join(" ")} Z`;
  const moistureLine = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${yMoisture((p.humedad.p25 + p.humedad.p75) / 2)}`).join(" ");
  return <div className="mt-4 overflow-x-auto"><svg viewBox={`0 0 ${width} ${height + 26}`} className="h-[210px] min-w-[580px] w-full" role="img" aria-label="Serie ilustrativa de precipitación y humedad con banda de incertidumbre"><defs><linearGradient id="rainFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#38bdf8" stopOpacity=".32"/><stop offset="1" stopColor="#38bdf8" stopOpacity=".02"/></linearGradient></defs>{[0, 1, 2, 3].map((i) => <g key={i}><line x1={padX} x2={width - padX} y1={padY + i * (height - padY * 2) / 3} y2={padY + i * (height - padY * 2) / 3} stroke="rgba(255,255,255,.08)" strokeDasharray="3 6"/><text x="2" y={padY + i * (height - padY * 2) / 3 + 3} fill="#64748b" fontSize="9">{Math.round(maxRain * (1 - i / 3))}</text></g>)}<path d={rainArea} fill="url(#rainFill)"/><path d={moistureBand} fill="#b8dc91" opacity=".14"/><path d={moistureLine} fill="none" stroke="#b8dc91" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>{points.map((p, i) => <g key={p.fecha}><circle cx={x(i)} cy={yRain((p.lluvia.p25 + p.lluvia.p75) / 2)} r="3.5" fill="#38bdf8"><title>{p.fecha}: lluvia {p.lluvia.min}–{p.lluvia.max} mm</title></circle><circle cx={x(i)} cy={yMoisture((p.humedad.p25 + p.humedad.p75) / 2)} r="3.5" fill="#b8dc91"><title>{p.fecha}: humedad {p.humedad.min}–{p.humedad.max}%</title></circle>{(i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 5)) === 0) && <text x={x(i)} y={height + 15} textAnchor="middle" fill="#64748b" fontSize="9">{p.fecha.slice(5)}</text>}</g>)}</svg></div>;
}

function CropCard({ crop, rank, onSelect }: { crop: PredictionResponse["cultivos"][number]; rank: number; onSelect: () => void }) { return <article className="rounded-xl border border-white/[.08] bg-white/[.018] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-[#b8dc91]/10 text-[10px] text-[#b8dc91]">{String(rank).padStart(2, "0")}</span><h4 className="font-semibold">{crop.cultivo}</h4></div><div className="flex items-center gap-3"><ConfidenceLabel confidence={crop.confianza} /><span className="text-xs font-semibold text-[#c8eaa3]">{crop.puntaje}<span className="text-[9px] font-normal text-slate-500">/100</span></span></div></div><p className="mt-2 text-xs leading-5 text-slate-400">{crop.porQue}</p><div className="mt-2 flex flex-wrap gap-1">{crop.datosNASA.slice(0, 3).map((source) => <span key={source} className="rounded bg-sky-300/[.07] px-1.5 py-1 text-[9px] text-sky-100/70">{source}</span>)}</div><div className="mt-2 grid gap-2 sm:grid-cols-2"><p className="text-[10px] leading-4 text-slate-500"><b className="text-emerald-200/80">A favor:</b> {crop.beneficios.join(" · ")}</p><p className="text-[10px] leading-4 text-slate-500"><b className="text-amber-200/80">Riesgos / vacíos:</b> {[...crop.riesgos, ...crop.vaciosDeInformacion].join(" · ")}</p></div><button onClick={onSelect} className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#b8dc91] hover:text-white">Comparar este cultivo <ArrowUpRight size={12} /></button></article>; }

function ProductAnalysis({ result }: { result: ProductAnalysisResponse }) { const color = result.compatibilidad === "alta" ? "text-emerald-200" : result.compatibilidad === "media" ? "text-amber-200" : "text-rose-200"; return <article className="mt-4 rounded-xl border border-[#b8dc91]/20 bg-[#b8dc91]/[.045] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">Resultado simulado</div><h3 className="mt-1 text-lg font-semibold">{result.producto} <span className={`ml-1 text-sm ${color}`}>{result.compatibilidad} compatibilidad</span></h3></div><div className="text-right"><div className="text-2xl font-semibold text-[#d5f5a9]">{result.puntaje}<span className="text-xs text-slate-500">/100</span></div><ConfidenceLabel confidence={result.confianza} /></div></div><ExampleBadge /><div className="mt-3 grid gap-3 sm:grid-cols-2"><AnalysisList title="Razones a favor" items={result.razones_a_favor} tone="green"/><AnalysisList title="Riesgos y vacíos" items={[...result.riesgos, ...result.vacios_de_informacion]} tone="amber"/><AnalysisList title="Sugerencias prácticas" items={result.recomendaciones_practicas} tone="blue"/><div className="rounded-lg bg-[#030918]/35 p-3"><div className="text-[10px] font-semibold text-slate-300">Requerimientos orientativos</div><dl className="mt-2 grid grid-cols-[72px_1fr] gap-y-1 text-[10px] text-slate-500">{Object.entries(result.requerimientos).map(([key, value]) => <div key={key} className="contents"><dt className="capitalize">{key}</dt><dd className="m-0">{value}</dd></div>)}</dl></div></div><p className="mt-3 text-[10px] leading-4 text-slate-500">{result.aviso}</p></article>; }
function AnalysisList({ title, items, tone }: { title: string; items: string[]; tone: "green" | "amber" | "blue" }) { const color = { green: "text-emerald-200", amber: "text-amber-200", blue: "text-sky-200" }[tone]; return <div className="rounded-lg bg-[#030918]/35 p-3"><div className={`text-[10px] font-semibold ${color}`}>{title}</div><ul className="mt-2 space-y-1">{items.map((item) => <li key={item} className="text-[10px] leading-4 text-slate-400">• {item}</li>)}</ul></div>; }
