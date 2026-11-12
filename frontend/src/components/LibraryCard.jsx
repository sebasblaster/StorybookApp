import React from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2, Loader2, AlertTriangle, BookOpen } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { GENRE_BY_ID } from "@/lib/genres";

function StatusBadge({ s }) {
  if (s.status === "done") return <span className="text-emerald-300/90">5 escenas · listo</span>;
  if (s.status === "error") return <span className="text-rose-300 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Error</span>;
  return (
    <span className="text-amber-200 inline-flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" /> {s.status === "queued" ? "En cola" : `${Math.round((s.progress / s.total_steps) * 100)}%`}
    </span>
  );
}

export function LibraryCard({ s, i, onFavorite, onDelete }) {
  const g = GENRE_BY_ID[s.genre] || GENRE_BY_ID.fantasia;
  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
  return (
    <Link to={`/story/${s.id}`} data-testid={`library-card-${i + 1}`}
      className="group book-card parchment paper-grain rounded-2xl overflow-hidden relative animate-fade-up" style={{ animationDelay: `${0.04 * i}s` }}>
      <div className="relative aspect-[5/3] overflow-hidden">
        {s.cover ? (
          <img src={mediaUrl(s.cover)} alt={s.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-amber-300/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        <div className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border font-sans-ui"
          style={{ color: g.color, borderColor: `${g.color}80`, background: `${g.color}26` }}>
          <g.Icon className="inline h-3 w-3 mr-1" />{g.name}
        </div>
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button data-testid={`library-card-fav-${i + 1}`} onClick={stop(onFavorite)} aria-label="Favorito"
            className="h-8 w-8 rounded-full bg-slate-950/70 border border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
            <Heart className={`h-4 w-4 ${s.favorite ? "fill-rose-400 text-rose-400" : "text-amber-100"}`} />
          </button>
          {s.status !== "generating" && (
            <button data-testid={`library-card-delete-${i + 1}`} onClick={stop(onDelete)} aria-label="Borrar"
              className="h-8 w-8 rounded-full bg-slate-950/70 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-rose-300 text-amber-100">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl text-amber-100 leading-snug line-clamp-2">{s.title}</h3>
        <p className="font-prose italic text-slate-300 mt-1 line-clamp-2">“{s.idea}”</p>
        <div className="mt-4 flex items-center justify-between text-xs font-sans-ui text-amber-300/70">
          <StatusBadge s={s} />
          <span>{s.status === "done" ? "Leer cuento →" : "Ver avance →"}</span>
        </div>
      </div>
    </Link>
  );
}
