"use client";

import { useState, useMemo } from "react";
import { Search, Check, X, Filter } from "lucide-react";
import { togglePrestadorActivo } from "../actions";
import { useRouter } from "next/navigation";
import { useBackofficeRoles } from "@/hooks/useBackofficeRoles";
import { canTogglePrestador } from "@/utils/permissions";

type Prestador = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean | null;
  created_at: string;
};

export default function PrestadoresTable({ prestadores }: { prestadores: Prestador[] }) {
  const router = useRouter();
  const { roles, loading } = useBackofficeRoles();
  const canToggle = canTogglePrestador(roles);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActivo, setFilterActivo] = useState<"todos" | "activos" | "inactivos">("todos");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const handleToggleActivo = async (id: string, currentActivo: boolean | null) => {
    setIsUpdating(id);
    try {
      await togglePrestadorActivo(id, !currentActivo);
      router.refresh();
    } catch (error) {
      console.error("Error al actualizar prestador:", error);
      alert("Error al actualizar el prestador");
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredPrestadores = useMemo(() => {
    return prestadores.filter((prestador) => {
      // Filtro de búsqueda
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        prestador.nombre?.toLowerCase().includes(searchLower) ||
        prestador.apellido?.toLowerCase().includes(searchLower) ||
        prestador.documento?.toLowerCase().includes(searchLower) ||
        prestador.email?.toLowerCase().includes(searchLower) ||
        prestador.telefono?.toLowerCase().includes(searchLower);

      // Filtro de estado
      const matchesActivo =
        filterActivo === "todos" ||
        (filterActivo === "activos" && prestador.activo) ||
        (filterActivo === "inactivos" && !prestador.activo);

      return matchesSearch && matchesActivo;
    });
  }, [prestadores, searchTerm, filterActivo]);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Barra de filtros */}
      <div className="p-4 border-b border-gray-200 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido, documento, email o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro de estado */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterActivo}
              onChange={(e) => setFilterActivo(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="text-sm text-gray-600">
          Mostrando {filteredPrestadores.length} de {prestadores.length} prestadores
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Apellido
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teléfono
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPrestadores.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No se encontraron prestadores
                </td>
              </tr>
            ) : (
              filteredPrestadores.map((prestador) => (
                <tr key={prestador.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {prestador.apellido}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prestador.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {prestador.documento || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {prestador.email || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {prestador.telefono || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {prestador.activo ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Check className="w-3 h-3 mr-1" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <X className="w-3 h-3 mr-1" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleToggleActivo(prestador.id, prestador.activo)}
                      disabled={isUpdating === prestador.id || !canToggle || loading}
                      title={!canToggle && !loading ? "No tenés permiso para habilitar/deshabilitar prestadores" : undefined}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        prestador.activo
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isUpdating === prestador.id
                        ? "Actualizando..."
                        : prestador.activo
                        ? "Deshabilitar"
                        : "Habilitar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
