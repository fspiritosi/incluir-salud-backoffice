// components/forms/beneficiario-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BeneficiarioFormValues,
  beneficiarioFormSchema,
} from "@/lib/validations/beneficiario";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useEffect, useState, useMemo } from "react";
import { MapboxLocationPicker } from "@/components/map/MapboxLocationPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProvinces, getCitiesByProvince, type Province, type City } from "@/app/protected/beneficiarios/actions";

interface BeneficiarioFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export function BeneficiarioForm({
  initialData,
  isEditing = false,
}: BeneficiarioFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [addrVersion, setAddrVersion] = useState(0);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);

  const toLngLat = (val: any): { lng: number; lat: number } | null => {
    console.log("toLngLat input:", val, "Type:", typeof val);

    if (!val) {
      console.log("toLngLat: null/undefined input");
      return null;
    }

    // Already in shape {lng, lat}
    if (typeof val.lng !== "undefined" && typeof val.lat !== "undefined") {
      const lng = Number(val.lng);
      const lat = Number(val.lat);
      console.log("toLngLat: Found lng/lat format:", { lng, lat });
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }

    // GeoJSON Point {type: "Point", coordinates:[lng,lat]}
    if (
      val.type === "Point" &&
      Array.isArray(val.coordinates) &&
      val.coordinates.length >= 2
    ) {
      const lng = Number(val.coordinates[0]);
      const lat = Number(val.coordinates[1]);
      console.log("toLngLat: Found GeoJSON Point:", { lng, lat });
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }

    // GeoJSON {coordinates:[lng,lat]} (without type)
    if (Array.isArray(val.coordinates) && val.coordinates.length >= 2) {
      const lng = Number(val.coordinates[0]);
      const lat = Number(val.coordinates[1]);
      console.log("toLngLat: Found coordinates array:", { lng, lat });
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }

    // Raw array [lng,lat]
    if (Array.isArray(val) && val.length >= 2) {
      const lng = Number(val[0]);
      const lat = Number(val[1]);
      console.log("toLngLat: Found raw array:", { lng, lat });
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }

    // { x: lng, y: lat }
    if (typeof val.x !== "undefined" && typeof val.y !== "undefined") {
      const lng = Number(val.x);
      const lat = Number(val.y);
      console.log("toLngLat: Found x/y format:", { lng, lat });
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }

    // EWKT/WKT string: "SRID=4326;POINT(lng lat)" or "POINT(lng lat)"
    if (typeof val === "string") {
      const match = val.match(/POINT\s*\(([-\d\.]+)\s+([-\d\.]+)\)/i);
      if (match) {
        const lng = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        console.log("toLngLat: Parsed EWKT/WKT string:", { lng, lat });
        return Number.isFinite(lng) && Number.isFinite(lat)
          ? { lng, lat }
          : null;
      }
    }

    console.warn("toLngLat: Could not parse format:", val);
    return null;
  };

  const normalizedInitialData: Partial<BeneficiarioFormValues> | undefined =
    initialData
      ? {
          ...initialData,
          ubicacion: toLngLat(initialData.ubicacion),
        }
      : undefined;

  // Debug: inspect incoming location
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("BeneficiarioForm: initial ubicacion", initialData?.ubicacion);
    // eslint-disable-next-line no-console
    console.log(
      "BeneficiarioForm: normalized ubicacion",
      normalizedInitialData?.ubicacion
    );
  }

  const hasExistingLocation = isEditing && !!normalizedInitialData?.ubicacion;

  const form = useForm<BeneficiarioFormValues>({
    resolver: zodResolver(beneficiarioFormSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      documento: "",
      telefono: "",
      email: "",
      direccion_completa: "",
      ciudad: "",
      provincia: "",
      codigo_postal: "",
      activo: true,
      ubicacion: null,
      ...(normalizedInitialData ?? {}),
    },
  });

  // Load provinces on mount and preselect based on initial value
  useEffect(() => {
    (async () => {
      setLoadingProvinces(true);
      const { data: provs } = await getProvinces();
      setProvinces(provs || []);
      setLoadingProvinces(false);
      // If there's an initial provincia name, map to id and load cities
      const provName = form.getValues("provincia");
      if (provName) {
        const match = (provs || []).find((p) => p.name.toLowerCase() === provName.toLowerCase());
        if (match) {
          setSelectedProvinceId(match.id);
          setLoadingCities(true);
          const { data: c } = await getCitiesByProvince(match.id);
          setCities(c || []);
          setLoadingCities(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When selectedProvinceId changes, fetch cities
  useEffect(() => {
    if (!selectedProvinceId) return;
    (async () => {
      setLoadingCities(true);
      const { data } = await getCitiesByProvince(selectedProvinceId);
      setCities(data || []);
      setLoadingCities(false);
    })();
  }, [selectedProvinceId]);

  // Track if address fields have been modified from initial values
  const addressFieldsModified = useMemo(() => {
    if (!isEditing || !initialData) return true; // Always geocode when creating

    const currentDir = form.watch("direccion_completa") || "";
    const currentCity = form.watch("ciudad") || "";
    const currentProv = form.watch("provincia") || "";
    const currentCP = form.watch("codigo_postal") || "";

    const initialDir = initialData.direccion_completa || "";
    const initialCity = initialData.ciudad || "";
    const initialProv = initialData.provincia || "";
    const initialCP = initialData.codigo_postal || "";

    return (
      currentDir !== initialDir ||
      currentCity !== initialCity ||
      currentProv !== initialProv ||
      currentCP !== initialCP
    );
  }, [
    isEditing,
    initialData,
    form.watch("direccion_completa"),
    form.watch("ciudad"),
    form.watch("provincia"),
    form.watch("codigo_postal"),
  ]);

  useEffect(() => {
    // Only increment version if fields are modified (to trigger geocoding)
    if (!addressFieldsModified) return;

    const dir = (form.getValues("direccion_completa") || "").trim();
    const city = (form.getValues("ciudad") || "").trim();
    const prov = (form.getValues("provincia") || "").trim();
    const cp = (form.getValues("codigo_postal") || "").trim();
    if (dir && city && prov && cp) {
      setAddrVersion((v) => v + 1);
    }
  }, [
    addressFieldsModified,
    form.watch("direccion_completa"),
    form.watch("ciudad"),
    form.watch("provincia"),
    form.watch("codigo_postal"),
  ]);

  const onSubmit = async (values: BeneficiarioFormValues) => {
    try {
      setLoading(true);
      console.log("=== Guardando beneficiario ===");
      console.log("Valores del formulario:", values);
      console.log("Ubicación a guardar:", values.ubicacion);

      let res: Response;
      const editId = isEditing ? initialData?.id : null;

      if (isEditing) {
        if (!editId) {
          // eslint-disable-next-line no-console
          console.error(
            "Edit submit without valid id. initialData:",
            initialData
          );
          throw new Error("ID de paciente no válido para actualizar");
        }
        res = await fetch(`/api/beneficiarios/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error actualizando paciente");
        }
        toast({
          title: "¡Éxito!",
          description: "Paciente actualizado correctamente",
        });
      } else {
        res = await fetch("/api/beneficiarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error creando paciente");
        }
        toast({
          title: "¡Éxito!",
          description: "Paciente creado correctamente",
        });
      }

      router.push("/protected/beneficiarios");
      router.refresh();
    } catch (error) {
      console.error("Error al guardar paciente:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el paciente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre" {...field} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Repite para los demás campos */}
          <FormField
            control={form.control}
            name="apellido"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido *</FormLabel>
                <FormControl>
                  <Input placeholder="Apellido" {...field} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="documento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Documento *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Documento"
                    {...field}
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefono *</FormLabel>
                <FormControl>
                  <Input placeholder="Telefono" {...field} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input placeholder="Email" {...field} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="direccion_completa"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección Completa *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Dirección Completa"
                    {...field}
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="provincia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provincia</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || ""}
                    onValueChange={(val) => {
                      field.onChange(val);
                      // Find province id
                      const match = provinces.find((p) => p.name === val) || null;
                      setSelectedProvinceId(match ? match.id : null);
                      // Clear city when province changes
                      form.setValue('ciudad', "");
                    }}
                    disabled={loading || loadingProvinces}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={loadingProvinces ? "Cargando..." : "Seleccionar provincia"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[360px] overflow-y-auto">
                      {provinces.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ciudad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ciudad</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || ""}
                    onValueChange={(val) => field.onChange(val)}
                    disabled={loading || !selectedProvinceId || loadingCities}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={loadingCities ? "Cargando..." : !selectedProvinceId ? "Seleccioná provincia primero" : "Seleccionar ciudad"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[360px] overflow-y-auto">
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />


          <FormField
            control={form.control}
            name="codigo_postal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código Postal</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Código Postal"
                    {...field}
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="activo"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Activo</FormLabel>
                  <FormDescription>
                    El paciente estará habilitado en el sistema
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={loading}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ubicacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ubicación en el Mapa *</FormLabel>
                <FormControl>
                  <MapboxLocationPicker
                    initialLocation={
                      normalizedInitialData?.ubicacion
                        ? (normalizedInitialData.ubicacion as any)
                        : toLngLat(field.value)
                    }
                    onLocationSelect={field.onChange}
                    address={
                      [
                        form.watch("direccion_completa"),
                        form.watch("ciudad"),
                        form.watch("provincia"),
                        form.watch("codigo_postal"),
                        "Argentina",
                      ]
                        .filter(Boolean)
                        .join(", ")
                    }
                    geocodeVersion={
                      addressFieldsModified ? addrVersion : undefined
                    }
                    preferredCity={form.watch("ciudad") || undefined}
                    preferredPostcode={form.watch("codigo_postal") || undefined}
                    preferredRegion={form.watch("provincia") || "Mendoza"}
                    disableAutoGeocode={!addressFieldsModified}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/protected/beneficiarios")}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
