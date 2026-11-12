import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Heart, Share2, FileDown, Trash2, Copy, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, formatApiError, downloadPdf } from "@/lib/api";

const ghost = "border-amber-400/30 text-amber-100 bg-transparent hover:bg-amber-400/10";

export function StoryActions({ story, onChange }) {
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const done = story.status === "done";
  const link = story.share_token ? `${window.location.origin}/s/${story.share_token}` : "";
  const fail = (e) => toast.error(formatApiError(e.response?.data?.detail));

  const toggleFav = async () => {
    try {
      const { data } = await api.patch(`/stories/${story.id}`, { favorite: !story.favorite });
      onChange(data);
      toast.success(data.favorite ? "Agregado a favoritos" : "Quitado de favoritos");
    } catch (e) { fail(e); }
  };
  const share = async () => {
    try {
      const { data } = await api.post(`/stories/${story.id}/share`);
      onChange({ ...story, share_token: data.share_token });
      setShareOpen(true);
    } catch (e) { fail(e); }
  };
  const unshare = async () => {
    try {
      await api.delete(`/stories/${story.id}/share`);
      onChange({ ...story, share_token: null });
      setShareOpen(false);
      toast.success("Enlace desactivado");
    } catch (e) { fail(e); }
  };
  const pdf = async () => {
    setPdfLoading(true);
    try { await downloadPdf(`/stories/${story.id}/pdf`, story.title); } catch { toast.error("No se pudo generar el PDF"); }
    setPdfLoading(false);
  };
  const remove = async () => {
    try {
      await api.delete(`/stories/${story.id}`);
      toast.success("Cuento eliminado");
      navigate("/library");
    } catch (e) { fail(e); }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button data-testid="story-favorite-button" size="sm" variant="outline" onClick={toggleFav} className={ghost}>
        <Heart className={`h-4 w-4 mr-1 ${story.favorite ? "fill-rose-400 text-rose-400" : ""}`} /> Favorito
      </Button>
      <Button data-testid="story-share-button" size="sm" variant="outline" onClick={share} disabled={!done} className={ghost}>
        <Share2 className="h-4 w-4 mr-1" /> Compartir
      </Button>
      <Button data-testid="story-pdf-button" size="sm" variant="outline" onClick={pdf} disabled={!done || pdfLoading} className={ghost}>
        {pdfLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />} PDF
      </Button>
      <Button data-testid="story-delete-button" size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={story.status === "generating"} className="text-rose-300 hover:bg-rose-500/10">
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="parchment border-amber-400/30 text-amber-50">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-amber-100">Compartir cuento</DialogTitle>
            <DialogDescription className="text-slate-400">Cualquier persona con este enlace podrá leer y escuchar el cuento, sin cuenta. Solo funciona mientras tu servidor esté encendido y accesible en la red.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <input data-testid="share-link-input" readOnly value={link} className="flex-1 rounded-md bg-slate-950/70 border border-amber-500/20 px-3 py-2 text-sm text-amber-50" />
            <Button data-testid="share-copy-button" onClick={() => { navigator.clipboard?.writeText(link); toast.success("Enlace copiado"); }} className="bg-amber-400 hover:bg-amber-300 text-slate-950">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button data-testid="share-disable-button" variant="ghost" onClick={unshare} className="text-rose-300 hover:bg-rose-500/10 justify-start">
            <Link2Off className="h-4 w-4 mr-2" /> Desactivar enlace
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="parchment border-amber-400/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-amber-100">¿Borrar este cuento?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">Se eliminarán sus ilustraciones y audios. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button" className="bg-transparent border-amber-400/30 text-amber-100">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-confirm-button" onClick={remove} className="bg-rose-500 hover:bg-rose-400 text-white">Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
