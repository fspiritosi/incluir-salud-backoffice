"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  direccion_completa: string;
  ciudad: string | null;
  provincia: string | null;
  activo: boolean | null;
};

interface BeneficiariosTableProps {
  data: Paciente[];
}

export function BeneficiariosTable({ data }: BeneficiariosTableProps) {
  const [fNombre, setFNombre] = useState("");
  const [fApellido, setFApellido] = useState("");
  const [fDocumento, setFDocumento] = useState("");
  const [fCiudad, setFCiudad] = useState("");
  const [fProvincia, setFProvincia] = useState("");
  const [fActivo, setFActivo] = useState<"todos" | "si" | "no">("todos");

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const byNombre = row.nombre.toLowerCase().includes(fNombre.toLowerCase());
      const byApellido = row.apellido.toLowerCase().includes(fApellido.toLowerCase());
      const byDocumento = row.documento.toLowerCase().includes(fDocumento.toLowerCase());
      const byCiudad = (row.ciudad || "").toLowerCase().includes(fCiudad.toLowerCase());
      const byProvincia = (row.provincia || "").toLowerCase().includes(fProvincia.toLowerCase());
      const byActivo =
        fActivo === "todos" ? true : fActivo === "si" ? !!row.activo : !row.activo;
      return byNombre && byApellido && byDocumento && byCiudad && byProvincia && byActivo;
    });
  }, [data, fNombre, fApellido, fDocumento, fCiudad, fProvincia, fActivo]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <Input placeholder="Filtrar nombre" value={fNombre} onChange={(e) => setFNombre(e.target.value)} />
        <Input placeholder="Filtrar apellido" value={fApellido} onChange={(e) => setFApellido(e.target.value)} />
        <Input placeholder="Filtrar documento" value={fDocumento} onChange={(e) => setFDocumento(e.target.value)} />
        <Input placeholder="Filtrar ciudad" value={fCiudad} onChange={(e) => setFCiudad(e.target.value)} />
        <Input placeholder="Filtrar provincia" value={fProvincia} onChange={(e) => setFProvincia(e.target.value)} />
        <select
          className="border rounded px-3 py-2 text-sm"
          value={fActivo}
          onChange={(e) => setFActivo(e.target.value as any)}
        >
          <option value="todos">Activo (todos)</option>
          <option value="si">Sólo activos</option>
          <option value="no">Sólo inactivos</option>
        </select>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Apellido</th>
              <th className="text-left p-3">Documento</th>
              <th className="text-left p-3">Dirección</th>
              <th className="text-left p-3">Ciudad</th>
              <th className="text-left p-3">Provincia</th>
              <th className="text-left p-3">Activo</th>
              <th className="text-left p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">{row.nombre}</td>
                <td className="p-3">{row.apellido}</td>
                <td className="p-3">{row.documento}</td>
                <td className="p-3">{row.direccion_completa}</td>
                <td className="p-3">{row.ciudad}</td>
                <td className="p-3">{row.provincia}</td>
                <td className="p-3">{row.activo ? "Sí" : "No"}</td>
                <td className="p-3">
                  <Link href={`/protected/beneficiarios/editar/${row.id}`}>
                    <Button size="sm" variant="outline">Editar</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
