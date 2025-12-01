"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

type NoteItem = {
  id: string;
  fecha: string;
  prestador?: string | null;
  texto?: string | null;
  tipo?: string;
  estado?: string | null;
};

interface PacienteNotesProps {
  notes: NoteItem[];
  currentUserName: string;
}

export function PacienteNotesPlaceholder({ notes, currentUserName }: PacienteNotesProps) {
  const [noteList, setNoteList] = useState(notes);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [newEntry, setNewEntry] = useState("");
  const [saving, setSaving] = useState(false);
  const [highlightedCounts, setHighlightedCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    setNoteList(notes);
  }, [notes]);

  useEffect(() => {
    setNewEntry("");
  }, [selectedNote]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [],
  );

  const chatEntries = useMemo(() => {
    if (!selectedNote?.texto) return [] as string[];
    return selectedNote.texto
      .split(/\n{2,}/)
      .map(entry => entry.trim())
      .filter(Boolean);
  }, [selectedNote?.texto]);

  if (!notes.length) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No encontramos notas en las prestaciones recientes.
      </div>
    );
  }

  return (
    <>
      <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
        {noteList.map(note => (
          <button
            key={note.id}
            type="button"
            onClick={() => {
              setSelectedNote(note);
              setHighlightedCounts(prev => ({ ...prev, [note.id]: 0 }));
            }}
            className="relative w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left text-emerald-900 shadow-sm transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-100"
          >
            {Number(highlightedCounts[note.id]) > 0 && (
              <span className="absolute top-2 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[0.65rem] font-semibold text-white shadow">
                {highlightedCounts[note.id]}
              </span>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
              <span>{formatter.format(new Date(note.fecha))}</span>
              {note.prestador && <span className="truncate text-emerald-800/80 dark:text-emerald-100/80">{note.prestador}</span>}
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-emerald-700/90 dark:text-emerald-100/70">
              {note.tipo || "Nota de prestación"}
            </p>
            <div className="mt-2 rounded-md border border-emerald-200/70 bg-white/70 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-900/50 dark:text-emerald-50">
              <p className="line-clamp-3 whitespace-pre-wrap">
                {note.texto && note.texto.trim().length > 0 ? note.texto : "(Sin contenido)"}
              </p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selectedNote} onOpenChange={open => !open && setSelectedNote(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nota del {selectedNote ? formatter.format(new Date(selectedNote.fecha)) : ""}</DialogTitle>
            <DialogDescription>
              {selectedNote?.prestador ? `Registrada por ${selectedNote.prestador}.` : "Nota registrada en la prestación."}
            </DialogDescription>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-3 text-sm">
              <div className="max-h-40 overflow-auto space-y-2 rounded-md border border-emerald-200/60 bg-emerald-50 px-3 py-2 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-900/40 dark:text-emerald-50">
                {chatEntries.length ? (
                  chatEntries.map((entry, index) => (
                    <div key={`${selectedNote.id}-entry-${index}`} className="rounded-md border border-emerald-200/60 bg-white/70 px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-emerald-900/60">
                      <p className="whitespace-pre-wrap leading-relaxed">{entry}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Sin contenido previo.</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="nueva-nota" className="text-xs font-semibold uppercase tracking-wide text-emerald-700/90 dark:text-emerald-100/70">
                  Agregar mensaje
                </label>
                <textarea
                  id="nueva-nota"
                  className="min-h-[120px] w-full rounded-md border border-emerald-200/70 bg-white/80 px-3 py-2 text-sm text-emerald-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-emerald-800/60 dark:bg-emerald-900/50 dark:text-emerald-50"
                  value={newEntry}
                  onChange={event => setNewEntry(event.target.value)}
                  placeholder="Escribí la actualización. Solo se agregará al final."
                />
                <p className="text-xs text-muted-foreground">Cada mensaje se guardará con tu nombre y la fecha/hora actual.</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setSelectedNote(null)} className="sm:order-1">
                Cerrar
              </Button>
              {selectedNote && !["completada", "cancelada"].includes((selectedNote.estado || "").toLowerCase()) && (
                <Button variant="link" asChild className="px-0 text-emerald-900 dark:text-emerald-100">
                  <Link href={`/protected/prestaciones/editar/${selectedNote.id}`}>Editar prestación completa</Link>
                </Button>
              )}
            </div>
            <Button
              type="button"
              disabled={!selectedNote || saving || !newEntry.trim()}
              onClick={async () => {
                if (!selectedNote) return;
                if (!newEntry.trim()) {
                  toast({ title: "Escribí un mensaje antes de guardar", variant: "destructive" });
                  return;
                }
                setSaving(true);
                try {
                  const timestamp = formatter.format(new Date());
                  const nuevaLinea = `@${currentUserName} · ${timestamp}\n${newEntry.trim()}`;
                  const mergedText = [selectedNote.texto?.trim(), nuevaLinea].filter(Boolean).join("\n\n");

                  const response = await fetch(`/api/prestaciones/${selectedNote.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notas: mergedText }),
                  });
                  if (!response.ok) {
                    const payload = await response.json().catch(() => ({ error: "Error desconocido" }));
                    throw new Error(payload?.error || "No se pudo guardar la nota");
                  }
                  setNoteList(prev => prev.map(note => (note.id === selectedNote.id ? { ...note, texto: mergedText } : note)));
                  setSelectedNote(prev => (prev ? { ...prev, texto: mergedText } : prev));
                  setHighlightedCounts(prev => ({
                    ...prev,
                    [selectedNote.id]: (prev[selectedNote.id] ?? 0) + 1,
                  }));
                  setNewEntry("");
                  toast({ title: "Nota agregada" });
                } catch (error: any) {
                  toast({ title: "No se pudo guardar", description: error?.message ?? "Intentalo nuevamente", variant: "destructive" });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Guardando..." : "Agregar mensaje"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
