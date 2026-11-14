"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Lightbulb, Menu, Package, Sprout, X, ChartNoAxesCombined } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Navbar } from "./ui/navbar";
import { Sheet, SheetContent } from "./ui/sheet";

const navigation = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: Sprout },
  { href: "/recomendaciones", label: "Recomendaciones", icon: Lightbulb },
  { href: "/predicciones", label: "Predicciones", icon: ChartNoAxesCombined },
  { href: "/productos", label: "Gestión de productos", icon: Package },
  { href: "/recursos", label: "Recursos", icon: BookOpen },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  return (
    <div className="app-shell">
      <Navbar className="app-navbar">
        <Link href="/" className="app-brand"><span className="app-brand-mark"><Sprout size={16} /></span><span>YAPANA<span> AGRO</span></span></Link>
        <div className="app-navbar-meta"><span className="app-status-dot" /> NASA SPACE APPS 2026</div>
        <button className="app-menu-button" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button>
      </Navbar>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="app-sheet-content">
          <div className="app-sheet-top"><span>MENÚ PRINCIPAL</span><button onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={19} /></button></div>
          <nav className="app-navigation" aria-label="Navegación principal">
            {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`app-nav-item ${pathname === href ? "app-nav-item-active" : ""}`}><Icon size={17} /><span>{label}</span></Link>)}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="app-shell-content">{children}</div>
    </div>
  );
}
