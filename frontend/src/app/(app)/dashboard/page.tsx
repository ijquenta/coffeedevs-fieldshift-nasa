"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CloudSun, Droplets, Layers3, MapPin, Sprout, Thermometer } from "lucide-react";
import { sampleParcels, type AgroVariable } from "../../../data/parcels";
import { Sidebar, SidebarContent, SidebarHeader } from "../../../components/ui/sidebar";

const DashboardGlobe = dynamic(() => import("../../../components/dashboard-globe"), { ssr: false });

export default function DashboardPage() {
  const [department, setDepartment] = useState("La Paz");
  const [municipality, setMunicipality] = useState("Todos");
  const [variable, setVariable] = useState<AgroVariable>("ALL");
  const [startDate, setStartDate] = useState("2026-11-01");
  const [endDate, setEndDate] = useState("2026-11-14");

  const filteredParcels = useMemo(() => sampleParcels.filter((parcel) => {
    const matchesDepartment = parcel.department === department;
    const matchesMunicipality = municipality === "Todos" || parcel.municipality === municipality;
    const matchesDate = parcel.date >= startDate && parcel.date <= endDate;
    return matchesDepartment && matchesMunicipality && matchesDate;
  }), [department, municipality, startDate, endDate]);

  const averageMoisture = filteredParcels.length ? Math.round(filteredParcels.reduce((sum, parcel) => sum + parcel.moisture, 0) / filteredParcels.length) : 0;
  const averageTemperature = filteredParcels.length ? (filteredParcels.reduce((sum, parcel) => sum + parcel.temperature, 0) / filteredParcels.length).toFixed(1) : "0.0";
  const totalRain = filteredParcels.reduce((sum, parcel) => sum + parcel.precipitation, 0);

  return (
    <main className="dashboard-shell relative h-screen overflow-hidden bg-[#030918] text-white">
      <div className="dashboard-map relative h-full w-full">
        <Sidebar className="dashboard-filters absolute left-5 top-20 z-20 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#071124]/95 p-6 shadow-2xl backdrop-blur-md">
          <SidebarHeader>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-[#b8dc91]">Explorar territorio</p><h2 className="mb-7 text-lg font-semibold">Analiza tu parcela</h2>
          </SidebarHeader>
          <SidebarContent>
          <div className="space-y-5">
            <div><label className="mb-2 block text-xs uppercase tracking-widest text-slate-400">País</label><div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm"><MapPin size={16} className="text-[#b8dc91]" /> Bolivia</div></div>
            <FilterSelect label="Departamento" value={department} onChange={setDepartment} options={["La Paz"]} />
            <FilterSelect label="Municipio" value={municipality} onChange={setMunicipality} options={["Todos", "Achocalla", "Mecapaca", "Viacha", "Palca"]} />
            <div><label className="mb-2 block text-xs uppercase tracking-widest text-slate-400">Variable principal</label><div className="space-y-2">{([["ALL", "Todas las variables"], ["MOISTURE", "Humedad del suelo"], ["TEMPERATURE", "Temperatura"], ["PRECIPITATION", "Precipitación"]] as const).map(([value, label]) => <button key={value} onClick={() => setVariable(value)} className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${variable === value ? "border-[#b8dc91] bg-[#b8dc91]/15 text-[#b8dc91]" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>{label}</button>)}</div></div>
            <DateField label="Periodo inicial" value={startDate} onChange={setStartDate} /><DateField label="Periodo final" value={endDate} onChange={setEndDate} />
            <div className="border-t border-white/10 pt-5"><h3 className="mb-3 flex items-center gap-2 text-sm font-medium"><Layers3 size={16} /> Leyenda agrícola</h3><div className="space-y-2 text-sm text-slate-300"><Legend color="bg-[#b8dc91]" label="Humedad favorable" /><Legend color="bg-[#d7b56d]" label="Humedad moderada" /><Legend color="bg-[#c77c67]" label="Humedad baja" /></div></div>
          </div>
          </SidebarContent>
        </Sidebar>
        <section className="relative h-full w-full"><div className="absolute inset-0 h-full w-full"><DashboardGlobe parcels={filteredParcels} /></div><div className="dashboard-stats pointer-events-none absolute right-5 top-20 z-10 grid w-[min(460px,calc(100%-22rem))] grid-cols-3 gap-3"><StatCard icon={<Sprout size={14} />} label="Parcelas" value={filteredParcels.length.toString()} color="text-white" /><StatCard icon={<Droplets size={14} />} label="Humedad media" value={`${averageMoisture}%`} color="text-[#b8dc91]" /><StatCard icon={<Thermometer size={14} />} label="Temperatura media" value={`${averageTemperature}°`} color="text-[#e7bd82]" /></div><div className="pointer-events-none absolute bottom-5 left-5 z-10 flex items-center gap-2 rounded-lg border border-[#b8dc91]/30 bg-[#071124]/90 px-4 py-3 text-xs text-[#d8eabf]"><CloudSun size={14} /> {totalRain} mm acumulados · Datos simulados</div></section>
      </div>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <div><label className="mb-2 block text-xs uppercase tracking-widest text-slate-400">{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#101c32] p-3 text-sm text-white outline-none">{options.map((option) => <option key={option}>{option}</option>)}</select></div>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><label className="mb-2 block text-xs uppercase tracking-widest text-slate-400">{label}</label><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#101c32] p-3 text-sm text-white" /></div>; }
function Legend({ color, label }: { color: string; label: string }) { return <div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${color}`} />{label}</div>; }
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) { return <div className="rounded-xl border border-white/10 bg-[#071124]/90 p-4 shadow-xl backdrop-blur-md"><div className="mb-2 flex items-center gap-2 text-xs text-slate-400">{icon}{label}</div><p className={`text-2xl font-semibold ${color}`}>{value}</p></div>; }
