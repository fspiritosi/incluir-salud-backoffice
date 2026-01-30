"use server";

import { createClient } from "@/lib/supabase/server";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

const escapeIlikeValue = (value: string) => value.replace(/[%_\\]/g, (match) => `\\${match}`);

const normalizeStringArray = (values: string[] = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const sanitizeActivo = (value: string | undefined): "todos" | "si" | "no" => {
  if (value === "si" || value === "no") return value;
  return "todos";
};

const parseDateInput = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDayIso = (date: Date) => {
  const clone = new Date(date);
  clone.setUTCHours(0, 0, 0, 0);
  return clone.toISOString();
};

const endOfDayIso = (date: Date) => {
  const clone = new Date(date);
  clone.setUTCHours(23, 59, 59, 999);
  return clone.toISOString();
};

const resolveDateRange = (fechaDesde?: string, fechaHasta?: string) => {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setMonth(defaultStart.getMonth() - 2);

  let startDate = parseDateInput(fechaDesde) ?? defaultStart;
  let endDate = parseDateInput(fechaHasta) ?? today;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  return {
    start: startOfDayIso(startDate),
    end: endOfDayIso(endDate),
  };
};

export type TransportePrestacionFilters = {
  search?: string;
  ids?: string[];
  ciudades?: string[];
  activo?: "todos" | "si" | "no";
  fechaDesde?: string;
  fechaHasta?: string;
};

export type ListTransportePrestacionesParams = TransportePrestacionFilters & {
  page?: number;
  pageSize?: number;
};

export type TransportePrestacionListItem = {
  id: string;
  fecha: string;
  estado: string | null;
  monto: number | null;
  cronico: boolean | null;
  sentido_transporte: string | null;
  paciente_id: string | null;
  user_id: string | null;
  centro_id: string | null;
  paciente: {
    id: string;
    nombre: string;
    apellido: string;
    documento: string | null;
    ciudad: string | null;
    provincia: string | null;
    activo: boolean | null;
  } | null;
  prestador: {
    id: string;
    nombre: string;
    apellido: string;
    documento: string | null;
  } | null;
  centro: {
    id: string;
    nombre: string | null;
    ciudad: string | null;
    provincia: string | null;
  } | null;
};

export async function listTransportePrestaciones(params: ListTransportePrestacionesParams = {}) {
  const supabase = await createClient();

  const page = Math.max(DEFAULT_PAGE, Number(params.page) || DEFAULT_PAGE);
  const rawPageSize = Number(params.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, rawPageSize), MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const filters = {
    search: params.search?.trim() ?? "",
    ids: normalizeStringArray(params.ids),
    ciudades: normalizeStringArray(params.ciudades),
    activo: sanitizeActivo(params.activo),
    fechaDesde: params.fechaDesde?.trim() ?? "",
    fechaHasta: params.fechaHasta?.trim() ?? "",
  };

  let pacientesFilterIds: string[] | null = null;

  if (filters.ids.length > 0) {
    pacientesFilterIds = filters.ids;
  } else {
    const needsPacienteFiltering = Boolean(
      filters.search || filters.ciudades.length > 0 || filters.activo !== "todos"
    );

    if (needsPacienteFiltering) {
      let pacientesQuery = supabase.from("pacientes").select("id", { count: "exact" });

      if (filters.search) {
        const sanitized = escapeIlikeValue(filters.search);
        const term = `%${sanitized}%`;
        pacientesQuery = pacientesQuery.or(
          `nombre.ilike.${term},apellido.ilike.${term},documento.ilike.${term}`
        );
      }

      if (filters.ciudades.length > 0) {
        pacientesQuery = pacientesQuery.in("ciudad", filters.ciudades);
      }

      if (filters.activo === "si") {
        pacientesQuery = pacientesQuery.eq("activo", true);
      } else if (filters.activo === "no") {
        pacientesQuery = pacientesQuery.eq("activo", false);
      }

      const { data: pacientesRows, error: pacientesError } = await pacientesQuery;
      if (pacientesError) {
        return { data: [] as TransportePrestacionListItem[], total: 0, error: pacientesError };
      }

      pacientesFilterIds = (pacientesRows || []).map((row) => row.id);

      if (!pacientesFilterIds.length) {
        return { data: [] as TransportePrestacionListItem[], total: 0, error: null };
      }
    }
  }

  const { start: rangeStartIso, end: rangeEndIso } = resolveDateRange(
    filters.fechaDesde,
    filters.fechaHasta
  );

  let prestacionesQuery = supabase
    .from("prestaciones")
    .select(
      "id, fecha, estado, monto, cronico, sentido_transporte, paciente_id, user_id, centro_id",
      { count: "exact" }
    )
    .eq("tipo_prestacion", "Transporte")
    .gte("fecha", rangeStartIso)
    .lte("fecha", rangeEndIso)
    .order("fecha", { ascending: false });

  if (pacientesFilterIds && pacientesFilterIds.length > 0) {
    prestacionesQuery = prestacionesQuery.in("paciente_id", pacientesFilterIds);
  }

  const { data: prestaciones, error, count } = await prestacionesQuery.range(from, to);

  if (error) {
    return { data: [] as TransportePrestacionListItem[], total: 0, error };
  }

  const rows = prestaciones || [];

  const pacienteIds = Array.from(new Set(rows.map((row) => row.paciente_id).filter(Boolean))) as string[];
  const prestadorIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))) as string[];
  const centroIds = Array.from(new Set(rows.map((row) => row.centro_id).filter(Boolean))) as string[];

  const [pacientesRes, prestadoresRes, centrosRes] = await Promise.all([
    pacienteIds.length
      ? supabase
          .from("pacientes")
          .select("id, nombre, apellido, documento, ciudad, provincia, activo")
          .in("id", pacienteIds)
      : Promise.resolve({ data: [] as any[] }),
    prestadorIds.length
      ? supabase
          .from("profiles")
          .select("id, nombre, apellido, documento")
          .in("id", prestadorIds)
      : Promise.resolve({ data: [] as any[] }),
    centroIds.length
      ? supabase
          .from("centros")
          .select("id, nombre, ciudad, provincia")
          .in("id", centroIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const pacientesMap = new Map((pacientesRes.data || []).map((row: any) => [row.id, row]));
  const prestadoresMap = new Map((prestadoresRes.data || []).map((row: any) => [row.id, row]));
  const centrosMap = new Map((centrosRes.data || []).map((row: any) => [row.id, row]));

  const enriched: TransportePrestacionListItem[] = rows.map((row) => ({
    ...row,
    paciente: row.paciente_id ? pacientesMap.get(row.paciente_id) || null : null,
    prestador: row.user_id ? prestadoresMap.get(row.user_id) || null : null,
    centro: row.centro_id ? centrosMap.get(row.centro_id) || null : null,
  }));

  return {
    data: enriched,
    total: count ?? enriched.length,
    error: null,
  };
}
