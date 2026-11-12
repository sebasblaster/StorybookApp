import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, Repeat, AlertTriangle, RefreshCw, FileDown, Wand2, Cpu, Save, Volume2, RotateCcw } from "lucide-react";
import { api, mediaUrl, formatApiError, downloadPdf } from "@/lib/api";
import { GENRE_BY_ID } from "@/lib/genres";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AudioPanel } from "@/components/reader/AudioPanel";
import { GenerationProgress } from "@/components/reader/GenerationProgress";
import { StoryActions } from "@/components/reader/StoryActions";
import { useSceneAudio } from "@/components/reader/useSceneAudio";

function SceneImage({ scene, total }) {
  return (
    <div className="parchment paper-grain rounded-2xl overflow-hidden relative">
      <div className="relative aspect-square overflow-hidden" data-testid="reader-illustration">
        {scene?.image && !scene.regenerating ? (
          <img key={scene.image} src={mediaUrl(scene.image)} alt={`Escena ${scene.index}`} className="absolute inset-0 w-full h-full object-cover animate-scene-in" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 animate-pulse flex items-center justify-center">
            <div className="text-amber-200/80 font-prose italic flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Ilustrando…</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
        <span data-testid="scene-badge" className="absolute top-4 left-4 text-[11px] uppercase tracking-[0.3em] text-amber-200/90 font-sans-ui bg-slate-950/60 border border-amber-400/30 rounded-full px-2.5 py-1">
          Escena {scene?.index || 1} / {total}
        </span>
      </div>
    </div>
  );
}

function SceneWorkshop({ storyId, scene, onStoryChange, refresh }) {
  const [draft, setDraft] = useState(scene.text);
  const [saving, setSaving] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const dirty = draft.trim() !== scene.text;
  const busy = scene.regenerating || scene.audio_regenerating;

  useEffect(() => setDraft(scene.text), [scene.index, scene.text]);

  const saveText = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/stories/${storyId}/scenes/${scene.index}`, { text: draft });
      onStoryChange(data);
      toast.success("Cambios guardados; la versión anterior quedó en el historial.");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const narrate = async () => {
    setNarrating(true);
    try {
      await api.post(`/stories/${storyId}/scenes/${scene.index}/narrate`);
      await refresh();
      toast.success("Narración agregada a la cola.");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setNarrating(false);
    }
  };

  return (
    <section className="rounded-xl border border-amber-400/20 bg-slate-950/40 p-4" data-testid="scene-workshop">
      <label htmlFor={`scene-text-${scene.index}`} className="text-xs uppercase tracking-[0.2em] text-amber-300/80 font-sans-ui">
        Taller · editar esta escena
      </label>
      <Textarea
        id={`scene-text-${scene.index}`}
        data-testid="scene-edit-input"
        value={draft}
        maxLength={2000}
        onChange={(e) => setDraft(e.target.value)}
        disabled={busy || saving}
        rows={5}
        className="mt-2 bg-slate-950/60 border-amber-500/20 text-amber-50 font-prose leading-relaxed"
      />
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400 font-sans-ui">
        <span>{draft.length}/2000 caracteres</span>
        {scene.audio_stale && <span className="text-amber-200">La narración aún corresponde a la versión anterior.</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button data-testid="scene-save-button" size="sm" onClick={saveText} disabled={!dirty || saving || busy}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 disabled:opacity-40">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar texto
        </Button>
        <Button data-testid="scene-narrate-button" size="sm" variant="outline" onClick={narrate}
          disabled={dirty || saving || narrating || busy}
          className="border-amber-400/30 text-amber-100 bg-transparent hover:bg-amber-400/10 disabled:opacity-40">
          {narrating || scene.audio_regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Volume2 className="h-4 w-4 mr-1" />}
          {scene.audio_regenerating ? "Narrando…" : "Actualizar narración"}
        </Button>
      </div>
      {scene.audio_error && <p role="alert" className="mt-2 text-sm text-rose-300">{scene.audio_error}</p>}
      {!!scene.text_versions?.length && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 font-sans-ui">Versiones anteriores</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {scene.text_versions.map((version, index) => (
              <Button key={`${version.saved_at}-${index}`} size="sm" variant="ghost"
                onClick={() => setDraft(version.text)} disabled={busy || saving}
                className="text-amber-200/80 hover:bg-amber-400/10">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar versión {index + 1}
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function StoryReader({ publicToken }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const owner = !publicToken;
  const endpoint = owner ? `/stories/${id}` : `/public/stories/${publicToken}`;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(endpoint);
      setStory(data);
    } catch {
      toast.error(owner ? "No encontramos ese cuento en tu biblioteca." : "Este enlace no existe o fue desactivado.");
      navigate(owner ? "/library" : "/");
    }
  }, [endpoint, owner, navigate]);

  useEffect(() => { load(); }, [load]);

  const busy = story && (["queued", "generating"].includes(story.status) || story.scenes.some((s) => s.regenerating || s.audio_regenerating));
  useEffect(() => {
    if (!busy) return undefined;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [busy, load]);

  const total = 5;
  const available = story?.scenes.length || 0;
  const scene = story?.scenes[sceneIdx];
  const genre = useMemo(() => GENRE_BY_ID[story?.genre] || GENRE_BY_ID.fantasia, [story?.genre]);

  const goNext = useCallback(() => setSceneIdx((i) => Math.min(available - 1, i + 1)), [available]);
  const goPrev = useCallback(() => setSceneIdx((i) => Math.max(0, i - 1)), []);

  const onVoiceEnded = useCallback(() => {
    if (!autoplay) return;
    if (sceneIdx >= total - 1) { setAutoplay(false); toast.success("Fin del cuento"); return; }
    setTimeout(goNext, 1200);
  }, [autoplay, sceneIdx, goNext]);

  const audio = useSceneAudio(scene, { autoplay, onVoiceEnded });

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      // no robar teclas a sliders, campos de texto ni botones (la barra espaciadora activa botones)
      if (e.defaultPrevented || t.closest?.('[role="slider"], input, textarea, button, a, [contenteditable="true"]')) return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === " " && audio.ready) { e.preventDefault(); if (audio.state === "playing") audio.pause(); else audio.play(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, audio]);

  const retry = async (profile) => {
    try { await api.post(`/stories/${id}/retry`, profile ? { profile } : {}); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const regen = async () => {
    try { await api.post(`/stories/${id}/scenes/${scene.index}/regenerate`, {}); toast.success("Reilustrando escena…"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (!story) {
    return <div className="min-h-[60vh] flex items-center justify-center text-amber-200/80 font-prose"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Desplegando las páginas…</div>;
  }

  return (
    <main className="relative max-w-7xl mx-auto px-5 sm:px-8 py-8">
      <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-up">
        {owner ? (
          <Link to="/library" data-testid="reader-back-to-library" className="inline-flex items-center gap-2 text-amber-300/80 hover:text-amber-200 font-sans-ui text-sm">
            <ArrowLeft className="h-4 w-4" /> Volver a mi biblioteca
          </Link>
        ) : (
          <span data-testid="public-reader-label" className="text-amber-300/80 font-sans-ui text-sm">Cuento compartido · Storybook</span>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full border text-xs font-sans-ui" style={{ color: genre.color, borderColor: `${genre.color}80`, background: `${genre.color}1a` }}>
            <genre.Icon className="inline h-3 w-3 mr-1" />{genre.name}
          </span>
          {owner ? <StoryActions story={story} onChange={setStory} /> : (
            <Button data-testid="public-pdf-button" size="sm" variant="outline" onClick={() => downloadPdf(`/public/stories/${publicToken}/pdf`, story.title)} className="border-amber-400/30 text-amber-100 bg-transparent hover:bg-amber-400/10">
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
          )}
        </div>
      </div>

      <h1 data-testid="story-title" className="font-display text-3xl sm:text-4xl lg:text-5xl text-amber-100 leading-tight mt-4 animate-fade-up">{story.title}</h1>
      {story.protagonist && <p className="font-prose italic text-slate-400 mt-2 text-lg">Protagonista: {story.protagonist}</p>}

      {busy && story.status !== "done" && <div className="mt-6"><GenerationProgress story={story} /></div>}

      {story.status === "error" && (
        <div data-testid="generation-error" className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-300 mt-0.5" />
            <div>
              <div className="font-display text-lg text-rose-100">La generación se interrumpió</div>
              <div className="text-sm text-rose-200/80 font-sans-ui mt-1 break-all">{story.error}</div>
            </div>
          </div>
          {owner && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button data-testid="generation-retry-button" onClick={() => retry()} className="bg-amber-400 hover:bg-amber-300 text-slate-950">
                <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
              </Button>
              {story.config.profile !== "ligero" && (
                <Button data-testid="generation-retry-light-button" onClick={() => retry("ligero")} variant="outline" className="border-amber-400/40 text-amber-100 bg-transparent hover:bg-amber-400/10">
                  <Cpu className="h-4 w-4 mr-1" /> Reintentar con perfil ligero
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {scene ? (
        <div key={sceneIdx} className="mt-8 grid lg:grid-cols-[1fr_1fr] gap-8 items-start animate-scene-in">
          <div>
            <SceneImage scene={scene} total={total} />
            {owner && story.status === "done" && (
              <Button data-testid="scene-regenerate-button" size="sm" variant="ghost" onClick={regen} disabled={scene.regenerating} className="mt-3 text-amber-200/80 hover:bg-white/5">
                <Wand2 className="h-4 w-4 mr-1" /> Reilustrar esta escena
              </Button>
            )}
          </div>
          <div className="parchment paper-grain rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-amber-300/70 font-sans-ui">Fragmento {scene.index}</div>
              <p data-testid="reader-scene-text" className="mt-3 font-prose text-xl sm:text-2xl text-slate-100/95 leading-relaxed">{scene.text}</p>
            </div>
            {owner && story.status === "done" && (
              <SceneWorkshop storyId={story.id} scene={scene} onStoryChange={setStory} refresh={load} />
            )}
            <AudioPanel audio={audio} scene={scene} />
            <label className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-slate-950/50 p-4 cursor-pointer">
              <span className="flex items-center gap-2 text-amber-200 font-sans-ui text-sm"><Repeat className="h-4 w-4" /> Reproducción automática
                <span className="text-xs text-amber-300/60">narra y pasa de escena sola</span></span>
              <Switch data-testid="autoplay-switch" checked={autoplay} disabled={story.status !== "done"} onCheckedChange={(v) => { setAutoplay(v); if (v) audio.play(); else audio.stopAll(); }} />
            </label>
          </div>
        </div>
      ) : !busy ? null : (
        <div className="mt-8 font-prose italic text-amber-200/70">La primera escena aparecerá aquí en cuanto el modelo termine de escribirla…</div>
      )}

      {available > 0 && (
        <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
          <Button data-testid="scene-prev-button" onClick={goPrev} disabled={sceneIdx === 0} variant="outline" className="border-amber-400/40 text-amber-100 bg-transparent hover:bg-amber-400/10 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <div className="flex items-center gap-2" data-testid="scene-indicator">
            {[0, 1, 2, 3, 4].map((i) => {
              const sc = story.scenes[i];
              return (
                <button key={i} disabled={!sc} onClick={() => setSceneIdx(i)} data-testid={`scene-dot-${i + 1}`} aria-label={`Ir a escena ${i + 1}`}
                  className={`relative h-12 w-12 rounded-lg overflow-hidden border transition-all ${i === sceneIdx ? "border-amber-300 scale-110 shadow-[0_0_0_2px_rgba(234,179,8,0.35)]" : "border-white/10 opacity-70 hover:opacity-100"} disabled:opacity-25`}>
                  {sc?.image ? <img src={mediaUrl(sc.image)} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-amber-200/70 font-sans-ui">{i + 1}</span>}
                </button>
              );
            })}
          </div>
          <Button data-testid="scene-next-button" onClick={goNext} disabled={sceneIdx >= available - 1} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-medium disabled:opacity-40">
            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      <p data-testid="reader-provenance-note" className="mt-10 text-xs font-sans-ui text-slate-500 leading-relaxed max-w-3xl">
        Generado 100% en local: texto con {story.config.text_model}, ilustraciones con {story.config.image_model} (semilla {story.config.seed}
        {story.config.ip_adapter ? ", IP-Adapter" : ""}), voz con {story.config.tts_model} y ambiente sonoro sintetizado proceduralmente
        (sin archivos de terceros). Atajos: ← → escenas · espacio reproducir/pausar.
      </p>
    </main>
  );
}
