"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { getPrestacionesReporte } from "../actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


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
    estado: 'pendiente' | 'completada';
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
  const [prestadorOpen, setPrestadorOpen] = useState(false);
  const [prestadorFilter, setPrestadorFilter] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [estado, setEstado] = useState<'todos' | 'pendiente' | 'completada'>('todos');
  const [isLoading, setIsLoading] = useState(false);
  const [reporteData, setReporteData] = useState<ReporteData | null>(null);

  const handleGenerarReporte = async () => {
    if (!prestadorId || !fechaInicio || !fechaFin) {
      alert("Por favor completa todos los campos");
      return;
    }

    // Asegurar formato YYYY-MM-DD
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const iso = date.toISOString().split('T')[0];
      return iso;
    };

    setIsLoading(true);
    try {
      const { data, error } = await getPrestacionesReporte(
        prestadorId, 
        formatDate(fechaInicio),
        formatDate(fechaFin),
        estado === 'todos' ? undefined : estado
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

  const generarPDF = () => {
    if (!reporteData) return;

    // Configurar documento con tipo extendido
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    }) as jsPDF & {
      lastAutoTable: { finalY: number };
      internal: {
        getNumberOfPages: () => number;
        pageSize: { height: number; width: number };
      };
    };
    
    const { prestador, prestaciones, totales } = reporteData;

    // Margen izquierdo
    const marginLeft = 15;
    
    // Encabezado
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE PRESTACIONES", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.text("INCLUIR SALUD", 105, 28, { align: "center" });

    // Datos del prestador
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL PRESTADOR", marginLeft, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Nombre: ${prestador.apellido}, ${prestador.nombre}`, marginLeft, 52);
    doc.text(`Documento: ${prestador.documento || "N/A"}`, marginLeft, 58);
    doc.text(`Email: ${prestador.email || "N/A"}`, marginLeft, 64);
    doc.text(`Teléfono: ${prestador.telefono || "N/A"}`, marginLeft, 70);

    // Función para formatear fecha YYYY-MM-DD a DD-MM-YYYY
    const formatToDMY = (fechaISO: string) => {
      const [year, month, day] = fechaISO.split('-')
      return `${day}-${month}-${year}`;
    };

    doc.text(`Período: ${formatToDMY(fechaInicio)} al ${formatToDMY(fechaFin)}`, marginLeft, 76);

    // Tabla
    const tableData = prestaciones.map((p) => [
      new Date(p.fecha).toLocaleDateString("es-AR"),
      p.tipo_prestacion.replace(/_/g, " ").toUpperCase(),
      p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : "N/A",
      p.paciente?.documento || "N/A",
      p.estado.toUpperCase(),
      `$${(p.monto || 0).toLocaleString("es-AR")}`,
    ]);

    // Pre-calcular total de páginas (método alternativo)
    const tempDoc = new jsPDF();
    
    // Calcular altura total requerida
    const rowHeight = 10; // Altura estimada por fila
    const headerHeight = 15;
    const totalHeight = headerHeight + (tableData.length * rowHeight);
    
    // Calcular espacio disponible por página (A4)
    const pageHeight = tempDoc.internal.pageSize.height - 100; // Margen superior e inferior
    
    // Calcular total de páginas
    const totalPages = Math.ceil(totalHeight / pageHeight);

    // Documento real
    autoTable(doc, {
      startY: 85,
      margin: { left: marginLeft, right: 15 },
      head: [["Fecha", "Tipo", "Paciente", "DNI Paciente", "Estado", "Monto"]],
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
        1: { cellWidth: 35 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
        4: { cellWidth: 28 },
        5: { cellWidth: 25, halign: "right" },
      },
      didDrawPage: function(data: any) {
        const footerY = doc.internal.pageSize.height - 10;
        doc.setFontSize(8);
        doc.setTextColor(100);
        
        // Texto de generación alineado izquierda
        const now = new Date();
        doc.text(
          `Generado: ${now.toLocaleDateString('es-AR')} ${now.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit', hour12: false})} por ${prestador.apellido}, ${prestador.nombre}`,
          data.settings.margin.left,
          footerY
        );
        
        // Paginación alineada derecha
        doc.text(
          `Página ${data.pageNumber} de ${totalPages}`,
          doc.internal.pageSize.width - 20,
          footerY,
          { align: "right" }
        );
      }
    });

    // Totales
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Total de Prestaciones: ${totales.cantidad}`, marginLeft, finalY);
    doc.text(`Monto Total: $${totales.monto.toLocaleString("es-AR")}`, marginLeft, finalY + 7);

    // Guardar
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
      ["Período:", `${fechaInicio} - ${fechaFin}`],
      [],
      ["PRESTACIONES COMPLETADAS"],
      ["Fecha", "Tipo", "Paciente", "DNI Paciente", "Estado", "Monto"],
    ];

    const prestacionesData = prestaciones.map((p) => [
      new Date(p.fecha).toLocaleDateString("es-AR"),
      p.tipo_prestacion.replace(/_/g, " ").toUpperCase(),
      p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : "N/A",
      p.paciente?.documento || "N/A",
      p.estado,
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
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Reporte");

    const fileName = `Reporte_${prestador.apellido}_${fechaInicio}_${fechaFin}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Parámetros del Reporte</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Prestador
            </label>
            <DropdownMenu open={prestadorOpen} onOpenChange={setPrestadorOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={prestadorOpen}
                  className="w-full justify-between"
                >
                  {(() => {
                    const p = prestadores.find((x) => x.id === prestadorId);
                    return p
                      ? `${p.apellido}, ${p.nombre}${p.documento ? ` (${p.documento})` : ""}`
                      : "Seleccionar prestador...";
                  })()}
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
                {prestadores
                  .filter((p) => {
                    const q = prestadorFilter.toLowerCase();
                    return (
                      `${p.apellido} ${p.nombre}`.toLowerCase().includes(q) ||
                      (p.documento || "").toLowerCase().includes(q)
                    );
                  })
                  .map((p) => {
                    const label = `${p.apellido}, ${p.nombre}${p.documento ? ` (${p.documento})` : ""}`;
                    return (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => {
                          setPrestadorId(p.id);
                          setPrestadorOpen(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check className={`h-4 w-4 ${prestadorId === p.id ? "opacity-100" : "opacity-0"}`} />
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
                  <div className="px-2 py-6 text-sm text-muted-foreground">No se encontraron resultados.</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Fecha Inicio
            </label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Fecha Fin
            </label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Estado
            </label>
            <Select
              value={estado}
              onValueChange={(v: 'todos' | 'pendiente' | 'completada') => setEstado(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="completada">Completadas</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-card p-4 rounded-lg border shadow-sm dark:shadow-none">
              <p className="text-sm text-muted-foreground">Total de Prestaciones</p>
              <p className="text-2xl font-bold">{reporteData.totales.cantidad}</p>
            </div>
            <div className="bg-card p-4 rounded-lg border shadow-sm dark:shadow-none">
              <p className="text-sm text-muted-foreground">Monto Total</p>
              <p className="text-2xl font-bold text-primary">
                ${reporteData.totales.monto.toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Paciente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reporteData.prestaciones.map((p) => (
                  <tr key={p.id} className="hover:bg-accent">
                    <td className="px-4 py-3 text-sm">
                      {new Date(p.fecha).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize">
                      {p.tipo_prestacion.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {p.estado}
                    </td>
                    <td className="px-4 py-3 text-sm">
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
