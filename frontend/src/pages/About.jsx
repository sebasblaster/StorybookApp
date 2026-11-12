import React from "react";
import { Feather, Image as ImageIcon, Mic2, Music, Database, MonitorSmartphone, ArrowRight, ShieldCheck } from "lucide-react";

const STEPS = [
  { Icon: MonitorSmartphone, title: "Interfaz React", sub: "Idea + género + parámetros" },
  { Icon: Database, title: "API FastAPI + cola", sub: "Trabajo persistido en SQLite (sin servidor de base de datos)" },
  { Icon: Feather, title: "Texto · Qwen2.5-Instruct", sub: "Biblia del personaje + 5 escenas con arco narrativo" },
  { Icon: ImageIcon, title: "Imagen · SD-Turbo / SDXL-Turbo", sub: "Estilo fijo por género + descripción del protagonista + semilla compartida (+ IP-Adapter en perfil calidad)" },
  { Icon: Mic2, title: "Voz · Meta MMS-TTS (VITS)", sub: "Narración en español, WAV por escena" },
  { Icon: Music, title: "Ambiente · síntesis procedural", sub: "12 paisajes sonoros elegidos por el modelo de texto" },
];

const MODELS = [
  ["Qwen/Qwen2.5-1.5B · 3B · 7B-Instruct", "Texto narrativo y prompts visuales", "1.5B y 7B: Apache 2.0 · 3B: Qwen Research (no comercial)"],
  ["stabilityai/sd-turbo · sdxl-turbo", "Ilustraciones 512–768 px en 1–4 pasos", "Stability AI Community (uso no comercial / investigación)"],
  ["h94/IP-Adapter (SDXL)", "Identidad del personaje entre escenas (opcional)", "Apache 2.0"],
  ["facebook/mms-tts-spa", "Síntesis de voz en español", "CC BY-NC 4.0"],
  ["openai/clip-vit-base-patch32", "Solo MIDE la consistencia visual (no genera nada)", "MIT"],
  ["Síntesis procedural propia (NumPy/SciPy)", "Lluvia, viento, mar, bosque, fuego, magia…", "Código propio, sin restricciones"],
];

const CONSISTENCY = [
  "Biblia del personaje: el modelo define nombre y rasgos visuales una sola vez y se reutilizan en todas las escenas.",
  "Contexto acumulado: cada escena se escribe leyendo las anteriores y siguiendo un arco de 5 actos.",
  "Estilo visual fijo por género + misma semilla de difusión para mantener paleta y composición.",
  "IP-Adapter (perfil calidad): la primera ilustración sirve de referencia visual para las demás.",
  "Ambiente sonoro coherente: una capa base del género mezclada con el efecto específico de cada escena.",
  "Verificación objetiva: similitud CLIP entre las cinco ilustraciones, registrada en el panel de experimentos.",
];

export default function About() {
  return (
    <main className="relative max-w-6xl mx-auto px-6 py-10 sm:py-14 space-y-10">
      <div className="animate-fade-up">
        <div className="text-xs uppercase tracking-[0.3em] text-amber-300/80 font-sans-ui">Cómo funciona</div>
        <h1 className="font-display text-4xl sm:text-5xl text-amber-100 mt-2">Arquitectura 100% local</h1>
        <p className="font-prose text-lg text-slate-300 mt-3 max-w-3xl">Ninguna parte del cuento sale de tu computadora: los modelos abiertos se descargan una vez desde Hugging Face y luego todo funciona sin internet, sin APIs pagas ni servicios remotos.</p>
      </div>

      <div data-testid="architecture-diagram" className="parchment paper-grain rounded-2xl p-6 grid md:grid-cols-3 gap-4">
        {STEPS.map(({ Icon, title, sub }, i) => (
          <div key={title} className="relative rounded-xl border border-amber-400/20 bg-slate-950/40 p-4 animate-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center gap-2 text-amber-200"><Icon className="h-5 w-5" /><span className="text-xs font-sans-ui text-amber-300/60">Paso {i + 1}</span></div>
            <div className="font-display text-lg text-amber-100 mt-2">{title}</div>
            <div className="text-sm text-slate-400 font-sans-ui mt-1">{sub}</div>
            {i < STEPS.length - 1 && <ArrowRight className="hidden md:block absolute -right-3 top-1/2 h-4 w-4 text-amber-400/60" />}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="parchment rounded-2xl p-6">
          <h2 className="font-display text-2xl text-amber-100">Estrategia de consistencia</h2>
          <ul className="mt-4 space-y-3 font-sans-ui text-sm text-slate-300">
            {CONSISTENCY.map((c) => <li key={c} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />{c}</li>)}
          </ul>
          <p className="mt-4 text-xs text-slate-500 font-sans-ui">Se puede desactivar en «Opciones avanzadas» para comparar resultados en el panel de experimentos.</p>
        </div>
        <div className="parchment rounded-2xl p-6">
          <h2 className="font-display text-2xl text-amber-100 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-300" /> Modelos y licencias</h2>
          <table className="w-full mt-4 text-sm font-sans-ui" data-testid="licenses-table">
            <tbody>
              {MODELS.map(([m, use, lic]) => (
                <tr key={m} className="border-t border-white/5 align-top">
                  <td className="py-2 pr-3 text-amber-100">{m}<div className="text-xs text-slate-400">{use}</div></td>
                  <td className="py-2 text-slate-300 text-xs">{lic}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-slate-500 font-sans-ui">Para uso comercial futuro habría que sustituir imagen y voz por alternativas con licencia abierta (por ejemplo FLUX.1-schnell y Piper). La arquitectura de módulos lo permite cambiando solo los perfiles.</p>
        </div>
      </div>
    </main>
  );
}
