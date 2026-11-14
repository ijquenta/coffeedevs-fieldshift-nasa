import Link from "next/link";
import {
  ArrowRight,
  CloudSun,
  Download,
  Droplets,
  Leaf,
  Menu,
  Satellite,
  Sprout,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";

const benefits = [
  {
    icon: Satellite,
    number: "01",
    title: "Observa tu territorio",
    text: "Explora mapas y encuentra tu parcela desde el país hasta tu comunidad.",
  },
  {
    icon: CloudSun,
    number: "02",
    title: "Entiende el clima",
    text: "Convierte temperatura, lluvia y humedad en información clara para tu campo.",
  },
  {
    icon: Sprout,
    number: "03",
    title: "Decide con confianza",
    text: "Compara cultivos y estrategias de rotación antes de tomar una decisión.",
  },
];

export default function Home() {
  return (
    <main className="agro-page">
      <header className="agro-header">
        <Link className="agro-logo" href="/" aria-label="Yapana Agro, inicio">
          <span className="agro-logo-mark"><Leaf size={17} /></span>
          <span>yapana<span>.</span></span>
        </Link>
        <nav className="agro-nav" aria-label="Navegación principal">
          <a href="#solucion">La solución</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#offline">Acceso offline</a>
        </nav>
        <div className="agro-header-actions">
          <span className="agro-event"><span /> NASA Space Apps 2026</span>
          <Link className="agro-header-cta" href="/dashboard">Ver el mapa <ArrowRight size={15} /></Link>
        </div>
        <button className="agro-menu" aria-label="Abrir menú"><Menu size={21} /></button>
      </header>

      <section className="agro-hero">
        <div className="agro-hero-image" />
        <div className="agro-hero-shade" />
        <div className="agro-hero-content">
          <div className="agro-hero-copy">
            <Badge className="agro-kicker agro-badge"><span /> Inteligencia agrícola desde Bolivia</Badge>
            <h1>Datos que<br /><em>cultivan futuro.</em></h1>
            <p className="agro-hero-text">Yapana Agro transforma observaciones satelitales en decisiones útiles para quienes trabajan la tierra.</p>
            <div className="agro-actions">
              <Button asChild className="agro-button agro-button-primary"><Link href="/dashboard">Explorar el mapa <ArrowRight size={17} /></Link></Button>
              <a className="agro-text-link" href="#solucion">Conoce la plataforma <span>↓</span></a>
            </div>
          </div>
          <div className="agro-hero-note"><Satellite size={17} /><span>Observación terrestre<br /><strong>convertida en acción local</strong></span></div>
        </div>
        <div className="agro-hero-bottom"><span>CIENCIA ESPACIAL PARA EL CAMPO</span><span>01 — YAPANA AGRO</span></div>
      </section>

      <section className="agro-intro" id="solucion">
        <div className="agro-container agro-intro-grid">
          <div><p className="agro-kicker agro-kicker-dark"><span /> El desafío</p><h2>La tierra cambia.<br /><em>Las decisiones también.</em></h2></div>
          <div><p className="agro-lead">El clima, el agua y el suelo cuentan una historia. Yapana te ayuda a leerla para planificar mejor cada ciclo agrícola.</p><p className="agro-muted">Hacemos accesible la ciencia espacial para que la información llegue hasta las comunidades que más la necesitan.</p></div>
        </div>
      </section>

      <section className="agro-benefits">
        <div className="agro-container">
          <div className="agro-section-heading"><div><p className="agro-kicker"><span /> Una mirada diferente</p><h2>Tu campo, visto<br /><em>con más contexto.</em></h2></div><p>De la imagen satelital a una recomendación comprensible.</p></div>
          <div className="agro-benefit-grid">{benefits.map(({ icon: Icon, number, title, text }) => <Card className="agro-benefit-card" key={number}><CardHeader className="agro-benefit-top"><span>{number}</span><Icon size={22} /></CardHeader><CardContent><h3>{title}</h3><p>{text}</p></CardContent><ArrowRight className="agro-card-arrow" size={17} /></Card>)}</div>
        </div>
      </section>

      <section className="agro-process" id="como-funciona">
        <div className="agro-container"><div className="agro-section-heading agro-heading-light"><div><p className="agro-kicker"><span /> Cómo funciona</p><h2>Una decisión más clara<br /><em>empieza con una mejor lectura.</em></h2></div><p>Yapana organiza datos complejos en una experiencia simple y cercana.</p></div>
          <div className="agro-steps"><div><span>01</span><strong>Encuentra tu parcela</strong><p>Selecciona ubicación y territorio en el mapa.</p></div><div><span>02</span><strong>Analiza sus condiciones</strong><p>Consulta humedad, temperatura y precipitación.</p></div><div><span>03</span><strong>Planifica tu próximo ciclo</strong><p>Explora recomendaciones para cultivar mejor.</p></div></div>
        </div>
      </section>

      <section className="agro-offline" id="offline"><div className="agro-container agro-offline-grid"><div className="agro-offline-visual"><Card className="agro-data-card"><CardHeader><div><span>MI PARCELA</span><strong>Achocalla · La Paz</strong></div></CardHeader><CardContent><div className="agro-data-value">61%<small>humedad del suelo</small></div><div className="agro-chart"><i /><i /><i /><i /><i /><i /><i /></div><div className="agro-data-footer"><span><Droplets size={14} /> Precipitación <strong>42 mm</strong></span><span><Sprout size={14} /> Cultivo <strong>Quinua</strong></span></div></CardContent></Card></div><div className="agro-offline-copy"><p className="agro-kicker"><span /> Diseñado para el campo</p><h2>La información<br /><em>no depende de una señal.</em></h2><p>Descarga la información de tu parcela y consúltala cuando estés trabajando lejos de Internet.</p><div className="agro-offline-note"><WifiOff size={18} /><span><strong>Próximamente offline</strong><br />Aplicación móvil en desarrollo.</span></div><Button asChild className="agro-button agro-button-light"><Link href="/dashboard">Comenzar a explorar <ArrowRight size={16} /></Link></Button></div></div></section>

      <section className="agro-final"><div className="agro-container"><p className="agro-kicker"><span /> Tu próxima decisión</p><h2>Conoce mejor<br /><em>la tierra que cultivas.</em></h2><p>Explora el mapa y descubre cómo los datos pueden acompañar tu trabajo.</p><Button asChild className="agro-button agro-button-primary"><Link href="/dashboard">Ver el mapa geoespacial <ArrowRight size={17} /></Link></Button></div></section>

      <footer className="agro-footer"><div className="agro-container agro-footer-main"><div><Link className="agro-logo" href="/"><span className="agro-logo-mark"><Leaf size={17} /></span><span>yapana<span>.</span></span></Link><p>Ciencia espacial para decisiones<br />agrícolas más claras.</p></div><div className="agro-footer-links"><div><span>Explorar</span><a href="#solucion">La solución</a><a href="#como-funciona">Cómo funciona</a></div><div><span>Proyecto</span><Link href="/dashboard">Mapa geoespacial</Link><a href="#offline">Modo offline</a></div></div></div><div className="agro-container agro-footer-bottom"><span>© 2026 Yapana Agro</span><span>NASA Space Apps Challenge · Bolivia</span><span><Download size={12} /> Hecho para quienes cultivan el futuro.</span></div></footer>
    </main>
  );
}
