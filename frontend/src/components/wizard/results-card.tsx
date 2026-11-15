"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, CheckCircle2, CircleHelp, CloudRain, Droplets, Leaf, Mountain, Pause, Play, Satellite, ShieldAlert, Snowflake, Sparkles, Sprout, StopCircle, Thermometer, Volume2, Waves } from "lucide-react";
import { useWizard } from "./wizard-store";

const confidenceText = { alta: "Buena señal", media: "Señal parcial", baja: "Pocos datos" };
export default function ResultsCard({ onBack }: { onBack: () => void }) {
  const { diagnosis, suggestions, resultTab, setResultTab } = useWizard();
  const [speaking, setSpeaking] = useState(false), [paused, setPaused] = useState(false), [boundary, setBoundary] = useState(0);
  const narration = useMemo(() => diagnosis ? `Para ${diagnosis.metadatos.zona}, estas son posibilidades para explorar. ${diagnosis.probabilidades.slice(0, 3).map((crop) => `${crop.cultivo}, entre ${crop.min} y ${crop.max} por ciento de idoneidad indicativa.`).join(" ")} Revisa las alertas de agua y temperatura, y conversa con una persona técnica local antes de tomar una decisión.` : "", [diagnosis]);
  if (!diagnosis || !suggestions) return <section className="wizard-card-body"><div className="wizard-card-kicker">03 · RESULTADOS</div><p>No hay análisis cargado.</p></section>;
  const stopSpeech = () => { window.speechSynthesis?.cancel(); setSpeaking(false); setPaused(false); setBoundary(0); };
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    stopSpeech(); const utterance = new SpeechSynthesisUtterance(narration); utterance.lang = "es-BO"; utterance.rate = .92; utterance.onstart = () => setSpeaking(true); utterance.onboundary = (event) => setBoundary(event.charIndex); utterance.onend = stopSpeech; utterance.onerror = stopSpeech;
    const voices = window.speechSynthesis.getVoices(); utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === "es-bo") ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("es-419")) ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) ?? null;
    window.speechSynthesis.speak(utterance);
  };
  const highlightNarration = () => { const end = narration.indexOf(" ", boundary + 1); return <>{narration.slice(0, boundary)}<mark>{narration.slice(boundary, end < 0 ? narration.length : end)}</mark>{narration.slice(end < 0 ? narration.length : end)}</>; };
  return <section className="wizard-card-body wizard-results-card">
     <div className="wizard-result-heading"><div className="wizard-card-title-row"><div><h1>Tu parcela, en perspectiva.</h1><p className="wizard-card-intro">Señales para explorar escenarios posibles; no son certezas de cosecha.</p></div><button className="wizard-card-back-button" onClick={onBack} aria-label="Volver a planes"><ArrowLeft size={16} /> Atrás</button></div></div>
    <div className="wizard-result-tabs" role="tablist" aria-label="Vista del análisis"><button role="tab" aria-selected={resultTab === "diagnostico"} className={resultTab === "diagnostico" ? "active" : ""} onClick={() => setResultTab("diagnostico")}><Satellite size={14} /> Diagnóstico</button><button role="tab" aria-selected={resultTab === "sugerencias"} className={resultTab === "sugerencias" ? "active" : ""} onClick={() => setResultTab("sugerencias")}><Sparkles size={14} /> Sugerencias <span>{suggestions.alertas.length}</span></button></div>

    {resultTab === "diagnostico" ? <div className="wizard-diagnosis-pane">
      <div className="wizard-variable-grid">
        <Variable icon={<Droplets size={16} />} label="Humedad de suelo" value={diagnosis.variables.humedadSuelo} source="SMAP · señal regional" />
        <Variable icon={<CloudRain size={16} />} label="Lluvia estimada" value={diagnosis.variables.lluvia} source="GPM IMERG" />
        <Variable icon={<Thermometer size={16} />} label="Temperatura" value={diagnosis.variables.temperatura} source="NASA POWER" />
        <Variable icon={<Leaf size={16} />} label="Vegetación" value={diagnosis.variables.vegetacion} source="MODIS · Landsat" />
        <Variable icon={<Mountain size={16} />} label="Relieve" value={diagnosis.variables.relieve} source="SRTM · modelo del terreno" />
      </div>
      <div className="wizard-probability-heading"><div><p className="wizard-sub-kicker">ESCENARIOS DE SIEMBRA</p><h2>¿Qué cultivos podrían adaptarse?</h2></div><span title="Idoneidad es una orientación estadística, no una probabilidad garantizada de cosecha."><CircleHelp size={16} /></span></div>
      <div className="wizard-probabilities">{diagnosis.probabilidades.map((crop, index) => <article className="wizard-crop-result" key={crop.cultivo}><div className="wizard-crop-result-top"><span className="wizard-crop-rank">0{index + 1}</span><strong>{crop.cultivo}</strong><span className={`wizard-confidence confidence-${crop.confianza}`}>{confidenceText[crop.confianza]}</span></div><div className="wizard-suitability"><div className="wizard-suitability-track"><i style={{ left: `${crop.min}%`, width: `${crop.max - crop.min}%` }} /></div><strong>{crop.min}–{crop.max}%</strong></div><p>{crop.motivoConfianza}</p><details><summary>Fuentes, riesgos y datos por revisar</summary><div className="wizard-details-grid"><div><b>DATOS NASA</b><span>{crop.fuentes.join(" · ")}</span></div><div><b>RIESGOS</b><span>{crop.riesgos.join(" ")}</span></div><div><b>FALTA SABER</b><span>{crop.vacios.join(" · ")}</span></div></div></details></article>)}</div>
      <div className="wizard-voice-card"><div className="wizard-voice-icon"><Volume2 size={19} /></div><div className="wizard-voice-copy"><strong>Escucha el resumen</strong><p>{speaking || paused ? highlightNarration() : "Te leemos las señales principales de tu parcela."}</p></div><div className="wizard-voice-controls"><button onClick={speaking && paused ? () => { window.speechSynthesis.resume(); setPaused(false); } : speaking ? () => { window.speechSynthesis.pause(); setPaused(true); } : speak} title={paused ? "Continuar" : speaking ? "Pausar" : "Escuchar resultados"}>{speaking && !paused ? <Pause size={15} /> : <Play size={15} />}</button>{speaking && <button onClick={stopSpeech} title="Detener"><StopCircle size={15} /></button>}</div></div>
    </div> : <div className="wizard-suggestions-pane">
      <div className="wizard-alert-title"><div><p className="wizard-sub-kicker">SEÑALES PARA VIGILAR</p><h2>Prepárate con tiempo.</h2></div><span>ORIENTATIVO</span></div>
      <div className="wizard-alerts">{suggestions.alertas.map((alert, index) => <article className={`wizard-alert alert-${alert.nivel}`} key={`${alert.tipo}-${index}`}><div className="wizard-alert-icon">{alert.tipo === "sequia" ? <Droplets size={17} /> : alert.tipo === "helada" ? <Snowflake size={17} /> : alert.tipo === "inundacion" ? <Waves size={17} /> : <AlertTriangle size={17} />}</div><div className="wizard-alert-content"><div className="wizard-alert-top"><strong>{({ sequia: "Agua disponible", helada: "Temperatura y helada", inundacion: "Exceso de agua", erosion: "Erosión", otro: "Señal para revisar" })[alert.tipo]}</strong><span>{alert.nivel === "alto" ? "ALTA ATENCIÓN" : alert.nivel === "medio" ? "ATENCIÓN" : "VIGILAR"}</span></div><p>{alert.motivo}</p><small>{alert.ventana.desde} · confianza {alert.confianza} · {alert.fuentes.join(" / ")}</small><div className="wizard-alert-action"><ArrowUpRight size={14} />{alert.accionSugerida}</div></div></article>)}</div>
      <div className="wizard-recommendations-title"><Sprout size={16} /><h2>Prácticas para comparar</h2></div>
      <div className="wizard-recommendations">{suggestions.recomendaciones.map((recommendation, index) => <article key={`${recommendation.titulo}-${index}`}><span>0{index + 1}</span><div><strong>{recommendation.titulo}</strong><p>{recommendation.detalle}</p><small>Prioridad: {recommendation.prioridades.join(" · ")} · confianza {recommendation.confianza}</small></div><ArrowDownRight size={17} /></article>)}</div>
      <div className="wizard-unknowns"><div><ShieldAlert size={17} /><strong>Qué no sabemos todavía</strong></div><ul>{[...new Set([...diagnosis.vaciosDeInformacion, ...suggestions.vaciosDeInformacion])].map((item) => <li key={item}>{item}</li>)}</ul><p>Esta herramienta apoya, no reemplaza, el criterio del agricultor ni la asesoría agrícola local.</p></div>
    </div>}
    <div className="wizard-data-footer"><CheckCircle2 size={14} /> Elaborado {new Date(diagnosis.metadatos.generadoEn).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" })} <span>·</span> Señales regionales; valida siempre en campo.</div>
  </section>;
}

function Variable({ icon, label, value, source }: { icon: ReactNode; label: string; value: string; source: string }) { return <article className="wizard-variable"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{source}</em></div></article>; }
