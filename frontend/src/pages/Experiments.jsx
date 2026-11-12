import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Download, Cpu, HardDrive, Loader2, Play, GitCompareArrows } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { api, mediaUrl, formatApiError } from "@/lib/api";
import { GENRE_BY_ID, GENRE_LIST } from "@/lib/genres";
import { Button } from "@/components/ui/button";

const sum = (a) => (a || []).reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;

function toRow(e) {
  const m = e.metrics || {};
  return {
    id: e.id, title: e.title, genre: e.genre, created_at: e.created_at,
    profile: e.config.profile, device: e.config.device, seed: e.config.seed, steps: e.config.image_steps,
    temperature: e.config.temperature, consistency: e.config.consistency, ip_adapter: !!e.config.ip_adapter,
    text_s: m.text_s || 0, image_s: r1(sum(m.image_s)), tts_s: r1(sum(m.tts_s)), ambient_s: r1(sum(m.ambient_s)),
    total_s: m.total_s || 0, tokens: m.tokens || 0, tok_s: m.text_s ? r1(m.tokens / m.text_s) : 0,
    mentions: m.protagonist_mentions ?? 0, audio_s: r1(sum(m.audio_s)),
    clip_mean: m.clip_mean ?? null,
  };
}

function exportCsv(rows) {
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "storybook_experimentos.csv";
  a.click();
}

