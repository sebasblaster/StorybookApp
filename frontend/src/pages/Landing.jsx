import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Sparkles, Feather, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GENRE_LIST } from "@/lib/genres";
import { useAuth } from "@/context/AuthContext";

export default function Landing() {
  const { user } = useAuth();
  const primaryTo = user ? "/create" : "/register";

  return (
    <main className="relative overflow-hidden">
      {/* HERO */}
      <section className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 sm:pt-24">
        <div className="aurora" />
        <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 text-xs tracking-[0.25em] uppercase text-amber-300/80 font-sans-ui">
              <Sparkles className="h-3.5 w-3.5" /> Un códice interactivo
            </span>
            <h1 className="mt-5 font-display font-bold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-amber-100 tracking-tight">
              Convierte una idea en un
              <span className="italic text-amber-300"> cuento vivo </span>
              de cinco escenas.
            </h1>
            <p className="mt-6 max-w-xl font-prose text-xl text-slate-300/90 leading-relaxed">
              Elige un género, comparte una idea breve y el códice creará un relato ilustrado, narrado con voz y
              envuelto en una ambientación sonora. Todo en tu computadora, sin internet.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={primaryTo}>
                <Button data-testid="hero-primary-cta" size="lg" className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-medium px-6 py-6 text-base shadow-[0_8px_30px_rgba(234,179,8,0.35)]">
                  Comenzar un cuento <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button data-testid="hero-secondary-cta" size="lg" variant="outline" className="border-amber-400/40 text-amber-100 bg-transparent hover:bg-amber-400/10 px-6 py-6">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid sm:grid-cols-3 gap-4 max-w-xl text-sm font-sans-ui">
              {[
                { Icon: Feather, title: "6 géneros", sub: "Fantasía · misterio · terror · aventura · ciencia ficción · infantil" },
                { Icon: BookOpen, title: "5 escenas", sub: "Narrativa coherente con continuidad visual" },
                { Icon: Volume2, title: "100% local", sub: "Modelos abiertos de Hugging Face, sin APIs ni internet" },
              ].map(({ Icon, title, sub }) => (
                <div key={title} className="parchment rounded-xl p-4 relative paper-grain overflow-hidden">
                  <Icon className="h-5 w-5 text-amber-300 mb-2" />
                  <div className="text-amber-100 font-medium">{title}</div>
                  <div className="text-slate-400 text-xs leading-relaxed mt-1">{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* floating book preview */}
          <div className="relative animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="relative w-full max-w-md mx-auto">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-amber-400/20 via-purple-500/10 to-transparent blur-2xl" />
              <div className="relative parchment paper-grain rounded-[1.5rem] p-6 overflow-hidden">
                <div className="aspect-[4/5] rounded-xl overflow-hidden relative" data-testid="hero-illustration">
                  <svg viewBox="0 0 400 500" className="absolute inset-0 w-full h-full" aria-hidden>
                    <defs>
                      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#0b1026" /><stop offset="0.6" stopColor="#2a1b4a" /><stop offset="1" stopColor="#6b3a2e" />
                      </linearGradient>
                      <radialGradient id="moon" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0" stopColor="#fff7d6" /><stop offset="0.7" stopColor="#fde68a" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <rect width="400" height="500" fill="url(#sky)" />
                    <circle cx="290" cy="120" r="80" fill="url(#moon)" opacity="0.35" className="animate-pulse" />
                    <circle cx="290" cy="120" r="38" fill="#fef3c7" />
                    {[[40, 60], [90, 140], [150, 40], [200, 90], [60, 220], [340, 230], [360, 50], [120, 190]].map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r={i % 3 ? 1.4 : 2.2} fill="#fef3c7" className="animate-pulse" style={{ animationDelay: `${i * 0.4}s` }} />
                    ))}
                    <path d="M0 360 L70 290 L120 330 L190 250 L260 320 L320 280 L400 340 L400 500 L0 500Z" fill="#1e1537" />
                    <path d="M0 410 L90 350 L170 400 L250 340 L330 395 L400 370 L400 500 L0 500Z" fill="#130e26" />
                    <g fill="#0a0716">
                      <rect x="230" y="300" width="18" height="60" /><polygon points="226,300 239,272 252,300" />
                      <rect x="252" y="320" width="34" height="40" /><rect x="288" y="295" width="14" height="65" /><polygon points="285,295 295,270 305,295" />
                    </g>
                    <rect x="240" y="315" width="4" height="7" fill="#fbbf24" className="animate-pulse" />
                    <rect x="292" y="310" width="4" height="7" fill="#fbbf24" />
                    <path d="M0 450 Q100 420 200 450 T400 445 L400 500 L0 500Z" fill="#07050f" />
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 right-4 flex flex-wrap gap-1.5">
                    {["Texto", "Imagen", "Voz", "Ambiente"].map((m, i) => (
                      <span key={m} className="animate-fade-up text-[10px] uppercase tracking-[0.2em] font-sans-ui text-amber-100 bg-slate-950/60 border border-amber-400/30 rounded-full px-2 py-1" style={{ animationDelay: `${0.4 + i * 0.25}s` }}>
                        {i + 1}. {m}
                      </span>
                    ))}
                  </div>
                  <div className="absolute bottom-5 left-5 right-5">
                    <div className="text-xs uppercase tracking-[0.3em] text-amber-300/80 font-sans-ui">Escena 03 · Fantasía</div>
                    <h3 className="font-display text-2xl text-amber-100 mt-1">La Torre de las Lunas Dormidas</h3>
                  </div>
                </div>
                <div className="mt-5 font-prose text-slate-300 italic text-lg leading-snug">
                  "Cuando la tercera luna se apagó, Lía subió los peldaños de la torre con una lámpara y una promesa…"
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-amber-300/70 font-sans-ui">
                  <span>· · · · ·</span>
                  <span className="italic">3 de 5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GENRES */}
      <section className="relative max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-amber-300/70 font-sans-ui">Los seis mundos</div>
            <h2 className="font-display text-3xl sm:text-4xl text-amber-100 mt-2">Elige la atmósfera que quieres explorar</h2>
          </div>
          <Link to={primaryTo} className="hidden md:inline text-amber-300 hover:text-amber-200 text-sm font-sans-ui">Ir al taller →</Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {GENRE_LIST.map((g, i) => (
            <div key={g.id} data-testid={`landing-genre-${g.id}`} className="book-card parchment paper-grain relative overflow-hidden rounded-2xl p-6 animate-fade-up" style={{ animationDelay: `${0.05 * i}s` }}>
              <div className={`absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gradient-to-br ${g.soft} blur-2xl`} />
              <div className="relative flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center border" style={{ borderColor: `${g.color}80`, background: `${g.color}1a` }}>
                  <g.Icon className="h-6 w-6" style={{ color: g.color }} />
                </div>
                <div>
                  <h3 className="font-display text-xl text-amber-100">{g.name}</h3>
                  <p className="font-prose text-slate-300/90 italic mt-1">{g.tagline}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRIVACY NOTE */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="parchment paper-grain relative rounded-2xl p-6 sm:p-8 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-amber-300/70 font-sans-ui">Privacidad y soberanía</div>
          <h3 className="font-display text-2xl text-amber-100 mt-2">Tu computadora es el estudio completo</h3>
          <p className="font-prose text-lg text-slate-300/90 mt-3 leading-relaxed">
            Un modelo de lenguaje escribe, Stable Diffusion Turbo ilustra y MMS-TTS narra, todo ejecutándose en tu propia máquina.
            Los modelos se descargan una vez desde Hugging Face y después Storybook funciona sin internet, sin APIs pagas
            y sin enviar tus ideas a ningún servidor.
          </p>
          <Link to="/about" data-testid="landing-architecture-link" className="inline-block mt-5 text-amber-300 hover:text-amber-200 font-sans-ui text-sm">
            Ver la arquitectura →
          </Link>
        </div>
      </section>
    </main>
  );
}
