"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, FileSearch, FileText, FolderSearch, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SummaryCard = {
  title: string;
  helper: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
};

type ProviderRow = {
  id: string;
  nombre: string;
  especialidad: string;
  documentosPendientes: number;
  ultimoEnvio: string;
  prioridad: "alta" | "media" | "baja";
};

type Documento = {
  id: string;
  nombre: string;
  tipo: string;
  recibido: string;
  estado: "pendiente" | "observado" | "aprobado";
  previewUrl?: string;
};

const priorityClasses: Record<ProviderRow["prioridad"], string> = {
  alta: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200",
  media: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200",
  baja: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200",
};

export default function AuditoriaPage() {
  const summaryCards: SummaryCard[] = [
    {
      title: "Documentos recibidos",
      helper: "Últimos 7 días",
      value: "132",
      icon: FileSearch,
      gradient: "from-blue-500/90 via-blue-500/70 to-blue-600/80",
    },
    {
      title: "Validaciones completas",
      helper: "Mes en curso",
      value: "87",
      icon: CheckCircle2,
      gradient: "from-emerald-500/90 via-emerald-500/70 to-emerald-600/80",
    },
    {
      title: "Alertas activas",
      helper: "Revisión prioritaria",
      value: "5",
      icon: AlertTriangle,
      gradient: "from-amber-500/90 via-amber-500/70 to-orange-600/80",
    },
  ];

  const prestadores: ProviderRow[] = [
    {
      id: "prov-1",
      nombre: "Clínica San Andrés",
      especialidad: "Traumatología",
      documentosPendientes: 3,
      ultimoEnvio: "02/12/2025 09:21",
      prioridad: "alta",
    },
    {
      id: "prov-2",
      nombre: "Laboratorio BioPlus",
      especialidad: "Laboratorio",
      documentosPendientes: 2,
      ultimoEnvio: "01/12/2025 17:05",
      prioridad: "media",
    },
    {
      id: "prov-3",
      nombre: "Centro Diagnóstico Cuyo",
      especialidad: "Diagnóstico por imagen",
      documentosPendientes: 1,
      ultimoEnvio: "30/11/2025 11:48",
      prioridad: "baja",
    },
  ];

  const documentosPorPrestador: Record<string, Documento[]> = {
    "prov-1": [
      {
        id: "doc-11",
        nombre: "Contrato de adhesión",
        tipo: "Contrato",
        recibido: "02/12/2025 09:21",
        estado: "pendiente",
        previewUrl: "/demo/contrato.pdf",
      },
      {
        id: "doc-12",
        nombre: "Seguro de mala praxis",
        tipo: "Seguro",
        recibido: "02/12/2025 09:15",
        estado: "observado",
      },
      {
        id: "doc-13",
        nombre: "Habilitación municipal",
        tipo: "Habilitación",
        recibido: "01/12/2025 20:02",
        estado: "pendiente",
      },
    ],
    "prov-2": [
      {
        id: "doc-21",
        nombre: "Certificado de calibración",
        tipo: "Certificado",
        recibido: "01/12/2025 17:05",
        estado: "pendiente",
      },
      {
        id: "doc-22",
        nombre: "Póliza de seguro",
        tipo: "Seguro",
        recibido: "28/11/2025 08:33",
        estado: "pendiente",
      },
    ],
    "prov-3": [
      {
        id: "doc-31",
        nombre: "Habilitación provincial",
        tipo: "Habilitación",
        recibido: "30/11/2025 11:48",
        estado: "pendiente",
      },
    ],
  };

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{ documento: Documento; provider: ProviderRow } | null>(null);

  const selectedProvider = useMemo(
    () => prestadores.find((provider) => provider.id === selectedProviderId) ?? null,
    [prestadores, selectedProviderId],
  );

  const documentosSeleccionados = selectedProviderId ? documentosPorPrestador[selectedProviderId] ?? [] : [];

  return (
    <div className="flex-1 w-full flex flex-col gap-8 p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Auditoría</p>
        <h1 className="text-3xl font-bold text-foreground">Documentación de Prestadores</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Vista de prueba para monitorear los archivos que los prestadores cargan al sistema. Desde aquí podrás priorizar,
          revisar y validar la documentación pendiente.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${card.gradient}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">{card.helper}</p>
                  <p className="text-3xl font-semibold">{card.value}</p>
                </div>
                <span className="rounded-full bg-white/20 p-3">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-6 text-lg font-semibold">{card.title}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border/60 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Prestadores con documentos por validar</h2>
            <p className="text-sm text-muted-foreground">Datos ficticios para ejemplificar el flujo.</p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {prestadores.reduce((sum, p) => sum + p.documentosPendientes, 0)} documentos pendientes
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestador</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead className="text-center">Documentos</TableHead>
                <TableHead>Último envío</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prestadores.map((prestador) => (
                <TableRow key={prestador.id}>
                  <TableCell className="font-medium">{prestador.nombre}</TableCell>
                  <TableCell>{prestador.especialidad}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {prestador.documentosPendientes}
                    </Badge>
                  </TableCell>
                  <TableCell>{prestador.ultimoEnvio}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[prestador.prioridad]}`}>
                      {prestador.prioridad.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setSelectedProviderId(prestador.id)}>
                      Validar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <FolderSearch className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Próximamente</h3>
            <p className="text-sm text-muted-foreground">
              Desde aquí podremos descargar comprobantes, dejar observaciones y asignar responsables de control.
              Esta vista servirá como base para iterar el flujo completo de auditoría.
            </p>
          </div>
        </div>
      </section>

      <Dialog open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProviderId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Documentos a validar</DialogTitle>
            <DialogDescription>
              {selectedProvider
                ? `${selectedProvider.nombre} · ${selectedProvider.documentosPendientes} documentos pendientes`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border/70">
            {documentosSeleccionados.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Sin documentos para este prestador.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Recibido</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentosSeleccionados.map((documento) => (
                    <TableRow key={documento.id}>
                      <TableCell className="font-medium">{documento.nombre}</TableCell>
                      <TableCell>{documento.tipo}</TableCell>
                      <TableCell>{documento.recibido}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {documento.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            selectedProvider &&
                            setSelectedDocument({ documento, provider: selectedProvider })
                          }
                        >
                          Ver
                        </Button>
                        <Button size="sm" variant="secondary">
                          Validar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedProviderId(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedDocument}
        onOpenChange={(open) => !open && setSelectedDocument(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.documento.nombre}</DialogTitle>
            <DialogDescription>
              {selectedDocument
                ? `${selectedDocument.provider.nombre} · ${selectedDocument.documento.tipo}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>Recibido el {selectedDocument?.documento.recibido}</p>
              <p>Estado actual: {selectedDocument?.documento.estado}</p>
            </div>
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Vista previa del documento
              <br />
              (Aquí mostraremos el archivo PDF o imagen adjunta)
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2">
            <Button variant="outline" onClick={() => setSelectedDocument(null)}>
              Cerrar
            </Button>
            <Button>Validar documento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
