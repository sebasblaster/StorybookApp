import React from "react";
import { Play, Pause, Square, Volume2, VolumeX, Music, Mic2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const fmt = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, "0")}`;

function VolumeRow({ value, onChange, testId }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      {value === 0 ? <VolumeX className="h-4 w-4 text-amber-300/70" /> : <Volume2 className="h-4 w-4 text-amber-300/70" />}
      <Slider data-testid={testId} value={[value]} min={0} max={1} step={0.05} onValueChange={(v) => onChange(v[0])} />
      <span className="text-xs font-sans-ui text-amber-300/70 w-10 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}

const STATUS = { playing: "reproduciendo", paused: "en pausa", idle: "lista" };

export function AudioPanel({ audio, scene }) {
  if (!audio.ready) {
    return (
      <div data-testid="audio-pending" className="rounded-xl border border-amber-400/20 bg-slate-950/50 p-4 flex items-center gap-2 text-sm font-sans-ui text-amber-200/80">
        <Loader2 className="h-4 w-4 animate-spin" /> Voz y ambiente en preparación…
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-400/20 bg-slate-950/50 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-amber-200 font-sans-ui text-sm">
            <Mic2 className="h-4 w-4" /> Narración
            <span data-testid="voice-status" className="text-amber-300/60 text-xs">({STATUS[audio.state]})</span>
          </div>
          <div className="flex items-center gap-2">
            {audio.state === "playing" ? (
              <Button data-testid="voice-pause-button" size="sm" onClick={audio.pause} className="bg-amber-400 hover:bg-amber-300 text-slate-950">
                <Pause className="h-4 w-4 mr-1" /> Pausar
              </Button>
            ) : (
              <Button data-testid="voice-play-button" size="sm" onClick={audio.play} className="bg-amber-400 hover:bg-amber-300 text-slate-950">
                <Play className="h-4 w-4 mr-1" /> {audio.state === "paused" ? "Reanudar" : "Reproducir"}
              </Button>
            )}
            <Button data-testid="voice-stop-button" size="sm" variant="ghost" onClick={audio.stop} className="text-amber-200 hover:bg-white/5" aria-label="Detener">
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs font-sans-ui text-amber-300/70">
          <span className="w-9">{fmt(audio.time)}</span>
          <Slider data-testid="voice-seek-slider" value={[audio.time]} min={0} max={audio.duration || 1} step={0.1} onValueChange={(v) => audio.seek(v[0])} />
          <span className="w-9 text-right">{fmt(audio.duration)}</span>
        </div>
        <VolumeRow value={audio.voiceVolume} onChange={audio.setVoiceVolume} testId="voice-volume-slider" />
      </div>

      <div className="rounded-xl border border-amber-400/20 bg-slate-950/50 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-amber-200 font-sans-ui text-sm">
            <Music className={`h-4 w-4 ${audio.ambientOn ? "animate-pulse" : ""}`} /> Ambiente
            <span data-testid="ambient-name" className="text-amber-300/60 text-xs">· {scene.sound_name}</span>
          </div>
          <Button
            data-testid="ambient-toggle-button"
            size="sm"
            onClick={audio.toggleAmbient}
            className={audio.ambientOn ? "bg-slate-800 hover:bg-slate-700 text-amber-100 border border-amber-400/40" : "bg-amber-400 hover:bg-amber-300 text-slate-950"}
          >
            {audio.ambientOn ? <><Pause className="h-4 w-4 mr-1" /> Detener</> : <><Play className="h-4 w-4 mr-1" /> Reproducir</>}
          </Button>
        </div>
        <VolumeRow value={audio.ambientVolume} onChange={audio.setAmbientVolume} testId="ambient-volume-slider" />
      </div>
    </div>
  );
}
