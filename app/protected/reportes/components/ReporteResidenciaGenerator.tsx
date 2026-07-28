"use client";

import { useState, useEffect } from "react";
import {
  FileDown,
  FileSpreadsheet,
  Loader2,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { getCentros, getPrestadores, getReporteResidencia } from "../actions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type CentroResumen = {
  id: string;
  nombre: string;
};

type ResidenciaReporteData = {
  centro: CentroResumen;
  prestador: {
    id: string;
    nombre: string;
    apellido: string;
    documento: string | null;
    email?: string | null;
    telefono?: string | null;
  };
  pacientes: Array<{
    id: string;
    nombre: string;
    apellido: string;
    documento: string | null;
  }>;
  dias: Array<{
    fecha: string;
    minutos: number;
  }>;
  totalMinutos: number;
};

export default function ReporteResidenciaGenerator({
  centros,
  prestadores,
}: {
  centros: CentroResumen[];
  prestadores: { id: string; nombre: string; apellido: string; documento: string | null }[];
}) {
  const [centroId, setCentroId] = useState("");
  const [prestadorId, setPrestadorId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [centroOpen, setCentroOpen] = useState(false);
  const [centroFilter, setCentroFilter] = useState("");
  const [prestadorOpen, setPrestadorOpen] = useState(false);
  const [prestadorFilter, setPrestadorFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reporteData, setReporteData] = useState<ResidenciaReporteData | null>(null);

  const handleGenerarReporte = async () => {
    if (!centroId || !prestadorId || !fechaInicio || !fechaFin) {
      alert("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await getReporteResidencia(
        centroId,
        prestadorId,
        fechaInicio,
        fechaFin
      );

      if (error || !data) {
        alert("Error al generar el reporte");
        return;
      }

      setReporteData(data);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al generar el reporte");
    } finally {
      setIsLoading(false);
    }
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-AR");
  };

  const formatearDuracion = (minutos: number | null | undefined) => {
    if (minutos === null || minutos === undefined || minutos <= 0) return "0m";
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const generarPDF = () => {
    if (!reporteData) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    }) as jsPDF & {
      lastAutoTable: { finalY: number };
      internal: {
        getNumberOfPages: () => number;
        pageSize: { height: number; width: number };
      };
    };

    const { centro, prestador, pacientes, dias, totalMinutos } = reporteData;
    const marginLeft = 15;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE RESIDENCIA", 105, 20, { align: "center" });

    doc.setFontSize(11);
    doc.text("DATOS DEL CENTRO Y AT", marginLeft, 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Centro: ${centro.nombre}`, marginLeft, 42);
    doc.text(
      `AT: ${prestador.apellido}, ${prestador.nombre}`,
      marginLeft,
      48
    );
    doc.text(`Documento AT: ${prestador.documento || "N/A"}`, marginLeft, 54);
    doc.text(
      `Período: ${formatearFecha(fechaInicio)} al ${formatearFecha(fechaFin)}`,
      marginLeft,
      60
    );

    const pacientesRows = pacientes.map((p) => [
      `${p.apellido}, ${p.nombre}`,
      p.documento || "N/A",
    ]);

    autoTable(doc, {
      startY: 68,
      margin: { left: marginLeft, right: 15 },
      head: [["Paciente", "Documento"]],
      body: pacientesRows.length > 0 ? pacientesRows : [["Sin pacientes", ""]],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    const diasRows = dias.map((d) => [
      formatearFecha(d.fecha),
      formatearDuracion(d.minutos),
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      margin: { left: marginLeft, right: 15 },
      head: [["Fecha", "Duración"]],
      body: diasRows.length > 0 ? diasRows : [["Sin jornadas", ""]],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: "right" } },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(
      `Total de horas trabajadas: ${formatearDuracion(totalMinutos)}`,
      marginLeft,
      finalY
    );

    const fileName = `Reporte_Residencia_${centro.nombre}_${fechaInicio}_${fechaFin}.pdf`;
    doc.save(fileName.replace(/[^a-zA-Z0-9_-]/g, "_"));
  };

  const generarExcel = () => {
    if (!reporteData) return;

    const { centro, prestador, pacientes, dias, totalMinutos } = reporteData;

    const info = [
      ["REPORTE DE RESIDENCIA - INCLUIR SALUD"],
      [],
      ["DATOS DEL CENTRO Y AT"],
      ["Centro:", centro.nombre],
      ["AT:", `${prestador.apellido}, ${prestador.nombre}`],
      ["Documento AT:", prestador.documento || "N/A"],
      ["Período:", `${fechaInicio} - ${fechaFin}`],
      [],
      ["PACIENTES ATENDIDOS"],
      ["Apellido y Nombre", "Documento"],
    ];

    const pacientesRows = pacientes.map((p) => [
      `${p.apellido}, ${p.nombre}`,
      p.documento || "N/A",
    ]);

    const diasHeader = [[], ["HORAS POR DÍA"], ["Fecha", "Duración (min)"]];
    const diasRows = dias.map((d) => [formatearFecha(d.fecha), d.minutos]);

    const totales = [
      [],
      ["Total de horas trabajadas:", formatearDuracion(totalMinutos)],
    ];

    const worksheetData = [
      ...info,
      ...pacientesRows,
      ...diasHeader,
      ...diasRows,
      ...totales,
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    ws["!cols"] = [
      { wch: 40 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Residencia");

    const fileName = `Reporte_Residencia_${centro.nombre}_${fechaInicio}_${fechaFin}.xlsx`;
    XLSX.writeFile(wb, fileName.replace(/[^a-zA-Z0-9._-]/g, "_"));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">
          Parámetros del Reporte de Residencia
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Residencia/Centro</label>
            <DropdownMenu open={centroOpen} onOpenChange={setCentroOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={centroOpen}
                  className="w-full justify-between overflow-hidden text-left"
                >
                  <span className="truncate">
                    {centros.find((c) => c.id === centroId)?.nombre ||
                      "Seleccionar centro..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] p-2">
                <Input
                  placeholder="Buscar centro..."
                  value={centroFilter}
                  onChange={(e) => setCentroFilter(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-60 overflow-y-auto">
                  {centros
                    .filter((c) =>
                      c.nombre.toLowerCase().includes(centroFilter.toLowerCase())
                    )
                    .map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => {
                          setCentroId(c.id);
                          setCentroOpen(false);
                          setCentroFilter("");
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className={`h-4 w-4 ${
                            centroId === c.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {c.nombre}
                      </DropdownMenuItem>
                    ))}
                  {centros.filter((c) =>
                    c.nombre.toLowerCase().includes(centroFilter.toLowerCase())
                  ).length === 0 && (
                    <div className="px-2 py-6 text-sm text-muted-foreground">
                      No se encontraron resultados.
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">AT / Prestador</label>
            <DropdownMenu open={prestadorOpen} onOpenChange={setPrestadorOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={prestadorOpen}
                  className="w-full justify-between overflow-hidden text-left"
                >
                  <span className="truncate">
                    {(() => {
                      const p = prestadores.find((x) => x.id === prestadorId);
                      return p
                        ? `${p.apellido}, ${p.nombre}${
                            p.documento ? ` (${p.documento})` : ""
                          }`
                        : "Seleccionar AT...";
                    })()}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] p-2">
                <Input
                  placeholder="Buscar por nombre o DNI..."
                  value={prestadorFilter}
                  onChange={(e) => setPrestadorFilter(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-60 overflow-y-auto">
                  {prestadores
                    .filter((p) => {
                      const q = prestadorFilter.toLowerCase();
                      return (
                        `${p.apellido} ${p.nombre}`.toLowerCase().includes(q) ||
                        (p.documento || "").toLowerCase().includes(q)
                      );
                    })
                    .map((p) => {
                      const label = `${p.apellido}, ${p.nombre}${
                        p.documento ? ` (${p.documento})` : ""
                      }`;
                      return (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => {
                            setPrestadorId(p.id);
                            setPrestadorOpen(false);
                            setPrestadorFilter("");
                          }}
                          className="flex items-center gap-2"
                        >
                          <Check
                            className={`h-4 w-4 ${
                              prestadorId === p.id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {label}
                        </DropdownMenuItem>
                      );
                    })}
                  {prestadores.filter((p) => {
                    const q = prestadorFilter.toLowerCase();
                    return (
                      `${p.apellido} ${p.nombre}`.toLowerCase().includes(q) ||
                      (p.documento || "").toLowerCase().includes(q)
                    );
                  }).length === 0 && (
                    <div className="px-2 py-6 text-sm text-muted-foreground">
                      No se encontraron resultados.
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fecha Fin</label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleGenerarReporte}
            disabled={isLoading || !centroId || !prestadorId || !fechaInicio || !fechaFin}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              "Generar Reporte"
            )}
          </button>
        </div>
      </div>

      {reporteData && (
        <div className="rounded-lg shadow p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Resultados del Reporte</h2>
            <div className="flex gap-2">
              <button
                onClick={generarPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                Descargar PDF
              </button>
              <button
                onClick={generarExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Descargar Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card p-4 rounded-lg border shadow-sm dark:shadow-none">
              <p className="text-sm text-muted-foreground">Centro</p>
              <p className="text-xl font-bold">{reporteData.centro.nombre}</p>
            </div>
            <div className="bg-card p-4 rounded-lg border shadow-sm dark:shadow-none">
              <p className="text-sm text-muted-foreground">AT</p>
              <p className="text-xl font-bold">
                {reporteData.prestador.apellido}, {reporteData.prestador.nombre}
              </p>
            </div>
            <div className="bg-card p-4 rounded-lg border shadow-sm dark:shadow-none">
              <p className="text-sm text-muted-foreground">Total de Horas</p>
              <p className="text-2xl font-bold">
                {formatearDuracion(reporteData.totalMinutos)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
                Pacientes atendidos ({reporteData.pacientes.length})
              </h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                        Paciente
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                        Documento
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reporteData.pacientes.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 text-sm">
                          {p.apellido}, {p.nombre}
                        </td>
                        <td className="px-4 py-2 text-sm">{p.documento || "N/A"}</td>
                      </tr>
                    ))}
                    {reporteData.pacientes.length === 0 && (
                      <tr>
                        <td className="px-4 py-2 text-sm text-muted-foreground" colSpan={2}>
                          No hay pacientes atendidos en el período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
                Horas por día
              </h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase">
                        Duración
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reporteData.dias.map((d) => (
                      <tr key={d.fecha}>
                        <td className="px-4 py-2 text-sm">
                          {formatearFecha(d.fecha)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-semibold">
                          {formatearDuracion(d.minutos)}
                        </td>
                      </tr>
                    ))}
                    {reporteData.dias.length === 0 && (
                      <tr>
                        <td className="px-4 py-2 text-sm text-muted-foreground" colSpan={2}>
                          No hay jornadas registradas en el período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
