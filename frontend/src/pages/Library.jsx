import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Library as LibraryIcon, Loader2, Feather, BookOpen, Search, Heart } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { GENRE_LIST } from "@/lib/genres";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LibraryCard } from "@/components/LibraryCard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Library() {
  const [stories, setStories] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = (quiet) => {
    setError(false);
    if (!quiet) setStories(null);
    api.get("/stories").then(({ data }) => setStories(data)).catch(() => setError(true));
  };

  useEffect(() => { load(); }, []);

  const pending = stories?.some((s) => ["queued", "generating"].includes(s.status));
  useEffect(() => {
    if (!pending) return undefined;
    const t = setInterval(() => load(true), 4000);
    return () => clearInterval(t);
  }, [pending]);

  const visible = useMemo(() => (stories || []).filter((s) =>
    (!favOnly || s.favorite) && (!genre || s.genre === genre) &&
    (!q || `${s.title} ${s.idea}`.toLowerCase().includes(q.toLowerCase()))), [stories, favOnly, genre, q]);

  const toggleFav = async (s) => {
    try {
      const { data } = await api.patch(`/stories/${s.id}`, { favorite: !s.favorite });
      setStories((list) => list.map((x) => (x.id === s.id ? data : x)));
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const remove = async () => {
    try {
      await api.delete(`/stories/${toDelete.id}`);
      setStories((list) => list.filter((x) => x.id !== toDelete.id));
      toast.success("Cuento eliminado");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    setToDelete(null);
  };

  return (
    <main className="relative max-w-7xl mx-auto px-6 py-10 sm:py-14">
      <div className="flex items-center justify-between flex-wrap gap-4 animate-fade-up">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-amber-300/80 font-sans-ui flex items-center gap-2">
            <LibraryIcon className="h-3.5 w-3.5" /> Tu colección
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-amber-100 mt-2">Mi biblioteca</h1>
          <p className="font-prose text-slate-300 text-lg mt-2">Todos los cuentos encuadernados a tu nombre.</p>
        </div>
        <Link to="/create">
          <Button data-testid="library-new-story-button" className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-medium">
            <Feather className="h-4 w-4 mr-2" /> Nuevo cuento
          </Button>
        </Link>
      </div>

      <div className="mt-10">
        {error && (
          <div data-testid="library-error" className="parchment rounded-2xl p-8 text-center">
            <p className="font-prose text-lg text-red-200">No pudimos abrir tu biblioteca. Comprueba que el servidor esté encendido.</p>
            <Button data-testid="library-retry-button" onClick={() => load()} className="mt-4 bg-amber-400 hover:bg-amber-300 text-slate-950">Reintentar</Button>
          </div>
        )}

        {!error && stories === null && (
          <div className="flex items-center gap-2 text-amber-200/80 font-prose"><Loader2 className="h-4 w-4 animate-spin" /> Abriendo los estantes…</div>
        )}

        {stories && stories.length === 0 && (
          <div className="parchment paper-grain rounded-2xl p-10 text-center animate-fade-up">
            <BookOpen className="h-10 w-10 text-amber-300 mx-auto mb-4" />
            <h2 className="font-display text-2xl text-amber-100">Tu biblioteca aún está en blanco</h2>
            <p className="font-prose text-slate-300 mt-2">Crea tu primer cuento y aparecerá aquí, listo para releer.</p>
            <Link to="/create" className="inline-block mt-6">
              <Button data-testid="library-empty-cta" className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-medium">Crear mi primer cuento</Button>
            </Link>
          </div>
        )}

        {stories && stories.length > 0 && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-300/60" />
                <Input data-testid="library-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título o idea…"
                  className="pl-9 w-64 bg-slate-900/70 border-amber-500/20 text-amber-50" />
              </div>
              <button data-testid="library-filter-favorites" onClick={() => setFavOnly((v) => !v)}
                className={`rounded-full border px-3 py-1.5 text-sm font-sans-ui inline-flex items-center gap-1.5 transition-colors ${favOnly ? "border-rose-400/60 bg-rose-400/10 text-rose-200" : "border-white/10 text-slate-300 hover:border-amber-400/40"}`}>
                <Heart className={`h-3.5 w-3.5 ${favOnly ? "fill-rose-400 text-rose-400" : ""}`} /> Favoritos
              </button>
              {[{ id: "", name: "Todos" }, ...GENRE_LIST].map((g) => (
                <button key={g.id || "all"} data-testid={`library-filter-genre-${g.id || "all"}`} onClick={() => setGenre(g.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-sans-ui transition-colors ${genre === g.id ? "border-amber-400/70 bg-amber-400/10 text-amber-100" : "border-white/10 text-slate-300 hover:border-amber-400/40"}`}>
                  {g.name}
                </button>
              ))}
            </div>
            {visible.length === 0 && <p data-testid="library-no-results" className="font-prose italic text-slate-400 text-lg">Ningún cuento coincide con esos filtros.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visible.map((s, i) => (
                <LibraryCard key={s.id} s={s} i={i} onFavorite={() => toggleFav(s)} onDelete={() => setToDelete(s)} />
              ))}
            </div>
          </>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="parchment border-amber-400/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-amber-100">¿Borrar «{toDelete?.title}»?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">Se eliminarán sus ilustraciones y audios. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="library-delete-cancel" className="bg-transparent border-amber-400/30 text-amber-100">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="library-delete-confirm" onClick={remove} className="bg-rose-500 hover:bg-rose-400 text-white">Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
