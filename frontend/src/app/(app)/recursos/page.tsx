import Link from "next/link";

export default function ResourcesPage() {
  return <main className="min-h-screen bg-[#071b16] p-8 text-white"><Link className="text-[#b8dc91]" href="/dashboard">← Volver al dashboard</Link><div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center text-center"><p className="mb-4 text-xs uppercase tracking-widest text-[#b8dc91]">Yapana Agro</p><h1 className="text-4xl font-bold">Recursos</h1><p className="mt-4 text-slate-300">Aquí encontrarás materiales y herramientas para acompañar tus decisiones agrícolas.</p></div></main>;
}
