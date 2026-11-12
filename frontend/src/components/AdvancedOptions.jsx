import React from "react";
import { ChevronDown, SlidersHorizontal, Dices } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdvancedOptions({ sys, opts, setOpts, disabled }) {
  const set = (k) => (v) => setOpts((o) => ({ ...o, [k]: v }));
  const profile = sys?.profiles?.[opts.profile];
  const steps = opts.image_steps || profile?.image_steps || 2;

  return (
    <Collapsible className="mt-8 rounded-xl border border-amber-400/20 bg-slate-950/40">
      <CollapsibleTrigger data-testid="advanced-options-toggle" className="w-full flex items-center justify-between px-4 py-3 text-sm font-sans-ui text-amber-200 group">
        <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Opciones avanzadas (para experimentar)</span>
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 grid sm:grid-cols-2 gap-5 text-sm font-sans-ui">
        <div>
          <Label className="text-amber-200/90">Perfil de modelos</Label>
          <div className="mt-2 flex flex-col gap-1.5">
            {Object.entries(sys?.profiles || {}).map(([id, p]) => {
              const missing = [p.text_model, p.image_model, p.tts_model, p.ip_adapter && p.ip_adapter_model]
                .filter(Boolean)
                .filter((model) => !sys.cached_models?.[model]);
              const minVram = p.min_vram_gb;
              const hardwareUnavailable = minVram && (
                sys.device !== "cuda" || !sys.vram_gb || sys.vram_gb < minVram
              );
              const unavailable = hardwareUnavailable || (sys.offline && missing.length > 0);
              const unavailableReason = hardwareUnavailable
                ? `Requiere GPU NVIDIA con ${minVram} GB de VRAM`
                : missing.length > 0 ? `Faltan modelos: ${missing.join(", ")}` : "";
              return (
                <button type="button" key={id} disabled={disabled || unavailable} data-testid={`profile-option-${id}`} onClick={() => set("profile")(id)}
                  aria-label={unavailable ? `${p.label}: ${unavailableReason}` : p.label}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${opts.profile === id ? "border-amber-400/70 bg-amber-400/10 text-amber-100" : "border-white/10 text-slate-300 hover:border-amber-400/40"} ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <div>{p.label}</div>
                  <div className="text-[11px] text-slate-400 truncate">{p.text_model.split("/")[1]} · {p.image_model.split("/")[1]}</div>
                  {unavailable && <div className="text-[11px] text-rose-300 mt-1">{unavailableReason}</div>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <Label className="text-amber-200/90">Semilla (reproducibilidad)</Label>
            <div className="mt-2 flex gap-2">
              <Input data-testid="advanced-seed-input" type="number" min={0} placeholder="aleatoria" value={opts.seed} disabled={disabled}
                onChange={(e) => set("seed")(e.target.value)} className="bg-slate-900/70 border-amber-500/20 text-amber-50" />
              <button type="button" data-testid="advanced-seed-random" onClick={() => set("seed")(String(Math.floor(Math.random() * 999999)))}
                className="rounded-md border border-amber-400/30 px-3 text-amber-200 hover:bg-amber-400/10" aria-label="Semilla aleatoria"><Dices className="h-4 w-4" /></button>
            </div>
          </div>
          <div>
            <Label className="text-amber-200/90">Pasos de difusión: {steps}</Label>
            <Slider data-testid="advanced-steps-slider" className="mt-3" min={1} max={8} step={1} value={[steps]} onValueChange={(v) => set("image_steps")(v[0])} disabled={disabled} />
          </div>
          <div>
            <Label className="text-amber-200/90">Creatividad del texto (temperatura): {opts.temperature.toFixed(2)}</Label>
            <Slider data-testid="advanced-temperature-slider" className="mt-3" min={0} max={1.3} step={0.05} value={[opts.temperature]} onValueChange={(v) => set("temperature")(v[0])} disabled={disabled} />
          </div>
          <label className="flex items-center justify-between gap-3">
            <span className="text-amber-200/90">Estrategia de consistencia<span className="block text-[11px] text-slate-400">personaje, contexto y semilla compartidos</span></span>
            <Switch data-testid="advanced-consistency-switch" checked={opts.consistency} onCheckedChange={set("consistency")} disabled={disabled} />
          </label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
