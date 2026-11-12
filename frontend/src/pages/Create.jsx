import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Feather, Loader2, Sparkles, Wand2, Cpu } from "lucide-react";
import { GENRE_LIST } from "@/lib/genres";
import { api, formatApiError } from "@/lib/api";
import { AdvancedOptions } from "@/components/AdvancedOptions";

const IDEAS = [
  "una niña que colecciona sonidos del bosque",
  "un faro que recuerda a quien no volvió",
  "un robot jardinero en una estación espacial abandonada",
  "un oso que quiere aprender a volar",
];

export default function Create() {
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("fantasia");
  const [loading, setLoading] = useState(false);
  const [sys, setSys] = useState(null);
  const [opts, setOpts] = useState({ profile: "", seed: "", image_steps: 0, temperature: 0.8, consistency: true });
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/system").then(({ data }) => { setSys(data); setOpts((o) => ({ ...o, profile: data.default_profile })); }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (idea.trim().length < 3) {
      toast.error("Describe un poco más tu idea (mínimo 3 caracteres).");
      return;
    }
    setLoading(true);
    try {
      const body = { idea: idea.trim(), genre, temperature: opts.temperature, consistency: opts.consistency };
      if (opts.profile) body.profile = opts.profile;
      if (opts.seed !== "") body.seed = Number(opts.seed);
      if (opts.image_steps) body.image_steps = opts.image_steps;
      const { data } = await api.post("/stories", body);
      toast.success("Cuento en marcha: lo vas a ver tomar forma escena por escena");
      navigate(`/story/${data.id}`);
    } catch (err) {
      setLoading(false);
      toast.error(formatApiError(err.response?.data?.detail) || "No pudimos iniciar tu cuento.");
    }
  };

  const activeGenre = GENRE_LIST.find((g) => g.id === genre);

  return (
    <main className="relative max-w-6xl mx-auto px-6 py-10 sm:py-14">
      <div className="aurora" />
      <div className="relative animate-fade-up">
        <div className="text-xs uppercase tracking-[0.3em] text-amber-300/80 font-sans-ui flex items-center gap-2">
          <Feather className="h-3.5 w-3.5" /> Taller del códice
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-amber-100 mt-3">Comparte una idea y elige un mundo.</h1>
        <p className="font-prose text-lg text-slate-300/90 mt-3 max-w-2xl">
          Un modelo de lenguaje escribe cinco escenas con arco narrativo, un modelo de difusión las ilustra y un modelo
          de voz las narra. Todo se ejecuta en tu computadora con modelos abiertos.
        </p>
      </div>

      <form onSubmit={submit} className="relative mt-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
        {/* LEFT: idea */}
        <div className="parchment paper-grain rounded-2xl p-6 sm:p-8 animate-fade-up">
          <Label htmlFor="idea" className="text-amber-200 font-sans-ui text-sm uppercase tracking-[0.2em]">Tu idea</Label>
          <Textarea
            id="idea"
            data-testid="create-idea-input"
            value={idea}
            maxLength={500}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Un faro que recuerda a quien no volvió… una aprendiz que escucha a los relojes… lo que sea."
            rows={5}
            className="mt-3 bg-slate-950/50 border-amber-500/20 text-amber-50 font-prose text-lg leading-relaxed focus-visible:ring-amber-400/40"
            disabled={loading}
          />
          <div className="mt-3 text-xs text-slate-400 font-sans-ui flex items-center justify-between gap-3 flex-wrap">
            <span>{idea.length}/500</span>
            <span className="flex flex-wrap gap-1.5">
              {IDEAS.map((s, i) => (
                <button type="button" key={s} data-testid={`idea-suggestion-${i + 1}`} onClick={() => setIdea(s)}
                  className="rounded-full border border-amber-400/20 px-2.5 py-0.5 text-amber-200/80 hover:bg-amber-400/10 transition-colors">
                  {s}
                </button>
              ))}
            </span>
          </div>
          <p className="mt-2 text-sm text-amber-200/70 font-prose">
            Incluye quién protagoniza y qué sucede. El género marca el tono; la historia debe conservar tu idea.
          </p>

          <div className="mt-8">
            <Label className="text-amber-200 font-sans-ui text-sm uppercase tracking-[0.2em]">Género</Label>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {GENRE_LIST.map((g) => {
                const active = genre === g.id;
                return (
                  <button
                    type="button"
                    key={g.id}
                    data-testid={`genre-card-${g.id}`}
                    onClick={() => setGenre(g.id)}
                    disabled={loading}
                    className={`relative text-left rounded-xl p-4 border transition-all overflow-hidden ${
                      active ? "border-amber-400/80 bg-amber-400/10 shadow-[0_0_0_1px_rgba(234,179,8,0.5)]" : "border-white/10 bg-slate-900/40 hover:border-amber-400/40"
                    }`}
                    style={{ transform: active ? "translateY(-2px)" : "none" }}
                  >
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center mb-2 border" style={{ borderColor: `${g.color}80`, background: `${g.color}1a` }}>
                      <g.Icon className="h-5 w-5" style={{ color: g.color }} />
                    </div>
                    <div className="font-display text-amber-100 text-lg leading-tight">{g.name}</div>
                    <div className="font-prose italic text-slate-400 text-sm leading-snug mt-1">{g.tagline}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <AdvancedOptions sys={sys} opts={opts} setOpts={setOpts} disabled={loading} />

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <Button type="submit" disabled={loading} data-testid="create-generate-button" className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-medium px-6 py-6 text-base">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Tejer mi cuento
            </Button>
            <span className="text-sm font-sans-ui text-amber-300/70 inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> 5 escenas · texto, imagen, voz y ambiente
            </span>
          </div>
        </div>

        {/* RIGHT: preview */}
        <div className="parchment paper-grain rounded-2xl p-6 sm:p-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-amber-300/70 font-sans-ui">Previsualización del mundo</div>
            <h3 className="font-display text-2xl text-amber-100 mt-2 flex items-center gap-3">
              <activeGenre.Icon className="h-6 w-6" style={{ color: activeGenre.color }} />
              {activeGenre.name}
            </h3>
            <p className="font-prose italic text-slate-300 mt-2">{activeGenre.tagline}</p>
            <ol className="mt-5 space-y-3 font-sans-ui text-sm text-slate-300">
              {[
                "Qwen2.5 crea el título, el protagonista y su descripción visual.",
                "Escribe 5 escenas: inicio, desarrollo, conflicto, clímax y desenlace.",
                "Stable Diffusion Turbo ilustra cada escena con el mismo estilo y personaje.",
                "MMS-TTS narra en español y se sintetiza un ambiente sonoro por escena.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="h-5 w-5 shrink-0 rounded-full border border-amber-400/50 text-amber-300 text-[11px] flex items-center justify-center">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            {sys && (
              <div data-testid="create-device-info" className="mt-6 rounded-xl border border-amber-400/20 bg-slate-950/50 p-4 text-xs font-sans-ui text-slate-400 flex gap-3">
                <Cpu className="h-4 w-4 text-amber-300 shrink-0" />
                <span>
                  Ejecutando en <b className="text-amber-200">{sys.device === "cuda" ? sys.gpu : "CPU"}</b>.{" "}
                  {sys.device === "cuda" ? "Un cuento completo tarda aproximadamente 1–3 minutos." : "Sin GPU, la generación puede tardar varios minutos; puedes volver más tarde."}
                  {sys.queue_size > 0 && ` Hay ${sys.queue_size} cuento(s) en cola.`}
                </span>
              </div>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
