interface PacienteNotesProps {
  notes: { id: string; fecha: string; prestador?: string | null; texto?: string | null; tipo?: string }[];
}

export function PacienteNotesPlaceholder({ notes }: PacienteNotesProps) {
  if (!notes.length) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No encontramos notas en las prestaciones recientes.
      </div>
    );
  }

  return (
    <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
      {notes.map(note => (
        <article key={note.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{new Date(note.fecha).toLocaleDateString("es-AR", { dateStyle: "medium" })}</span>
            {note.prestador && <span>{note.prestador}</span>}
          </div>
          {note.tipo && (
            <p className="mt-1 text-xs uppercase text-muted-foreground">{note.tipo}</p>
          )}
          <p className="mt-2 whitespace-pre-wrap text-foreground">{note.texto || "(Sin contenido)"}</p>
        </article>
      ))}
    </div>
  );
}
