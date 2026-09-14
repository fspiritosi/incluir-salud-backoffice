"use client";

import { useState, useEffect } from "react";
import {
  FileDown,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { getCentros, getPrestadores, getReporteResidencia } from "../actions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";

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
    entrada_at: string | null;
    salida_at: string | null;
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
    const [y, m, d] = fecha.split("-");
    return `${d}/${m}/${y}`;
  };

  const formatearHora = (iso: string | null | undefined) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Argentina/Buenos_Aires",
    });
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
      d.entrada_at ? formatearHora(d.entrada_at) : "-",
      d.salida_at ? formatearHora(d.salida_at) : "-",
      formatearDuracion(d.minutos),
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      margin: { left: marginLeft, right: 15 },
      head: [["Fecha", "Entrada", "Salida", "Duración"]],
      body: diasRows.length > 0 ? diasRows : [["Sin jornadas", ""]],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22, halign: "right" },
      },
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

    const diasHeader = [[], ["HORAS POR DÍA"], ["Fecha", "Entrada", "Salida", "Duración (min)"]];
    const diasRows = dias.map((d) => [
      formatearFecha(d.fecha),
      d.entrada_at ? formatearHora(d.entrada_at) : "-",
      d.salida_at ? formatearHora(d.salida_at) : "-",
      d.minutos,
    ]);

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
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
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
            <Combobox
              options={centros.map((c) => ({
                value: c.id,
                label: c.nombre,
                searchText: c.nombre,
              }))}
              value={centroId}
              onValueChange={setCentroId}
              placeholder="Seleccionar centro..."
              searchPlaceholder="Buscar centro..."
              emptyText="No se encontraron centros."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">AT / Prestador</label>
            <Combobox
              options={prestadores.map((p) => ({
                value: p.id,
                label: `${p.apellido}, ${p.nombre}${p.documento ? ` (${p.documento})` : ""}`,
                searchText: `${p.apellido} ${p.nombre} ${p.documento || ""}`,
              }))}
              value={prestadorId}
              onValueChange={setPrestadorId}
              placeholder="Seleccionar AT..."
              searchPlaceholder="Buscar por nombre o DNI..."
              emptyText="No se encontraron ATs."
            />
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
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                        Entrada
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                        Salida
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
                        <td className="px-4 py-2 text-sm">
                          {d.entrada_at ? formatearHora(d.entrada_at) : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {d.salida_at ? formatearHora(d.salida_at) : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-semibold">
                          {formatearDuracion(d.minutos)}
                        </td>
                      </tr>
                    ))}
                    {reporteData.dias.length === 0 && (
                      <tr>
                        <td className="px-4 py-2 text-sm text-muted-foreground" colSpan={4}>
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