function SystemCard({ sys }) {
  if (!sys) return null;
  return (
    <div data-testid="system-card" className="parchment paper-grain rounded-2xl p-6 grid sm:grid-cols-3 gap-6">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-amber-300/70 font-sans-ui flex items-center gap-2"><Cpu className="h-3.5 w-3.5" /> Dispositivo</div>
        <div data-testid="system-device" className="font-display text-2xl text-amber-100 mt-1">{sys.device === "cuda" ? sys.gpu : "CPU"}</div>
        <div className="text-xs text-slate-400 font-sans-ui">
          {sys.vram_gb ? `${sys.vram_gb} GB VRAM · ` : ""}PyTorch {sys.torch || "—"} · perfil por defecto: {sys.default_profile}
        </div>
        <div className="text-xs text-slate-400 font-sans-ui mt-1">Modo sin conexión: {sys.offline ? "activado" : "desactivado"} · cola: {sys.queue_size}</div>
      </div>
      <div className="sm:col-span-2">
        <div className="text-xs uppercase tracking-[0.25em] text-amber-300/70 font-sans-ui flex items-center gap-2"><HardDrive className="h-3.5 w-3.5" /> Modelos en caché local</div>
        <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm font-sans-ui">
          {Object.entries(sys.cached_models).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2 text-slate-300"><span className="truncate">{k}</span><span className="text-amber-300/80">{v} GB</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ComparisonCard({ comparison }) {
  const pending = comparison.stories.some((story) => ["queued", "generating"].includes(story.status));
  return (
    <article data-testid="experiment-comparison" className="parchment paper-grain rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-display text-xl text-amber-100">{comparison.idea}</h3>
          <p className="text-sm text-slate-400 font-sans-ui mt-1">
            {GENRE_BY_ID[comparison.genre]?.name} · semilla {comparison.seed} · mismo perfil e idea; cambia la estrategia de consistencia.
          </p>
        </div>
        {pending && <span className="inline-flex items-center gap-2 text-sm text-amber-200 font-sans-ui"><Loader2 className="h-4 w-4 animate-spin" /> Generando en cola</span>}
      </div>
      <div className="mt-5 grid lg:grid-cols-2 gap-4">
        {comparison.stories.map((story) => (
          <section key={story.id} data-testid={`comparison-${story.config.comparison_strategy}`}
            className="rounded-xl border border-amber-400/15 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-lg text-amber-100">
                  Consistencia {story.config.consistency ? "ON" : "OFF"}
                </h4>
                <p className="text-xs text-slate-400 font-sans-ui">{story.config.profile} · {story.config.image_model}</p>
              </div>
              {story.status === "done" && (
                <Link to={`/story/${story.id}`} className="text-sm text-amber-300 hover:text-amber-100">Abrir cuento</Link>
              )}
            </div>
            {story.status === "error" ? (
              <p role="alert" className="mt-3 text-sm text-rose-300">{story.error || "La generación falló."}</p>
            ) : story.status !== "done" ? (
              <p className="mt-3 text-sm text-slate-400 font-sans-ui">{story.stage || "En espera"} · {story.progress}/{story.total_steps}</p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {story.scenes.map((scene) => (
                    <div key={scene.index} className="aspect-square rounded-md overflow-hidden bg-slate-800">
                      {scene.image && <img src={mediaUrl(scene.image)} alt={`Escena ${scene.index}`} className="w-full h-full object-cover" />}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-300 font-sans-ui">
                  CLIP: {story.metrics?.clip_mean == null ? "no disponible" : story.metrics.clip_mean.toFixed(3)}
                  {" · "}mín.: {story.metrics?.clip_min == null ? "—" : story.metrics.clip_min.toFixed(3)}
                  {" · "}tiempo: {story.metrics?.total_s ?? "—"} s
                  {" · "}menciones: {story.metrics?.protagonist_mentions ?? "—"}/5
                </p>
              </>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}

export default function Experiments() {
  const [rows, setRows] = useState(null);
  const [sys, setSys] = useState(null);
  const [comparisons, setComparisons] = useState(null);
  const [compareForm, setCompareForm] = useState({ idea: "", genre: "fantasia", profile: "ligero", seed: "" });
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

  const loadComparisons = useCallback(async () => {
    const { data } = await api.get("/experiments/comparisons");
    setComparisons(data);
    return data;
  }, []);

  useEffect(() => {
    api.get("/experiments").then(({ data }) => setRows(data.map(toRow))).catch(() => setRows([]));
    api.get("/system").then(({ data }) => setSys(data)).catch(() => {});
    loadComparisons().catch(() => setComparisons([]));
  }, [loadComparisons]);

  useEffect(() => {
    if (!comparisons?.some((comparison) => comparison.stories.some((story) => ["queued", "generating"].includes(story.status)))) return undefined;
    const timer = setInterval(() => loadComparisons().catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, [comparisons, loadComparisons]);

  const startComparison = async (e) => {
    e.preventDefault();
    setCompareLoading(true);
    setCompareError("");
    try {
      const body = { idea: compareForm.idea.trim(), genre: compareForm.genre, profile: compareForm.profile };
      if (compareForm.seed !== "") body.seed = Number(compareForm.seed);
      await api.post("/experiments/compare", body);
      setCompareForm((form) => ({ ...form, idea: "" }));
      await loadComparisons();
    } catch (error) {
      setCompareError(formatApiError(error.response?.data?.detail));
    } finally {
      setCompareLoading(false);
    }
  };

  const groups = useMemo(() => {
    if (!rows) return [];
    const by = {};
    rows.forEach((r) => {
      const strat = r.ip_adapter ? "consistencia + IP-Adapter" : r.consistency ? "consistencia ON" : "consistencia OFF";
      const k = `${r.profile} · ${strat} · ${r.steps} pasos`;
      (by[k] ||= []).push(r);
    });
    return Object.entries(by).map(([name, rs]) => {
      const clips = rs.map((r) => r.clip_mean).filter((v) => v !== null);
      return {
        name, n: rs.length, texto: r1(avg(rs.map((r) => r.text_s))), imagen: r1(avg(rs.map((r) => r.image_s))),
        voz: r1(avg(rs.map((r) => r.tts_s))), ambiente: r1(avg(rs.map((r) => r.ambient_s))),
        total: r1(avg(rs.map((r) => r.total_s))), tok_s: r1(avg(rs.map((r) => r.tok_s))), mentions: r1(avg(rs.map((r) => r.mentions))),
        clip: clips.length ? r3(avg(clips)) : "—",
      };
    });
  }, [rows]);

  return (
    <main className="relative max-w-7xl mx-auto px-6 py-10 sm:py-14 space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap animate-fade-up">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-amber-300/80 font-sans-ui flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5" /> Laboratorio</div>
          <h1 className="font-display text-4xl sm:text-5xl text-amber-100 mt-2">Panel de experimentos</h1>
          <p className="font-prose text-lg text-slate-300 mt-2 max-w-2xl">Cada cuento registra su configuración, los tiempos de cada módulo y una métrica objetiva de consistencia visual (similitud CLIP entre escenas, de 0 a 1).</p>
        </div>
        <Button data-testid="experiments-export-csv" disabled={!rows?.length} onClick={() => exportCsv(rows)} className="bg-amber-400 hover:bg-amber-300 text-slate-950">
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <SystemCard sys={sys} />

      <section data-testid="experiment-comparison-panel" className="parchment paper-grain rounded-2xl p-6 sm:p-8 space-y-5">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-amber-300/70 font-sans-ui flex items-center gap-2">
            <GitCompareArrows className="h-3.5 w-3.5" /> Prueba controlada
          </div>
          <h2 className="font-display text-2xl text-amber-100 mt-2">¿La consistencia ayuda a mantener al personaje?</h2>
          <p className="font-prose text-slate-300 mt-1 max-w-3xl">
            Genera dos cuentos con la misma idea, género, perfil y semilla. Compara OFF (sin la estrategia de consistencia)
            con ON, usando las cinco imágenes, la similitud CLIP y los tiempos medidos. Los modelos locales pueden tardar varios minutos.
          </p>
        </div>
        <form onSubmit={startComparison} className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
          <label className="xl:col-span-2 text-sm text-amber-200 font-sans-ui">
            Idea
            <input data-testid="compare-idea-input" required minLength={3} maxLength={500}
              value={compareForm.idea} onChange={(e) => setCompareForm((f) => ({ ...f, idea: e.target.value }))}
              className="mt-1 w-full rounded-md bg-slate-950/60 border border-amber-500/20 px-3 py-2 text-amber-50"
              placeholder="Un zorro que busca la luna" />
          </label>
          <label className="text-sm text-amber-200 font-sans-ui">
            Género
            <select value={compareForm.genre} onChange={(e) => setCompareForm((f) => ({ ...f, genre: e.target.value }))}
              className="mt-1 w-full rounded-md bg-slate-950/60 border border-amber-500/20 px-3 py-2 text-amber-50">
              {GENRE_LIST.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-amber-200 font-sans-ui">
            Perfil
            <select value={compareForm.profile} onChange={(e) => setCompareForm((f) => ({ ...f, profile: e.target.value }))}
              className="mt-1 w-full rounded-md bg-slate-950/60 border border-amber-500/20 px-3 py-2 text-amber-50">
              <option value="ligero">Ligero (CPU)</option>
              <option value="equilibrado">Equilibrado (GPU 8 GB+)</option>
              <option value="calidad">Calidad (GPU 12 GB+)</option>
            </select>
          </label>
          <label className="text-sm text-amber-200 font-sans-ui">
            Semilla (opcional)
            <input type="number" min="0" max="2147483647" value={compareForm.seed}
              onChange={(e) => setCompareForm((f) => ({ ...f, seed: e.target.value }))}
              className="mt-1 w-full rounded-md bg-slate-950/60 border border-amber-500/20 px-3 py-2 text-amber-50"
              placeholder="Aleatoria" />
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <Button data-testid="compare-start-button" type="submit" disabled={compareLoading || compareForm.idea.trim().length < 3}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 disabled:opacity-50">
              {compareLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Ejecutar comparación ON/OFF
            </Button>
          </div>
        </form>
        {compareError && <p role="alert" className="text-sm text-rose-300">{compareError}</p>}
        {comparisons?.length > 0 && (
          <div className="space-y-4 pt-2">
            <h3 className="font-display text-xl text-amber-100">Comparaciones realizadas</h3>
            {comparisons.map((comparison) => <ComparisonCard key={comparison.id} comparison={comparison} />)}
          </div>
        )}
      </section>

      {rows === null && <div className="flex items-center gap-2 text-amber-200/80"><Loader2 className="h-4 w-4 animate-spin" /> Cargando mediciones…</div>}
      {rows?.length === 0 && (
        <div data-testid="experiments-empty" className="parchment rounded-2xl p-8 text-center font-prose text-lg text-slate-300">
          Todavía no hay cuentos terminados. <Link to="/create" className="text-amber-300">Crea uno</Link> para empezar a medir.
        </div>
      )}

      {groups.length > 0 && (
        <div className="parchment paper-grain rounded-2xl p-6">
          <h2 className="font-display text-2xl text-amber-100">Tiempo medio por módulo (segundos)</h2>
          <div className="h-72 mt-4" data-testid="experiments-chart">
            <ResponsiveContainer>
              <BarChart data={groups}>
                <CartesianGrid stroke="#ffffff10" />
                <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#131a2b", border: "1px solid rgba(234,179,8,.3)", color: "#fef3c7" }} />
                <Legend />
                <Bar dataKey="texto" stackId="a" fill="#eab308" />
                <Bar dataKey="imagen" stackId="a" fill="#a855f7" />
                <Bar dataKey="voz" stackId="a" fill="#0ea5e9" />
                <Bar dataKey="ambiente" stackId="a" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm font-sans-ui" data-testid="experiments-groups-table">
              <thead className="text-amber-300/80 text-left"><tr>{["Configuración", "n", "Total s", "Tokens/s", "Menciones protagonista (de 5)", "Similitud CLIP"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
              <tbody className="text-slate-300">{groups.map((g) => <tr key={g.name} className="border-t border-white/5"><td className="py-2 pr-4">{g.name}</td><td>{g.n}</td><td>{g.total}</td><td>{g.tok_s}</td><td>{g.mentions}</td><td data-testid="experiments-clip-cell">{g.clip}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {rows?.length > 0 && (
        <div className="parchment rounded-2xl p-6 overflow-x-auto">
          <h2 className="font-display text-2xl text-amber-100 mb-4">Ejecuciones</h2>
          <table className="w-full text-sm font-sans-ui" data-testid="experiments-runs-table">
            <thead className="text-amber-300/80 text-left"><tr>{["Cuento", "Género", "Perfil", "Disp.", "Semilla", "Pasos", "Temp.", "Consist.", "Texto", "Imagen", "Voz", "CLIP", "Total"].map((h) => <th key={h} className="py-2 pr-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="text-slate-300">
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="py-2 pr-3 max-w-[220px] truncate"><Link to={`/story/${r.id}`} className="hover:text-amber-200">{r.title}</Link></td>
                  <td className="pr-3">{GENRE_BY_ID[r.genre]?.name}</td><td className="pr-3">{r.profile}</td><td className="pr-3">{r.device}</td>
                  <td className="pr-3">{r.seed}</td><td className="pr-3">{r.steps}</td><td className="pr-3">{r.temperature}</td>
                  <td className="pr-3">{r.ip_adapter ? "Sí + IP" : r.consistency ? "Sí" : "No"}</td><td className="pr-3">{r.text_s}s</td><td className="pr-3">{r.image_s}s</td>
                  <td className="pr-3">{r.tts_s}s</td><td className="pr-3">{r.clip_mean ?? "—"}</td><td className="pr-3 text-amber-200">{r.total_s}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
