"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { getPrestacionesReporte } from "../actions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Prestador = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
};

type ReporteData = {
  prestador: {
    id: string;
    nombre: string;
    apellido: string;
    documento: string | null;
    email: string | null;
    telefono: string | null;
  };
  prestaciones: Array<{
    id: string;
    tipo_prestacion: string;
    fecha: string;
    monto: number | null;
    descripcion: string | null;
    paciente: {
      nombre: string;
      apellido: string;
      documento: string;
    } | null;
  }>;
  totales: {
    cantidad: number;
    monto: number;
  };
};

export default function ReporteGenerator({ prestadores }: { prestadores: Prestador[] }) {
  const [prestadorId, setPrestadorId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reporteData, setReporteData] = useState<ReporteData | null>(null);

  const handleGenerarReporte = async () => {
    if (!prestadorId || !fechaInicio || !fechaFin) {
      alert("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await getPrestacionesReporte(prestadorId, fechaInicio, fechaFin);
      
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

  const generarPDF = () => {
    if (!reporteData) return;

    const doc = new jsPDF();
    const { prestador, prestaciones, totales } = reporteData;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE PRESTACIONES", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.text("INCLUIR SALUD", 105, 28, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL PRESTADOR", 14, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Nombre: ${prestador.apellido}, ${prestador.nombre}`, 14, 52);
    doc.text(`Documento: ${prestador.documento || "N/A"}`, 14, 58);
    doc.text(`Email: ${prestador.email || "N/A"}`, 14, 64);
    doc.text(`Teléfono: ${prestador.telefono || "N/A"}`, 14, 70);
    doc.text(`Período: ${new Date(fechaInicio).toLocaleDateString("es-AR")} - ${new Date(fechaFin).toLocaleDateString("es-AR")}`, 14, 76);

    const tableData = prestaciones.map((p) => [
      new Date(p.fecha).toLocaleDateString("es-AR"),
      p.tipo_prestacion.replace(/_/g, " ").toUpperCase(),
      p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : "N/A",
      p.paciente?.documento || "N/A",
      `$${(p.monto || 0).toLocaleString("es-AR")}`,
    ]);

    autoTable(doc, {
      startY: 85,
      head: [["Fecha", "Tipo", "Paciente", "DNI Paciente", "Monto"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30, halign: "right" },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Total de Prestaciones: ${totales.cantidad}`, 14, finalY);
    doc.text(`Monto Total: $${totales.monto.toLocaleString("es-AR")}`, 14, finalY + 7);

    const fileName = `Reporte_${prestador.apellido}_${fechaInicio}_${fechaFin}.pdf`;
    doc.save(fileName);
  };

  const generarExcel = () => {
    if (!reporteData) return;

    const { prestador, prestaciones, totales } = reporteData;

    const prestadorInfo = [
      ["REPORTE DE PRESTACIONES - INCLUIR SALUD"],
      [],
      ["DATOS DEL PRESTADOR"],
      ["Nombre:", `${prestador.apellido}, ${prestador.nombre}`],
      ["Documento:", prestador.documento || "N/A"],
      ["Email:", prestador.email || "N/A"],
      ["Teléfono:", prestador.telefono || "N/A"],
      ["Período:", `${new Date(fechaInicio).toLocaleDateString("es-AR")} - ${new Date(fechaFin).toLocaleDateString("es-AR")}`],
      [],
      ["PRESTACIONES COMPLETADAS"],
      ["Fecha", "Tipo", "Paciente", "DNI Paciente", "Monto"],
    ];

    const prestacionesData = prestaciones.map((p) => [
      new Date(p.fecha).toLocaleDateString("es-AR"),
      p.tipo_prestacion.replace(/_/g, " ").toUpperCase(),
      p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : "N/A",
      p.paciente?.documento || "N/A",
      p.monto || 0,
    ]);

    const totalesData = [
      [],
      ["Total de Prestaciones:", totales.cantidad],
      ["Monto Total:", totales.monto],
    ];

    const worksheetData = [...prestadorInfo, ...prestacionesData, ...totalesData];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    ws["!cols"] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 35 },
      { wch: 15 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Reporte");

    const fileName = `Reporte_${prestador.apellido}_${fechaInicio}_${fechaFin}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Parámetros del Reporte</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prestador
            </label>
            <select
              value={prestadorId}
              onChange={(e) => setPrestadorId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seleccionar prestador...</option>
              {prestadores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellido}, {p.nombre} {p.documento ? `(${p.documento})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleGenerarReporte}
            disabled={isLoading || !prestadorId || !fechaInicio || !fechaFin}
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
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Resultados del Reporte</h2>
            <div className="flex gap-2">
              <button
                onClick={generarPDF}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total de Prestaciones</p>
              <p className="text-2xl font-bold text-blue-600">{reporteData.totales.cantidad}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Monto Total</p>
              <p className="text-2xl font-bold text-green-600">
                ${reporteData.totales.monto.toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paciente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reporteData.prestaciones.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(p.fecha).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                      {p.tipo_prestacion.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${(p.monto || 0).toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
