"use client";

import { ArrowLeft, Check, Leaf, Satellite } from "lucide-react";
import Link from "next/link";
import { useWizard } from "./wizard-store";
import PwaControls from "./pwa-controls";

const labels = ["Ubicación", "Planes", "Resultados"];
export default function WizardHeader() {
  const { step, setStep, location } = useWizard();
  return <header className="wizard-header">
    <Link href="/" className="wizard-brand" aria-label="Yapana Agro, inicio"><span><Leaf size={18} /></span><strong>YAPANA <em>AGRO</em></strong></Link>
    <div className="wizard-brand-center"><span className="wizard-brand-satellite"><Satellite size={15} /></span><span><strong>NASA SPACE APPS 2026</strong><small>FIELD SHIFT · BOLIVIA</small></span></div>
    <div className="wizard-stepper" aria-label={`Paso ${step} de 3`}>
      {labels.map((label, index) => { const itemStep = index + 1; const done = step > itemStep; return <div className={`wizard-step ${step === itemStep ? "is-current" : ""} ${done ? "is-done" : ""}`} key={label}><span className="wizard-step-dot">{done ? <Check size={13} /> : `0${itemStep}`}</span><span>{label}</span>{itemStep < 3 && <i />}</div>; })}
    </div>
    <div className="wizard-header-actions"><PwaControls />{step > 1 ? <button className="wizard-back-button" onClick={() => setStep((step - 1) as 1 | 2)}><ArrowLeft size={15} /> Atrás</button> : <div className="wizard-location-pill"><i />{location ? `${location.municipality} · ${location.country}` : "TU PARCELA, EN CONTEXTO"}</div>}</div>
  </header>;
}
