"use client";

import { useState, useEffect } from "react";
import {
  FileDown,
  FileSpreadsheet,
  Loader2,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import {
  getBeneficiarios,
  getPrestadoresDeBeneficiario,
  getTiposPrestacionDeBeneficiario,
  getPrestacionesReporteBeneficiario,
} from "../actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Beneficiario = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
};

export type PrestadorResumen = {
  id: string;
  nombre: string;
  apellido: string;
  documento?: string | null;
  email?: string | null;
  telefono?: string | null;
};

type ReporteBeneficiarioData = {
  beneficiario: {
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
    estado: "pendiente" | "completada";
    prestador: {
      nombre: string;
      apellido: string;
      documento: string | null;
      email: string | null;
      telefono: string | null;
    } | null;
  }>;
  totales: {
    cantidad: number;
    monto: number;
  };
};

export default function ReporteBeneficiarioGenerator({
  beneficiarios,
}: {
  beneficiarios: Beneficiario[];
}) {
  const [beneficiarioId, setBeneficiarioId] = useState("");
  const [beneficiarioOpen, setBeneficiarioOpen] = useState(false);
  const [beneficiarioFilter, setBeneficiarioFilter] = useState("");
  const [prestadorIds, setPrestadorIds] = useState<string[]>([]);
  const [prestadorOpen, setPrestadorOpen] = useState(false);
  const [prestadorFilter, setPrestadorFilter] = useState("");
  const [prestadores, setPrestadores] = useState<PrestadorResumen[]>([]);
  const [tiposPrestacionOpts, setTiposPrestacionOpts] = useState<string[]>([]);
  const [tiposPrestacionSel, setTiposPrestacionSel] = useState<string[]>([]);
  const [tiposOpen, setTiposOpen] = useState(false);
  const [tiposFilter, setTiposFilter] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [estado, setEstado] = useState<"todos" | "pendiente" | "completada">(
    "todos"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [reporteData, setReporteData] = useState<ReporteBeneficiarioData | null>(
    null
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setPrestadorIds([]);
    setPrestadores([]);
    setPrestadorFilter("");
    setTiposPrestacionSel([]);
    setTiposPrestacionOpts([]);
    setTiposFilter("");
    if (!beneficiarioId) return;

    (async () => {
      const list = await getPrestadoresDeBeneficiario(beneficiarioId);
      setPrestadores(list);
    })();
  }, [beneficiarioId]);

  useEffect(() => {
    if (!beneficiarioId) return;
    (async () => {
      const tipos = await getTiposPrestacionDeBeneficiario(
        beneficiarioId,
        prestadorIds.length > 0 ? prestadorIds : undefined
      );
      const opts = tipos || [];
      setTiposPrestacionOpts(opts);
      setTiposPrestacionSel((prev) => prev.filter((t) => opts.includes(t)));
    })();
  }, [beneficiarioId, prestadorIds]);

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch("/images/logoIncluirTransparente.png");
        if (!response.ok) return;
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoDataUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("No se pudo cargar el logo para el reporte", error);
      }
    };

    loadLogo();
  }, []);

  const handleGenerarReporte = async () => {
    if (!beneficiarioId || !fechaInicio || !fechaFin) {
      alert("Por favor completa todos los campos");
      return;
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toISOString().split("T")[0];
    };

    setIsLoading(true);
    try {
      const { data, error } = await getPrestacionesReporteBeneficiario(
        beneficiarioId,
        formatDate(fechaInicio),
        formatDate(fechaFin),
        estado === "todos" ? undefined : estado,
        prestadorIds.length > 0 ? prestadorIds : undefined,
        tiposPrestacionSel.length > 0 ? tiposPrestacionSel : undefined
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

    const { beneficiario, prestaciones, totales } = reporteData;
    const marginLeft = 15;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    if (logoDataUrl) {
      const logoWidth = 30;
      const logoHeight = 30;
      const pageWidth = doc.internal.pageSize.width;
      const logoX = pageWidth - marginLeft - logoWidth;
      doc.addImage(logoDataUrl, "PNG", logoX, 12, logoWidth, logoHeight);
    }
    doc.text("REPORTE DE PRESTACIONES", 105, 20, { align: "center" });
    doc.setFontSize(14);
    doc.text("POR BENEFICIARIO", 105, 28, { align: "center" });

    doc.setFontSize(11);
    doc.text("DATOS DEL BENEFICIARIO", marginLeft, 45);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Nombre: ${beneficiario.apellido}, ${beneficiario.nombre}`,
      marginLeft,
      52
    );
    doc.text(`Documento: ${beneficiario.documento || "N/A"}`, marginLeft, 58);
    doc.text(`Email: ${beneficiario.email || "N/A"}`, marginLeft, 64);
    doc.text(`Teléfono: ${beneficiario.telefono || "N/A"}`, marginLeft, 70);

    const formatToDMY = (fechaISO: string) => {
      const [year, month, day] = fechaISO.split("-");
      return `${day}-${month}-${year}`;
    };

    doc.text(
      `Período: ${formatToDMY(fechaInicio)} al ${formatToDMY(fechaFin)}`,
      marginLeft,
      76
    );

    const tableData = prestaciones.map((p) => [
      new Date(p.fecha).toLocaleDateString("es-AR"),
      p.tipo_prestacion.replace(/_/g, " ").toUpperCase(),
      p.prestador ? `${p.prestador.apellido}, ${p.prestador.nombre}` : "N/A",
      p.prestador?.documento || "N/A",
      p.estado.toUpperCase(),
      `$${(p.monto || 0).toLocaleString("es-AR")}`,
    ]);

    const tempDoc = new jsPDF();
    const rowHeight = 10;
    const headerHeight = 15;
    const totalHeight = headerHeight + tableData.length * rowHeight;
    const pageHeight = tempDoc.internal.pageSize.height - 100;
    const totalPages = Math.ceil(totalHeight / pageHeight) || 1;

    autoTable(doc, {
      startY: 85,
      margin: { left: marginLeft, right: 15 },
      head: [["Fecha", "Tipo", "Prestador", "DNI Prestador", "Estado", "Monto"]],
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
      didDrawPage: function (data: any) {
        const footerY = doc.internal.pageSize.height - 10;
        doc.setFontSize(8);
        doc.setTextColor(100);
        const now = new Date();
        doc.text(
          `Generado: ${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString(
            "es-AR",
            {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }
          )} para ${beneficiario.apellido}, ${beneficiario.nombre}`,
          data.settings.margin.left,
          footerY
        );
        doc.text(
          `Página ${data.pageNumber} de ${totalPages}`,
          doc.internal.pageSize.width - 20,
          footerY,
          { align: "right" }
        );
      },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Total de Prestaciones: ${totales.cantidad}`, marginLeft, finalY);
    doc.text(
      `Monto Total: $${totales.monto.toLocaleString("es-AR")}`,
      marginLeft,
      finalY + 7
    );

    const fileName = `Reporte_Beneficiario_${beneficiario.apellido}_${fechaInicio}_${fechaFin}.pdf`;
    doc.save(fileName);
  };

  const generarExcel = () => {
    if (!reporteData) return;

    const { beneficiario, prestaciones, totales } = reporteData;

    const beneficiarioInfo = [
      ["REPORTE DE PRESTACIONES POR BENEFICIARIO - INCLUIR SALUD"],
      [],
      ["DATOS DEL BENEFICIARIO"],
      ["Nombre:", `${beneficiario.apellido}, ${beneficiario.nombre}`],
      ["Documento:", beneficiario.documento || "N/A"],
      ["Email:", beneficiario.email || "N/A"],
      ["Teléfono:", beneficiario.telefono || "N/A"],
      ["Período:", `${fechaInicio} - ${fechaFin}`],
      [],
      ["PRESTACIONES"],
      ["Fecha", "Tipo", "Prestador", "DNI Prestador", "Estado", "Monto"],
    ];

    const prestacionesData = prestaciones.map((p) => [
      new Date(p.fecha).toLocaleDateString("es-AR"),
      p.tipo_prestacion.replace(/_/g, " ").toUpperCase(),
      p.prestador ? `${p.prestador.apellido}, ${p.prestador.nombre}` : "N/A",
      p.prestador?.documento || "N/A",
      p.estado,
      p.monto || 0,
    ]);

    const totalesData = [
      [],
      ["Total de Prestaciones:", totales.cantidad],
      ["Monto Total:", totales.monto],
    ];

    const worksheetData = [
      ...beneficiarioInfo,
      ...prestacionesData,
      ...totalesData,
    ];

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

    const fileName = `Reporte_Beneficiario_${beneficiario.apellido}_${fechaInicio}_${fechaFin}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">
          Parámetros del Reporte por Beneficiario
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Beneficiario</label>
            <DropdownMenu open={beneficiarioOpen} onOpenChange={setBeneficiarioOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={beneficiarioOpen}
                  className="w-full justify-between overflow-hidden text-left"
                >
                  <span className="truncate">
                    {(() => {
                      const b = beneficiarios.find((x) => x.id === beneficiarioId);
                      return b
                        ? `${b.apellido}, ${b.nombre}${
                            b.documento ? ` (${b.documento})` : ""
                          }`
                        : "Seleccionar beneficiario...";
                    })()}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] p-2">
                <Input
                  placeholder="Buscar por nombre o DNI..."
                  value={beneficiarioFilter}
                  onChange={(e) => setBeneficiarioFilter(e.target.value)}
                  className="mb-2"
                />
                {beneficiarios
                  .filter((b) => {
                    const q = beneficiarioFilter.toLowerCase();
                    return (
                      `${b.apellido} ${b.nombre}`.toLowerCase().includes(q) ||
                      (b.documento || "").toLowerCase().includes(q)
                    );
                  })
                  .map((b) => {
                    const label = `${b.apellido}, ${b.nombre}${
                      b.documento ? ` (${b.documento})` : ""
                    }`;
                    return (
                      <DropdownMenuItem
                        key={b.id}
                        onClick={() => {
                          setBeneficiarioId(b.id);
                          setBeneficiarioOpen(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className={`h-4 w-4 ${
                            beneficiarioId === b.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {label}
                      </DropdownMenuItem>
                    );
                  })}
                {beneficiarios.filter((b) => {
                  const q = beneficiarioFilter.toLowerCase();
                  return (
                    `${b.apellido} ${b.nombre}`.toLowerCase().includes(q) ||
                    (b.documento || "").toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <div className="px-2 py-6 text-sm text-muted-foreground">
                    No se encontraron resultados.
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Prestadores</label>
            <DropdownMenu open={prestadorOpen} onOpenChange={setPrestadorOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={prestadorOpen}
                  className="w-full justify-between overflow-hidden text-left"
                  disabled={!beneficiarioId}
                >
                  <span className="truncate">
                    {(() => {
                      if (!beneficiarioId)
                        return "Seleccioná un beneficiario primero";
                      if (prestadorIds.length === 0)
                        return "Todos los prestadores";
                      if (prestadorIds.length === 1) {
                        const p = prestadores.find((x) => x.id === prestadorIds[0]);
                        return p
                          ? `${p.apellido}, ${p.nombre}${
                              p.documento ? ` (${p.documento})` : ""
                            }`
                          : "1 prestador";
                      }
                      return `${prestadorIds.length} prestadores seleccionados`;
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
                  disabled={!beneficiarioId}
                />
                <DropdownMenuItem
                  disabled={!beneficiarioId}
                  onClick={() => {
                    setPrestadorIds([]);
                    setPrestadorOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={`h-4 w-4 ${
                      prestadorIds.length === 0 ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  Todos los prestadores
                </DropdownMenuItem>
                {prestadores
                  .filter((p) => {
                    const q = prestadorFilter.toLowerCase().trim();
                    const qDigits = q.replace(/\D/g, "");
                    const fullName = `${p.apellido} ${p.nombre}`.toLowerCase();
                    const doc = (p.documento || "").toLowerCase();
                    const docDigits = doc.replace(/\D/g, "");
                    return (
                      fullName.includes(q) ||
                      (qDigits.length > 0 && docDigits.includes(qDigits)) ||
                      doc.includes(q)
                    );
                  })
                  .map((p) => {
                    const label = `${p.apellido}, ${p.nombre}${
                      p.documento ? ` (${p.documento})` : ""
                    }`;
                    return (
                      <DropdownMenuItem
                        key={p.id}
                        onSelect={(e) => {
                          e.preventDefault();
                          setPrestadorIds((prev) => {
                            const exists = prev.includes(p.id);
                            return exists
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id];
                          });
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className={`h-4 w-4 ${
                            prestadorIds.includes(p.id)
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        {label}
                      </DropdownMenuItem>
                    );
                  })}
                {beneficiarioId &&
                  prestadores.filter((p) => {
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Tipo de prestación
            </label>
            <DropdownMenu open={tiposOpen} onOpenChange={setTiposOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={tiposOpen}
                  className="w-full justify-between overflow-hidden text-left"
                  disabled={!beneficiarioId}
                >
                  <span className="truncate">
                    {(() => {
                      if (!beneficiarioId)
                        return "Seleccioná un beneficiario primero";
                      if (tiposPrestacionSel.length === 0)
                        return "Todos los tipos";
                      if (tiposPrestacionSel.length === 1) {
                        const t = tiposPrestacionSel[0];
                        return t.replace(/_/g, " ");
                      }
                      return `${tiposPrestacionSel.length} tipos seleccionados`;
                    })()}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] p-2">
                <Input
                  placeholder="Buscar tipo..."
                  value={tiposFilter}
                  onChange={(e) => setTiposFilter(e.target.value)}
                  className="mb-2"
                  disabled={!beneficiarioId}
                />
                <DropdownMenuItem
                  disabled={!beneficiarioId}
                  onClick={() => {
                    setTiposPrestacionSel([]);
                    setTiposOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={`h-4 w-4 ${
                      tiposPrestacionSel.length === 0 ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  Todos los tipos
                </DropdownMenuItem>
                {tiposPrestacionOpts
                  .filter((t) => {
                    const label = t.replace(/_/g, " ").toLowerCase();
                    const q = tiposFilter.toLowerCase().trim();
                    return label.includes(q);
                  })
                  .map((t) => {
                    const label = t.replace(/_/g, " ");
                    const selected = tiposPrestacionSel.includes(t);
                    return (
                      <DropdownMenuItem
                        key={t}
                        onSelect={(e) => {
                          e.preventDefault();
                          setTiposPrestacionSel((prev) =>
                            prev.includes(t)
                              ? prev.filter((x) => x !== t)
                              : [...prev, t]
                          );
                        }}
                        className="flex items-center gap-2 capitalize"
                      >
                        <Check
                          className={`h-4 w-4 ${
                            selected ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {label}
                      </DropdownMenuItem>
                    );
                  })}
                {beneficiarioId &&
                  tiposPrestacionOpts.filter((t) =>
                    t
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .includes(tiposFilter.toLowerCase().trim())
                  ).length === 0 && (
                    <div className="px-2 py-6 text-sm text-muted-foreground">
                      No se encontraron resultados.
                    </div>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Estado</label>
            <Select
              value={estado}
              onValueChange={(v: "todos" | "pendiente" | "completada") => setEstado(v)}
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

          <div>
            <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fecha Fin</label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleGenerarReporte}
            disabled={isLoading || !beneficiarioId || !fechaInicio || !fechaFin}
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
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Prestador
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Monto
                  </th>
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
                      {p.prestador
                        ? `${p.prestador.apellido}, ${p.prestador.nombre}`
                        : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm">{p.estado}</td>
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
