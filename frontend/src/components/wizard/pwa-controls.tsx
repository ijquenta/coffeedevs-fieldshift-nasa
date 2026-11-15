"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, Share2, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const subscribeInstallation = (onChange: () => void) => {
  window.addEventListener("appinstalled", onChange);
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("appinstalled", onChange);
    displayMode.removeEventListener("change", onChange);
  };
};

const isInstalledSnapshot = () => window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const isInstalledOnServer = () => false;

export default function PwaControls() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const installed = useSyncExternalStore(subscribeInstallation, isInstalledSnapshot, isInstalledOnServer);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isAppleMobile, setIsAppleMobile] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error: unknown) => {
        console.error("No se pudo activar el modo sin conexión de Yapana Agro.", error);
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => { setPromptEvent(null); setHelpOpen(false); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (process.env.NODE_ENV !== "production" || installed) return null;
  const install = async () => {
    if (!promptEvent) {
      setIsAppleMobile(/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      setHelpOpen(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome !== "dismissed") setPromptEvent(null);
  };

  return <>
    <button className="wizard-install-button" onClick={() => void install()} aria-label="Instalar Yapana Agro" title="Instalar Yapana Agro"><Download size={14} /><span>Instalar app</span></button>
    {helpOpen && <div className="wizard-install-backdrop" onClick={() => setHelpOpen(false)}>
      <section className="wizard-install-dialog" role="dialog" aria-modal="true" aria-labelledby="wizard-install-title" onClick={(event) => event.stopPropagation()}>
        <button className="wizard-install-close" aria-label="Cerrar" onClick={() => setHelpOpen(false)}><X size={18} /></button>
        <span className="wizard-install-mark"><Check size={21} /></span>
        <p className="wizard-card-kicker">YAPANA AGRO · ACCESO RÁPIDO</p>
        <h2 id="wizard-install-title">Añade la app a tu dispositivo</h2>
        <p className="wizard-install-copy">{isAppleMobile ? "En Safari, toca Compartir y elige “Añadir a pantalla de inicio”." : "Abre el menú del navegador (⋮ o ⋯) y elige “Instalar Yapana Agro” o “Añadir a pantalla principal”."}</p>
        <div className="wizard-install-hint"><Share2 size={16} /><span>La instalación crea un acceso directo y abre Yapana Agro en su propia ventana.</span></div>
        <button className="wizard-primary-button" onClick={() => setHelpOpen(false)}>Entendido <Check size={16} /></button>
      </section>
    </div>}
  </>;
}
