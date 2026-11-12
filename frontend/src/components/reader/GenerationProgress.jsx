import React from "react";
import { Check, Loader2, Feather, Image as ImageIcon, AudioLines, Hourglass } from "lucide-react";

function Step({ done, active, Icon, label }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-sans-ui ${done ? "text-emerald-300" : active ? "text-amber-200" : "text-slate-500"}`}>
      {done ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function GenerationProgress({ story }) {
  const pct = Math.round((story.progress / story.total_steps) * 100);
  const phase = story.progress < 6 ? "text" : story.progress < 11 ? "image" : "audio";
  return (
    <div data-testid="generation-progress" className="parchment paper-grain rounded-2xl p-5 sm:p-6 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/20" />
            <div className="absolute inset-0 rounded-full border-2 border-amber-400 border-t-transparent spin-slow" />
            {story.status === "queued" ? <Hourglass className="absolute inset-0 m-auto h-4 w-4 text-amber-300" /> : <Feather className="absolute inset-0 m-auto h-4 w-4 text-amber-300" />}
          </div>
          <div>
            <div data-testid="generation-stage" className="font-display text-lg text-amber-100">
              {story.status === "queued" ? `En cola · posición ${story.queue_position || 1}` : story.stage}
            </div>
            <div className="text-xs font-sans-ui text-slate-400">Generando localmente con modelos abiertos · puedes salir y volver más tarde</div>
          </div>
        </div>
        <div data-testid="generation-percent" className="font-display text-3xl text-amber-300">{pct}%</div>
      </div>
      <div className="mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
        {[0, 1, 2, 3, 4].map((i) => {
          const sc = story.scenes[i];
          return (
            <div key={i} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
              <div className="text-xs font-sans-ui text-amber-200/90 mb-1">Escena {i + 1}</div>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <Step done={!!sc} active={!sc && phase === "text" && story.scenes.length === i} Icon={Feather} label="texto" />
                <Step done={!!sc?.image} active={phase === "image" && sc && !sc.image && story.scenes.filter((s) => s.image).length === i} Icon={ImageIcon} label="imagen" />
                <Step done={!!sc?.audio} active={phase === "audio" && sc && !sc.audio && story.scenes.filter((s) => s.audio).length === i} Icon={AudioLines} label="audio" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
