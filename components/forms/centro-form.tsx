"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapboxLocationPicker } from "@/components/map/MapboxLocationPicker";
import { CentroFormValues, centroFormSchema } from "@/lib/validations/centro";
import { getCitiesByProvince, getProvinces, type City, type Province } from "@/app/protected/beneficiarios/actions";

type Props = {
  initialData?: any;
  isEditing?: boolean;
};

export function CentroForm({ initialData, isEditing = false }: Props) {
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
    if (!val) return null;
    if (typeof val.lng !== "undefined" && typeof val.lat !== "undefined") {
      const lng = Number(val.lng);
      const lat = Number(val.lat);
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }
    if (val.type === "Point" && Array.isArray(val.coordinates) && val.coordinates.length >= 2) {
      const lng = Number(val.coordinates[0]);
      const lat = Number(val.coordinates[1]);
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }
    if (Array.isArray(val.coordinates) && val.coordinates.length >= 2) {
      const lng = Number(val.coordinates[0]);
      const lat = Number(val.coordinates[1]);
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }
    if (Array.isArray(val) && val.length >= 2) {
      const lng = Number(val[0]);
      const lat = Number(val[1]);
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }
    if (typeof val.x !== "undefined" && typeof val.y !== "undefined") {
      const lng = Number(val.x);
      const lat = Number(val.y);
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    }
    if (typeof val === "string") {
      const match = val.match(/POINT\s*\(([-\d\.]+)\s+([-\d\.]+)\)/i);
      if (match) {
        const lng = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
      }
    }
    return null;
  };

  const normalizedInitialData: Partial<CentroFormValues> | undefined = initialData
    ? {
        ...initialData,
        ubicacion: toLngLat(initialData.ubicacion),
      }
    : undefined;

  const form = useForm<CentroFormValues>({
    resolver: zodResolver(centroFormSchema),
    defaultValues: {
      nombre: "",
      tipo: "otro",
      direccion_completa: "",
      ciudad: "",
      provincia: "",
      codigo_postal: "",
      radio_metros: 50,
      activo: true,
      ubicacion: null,
      ...(normalizedInitialData ?? {}),
    },
  });

  useEffect(() => {
    (async () => {
      setLoadingProvinces(true);
      const { data: provs } = await getProvinces();
      setProvinces(provs || []);
      setLoadingProvinces(false);

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

  useEffect(() => {
    if (!selectedProvinceId) return;
    (async () => {
      setLoadingCities(true);
      const { data } = await getCitiesByProvince(selectedProvinceId);
      setCities(data || []);
      setLoadingCities(false);
    })();
  }, [selectedProvinceId]);

  const addressFieldsModified = useMemo(() => {
    if (!isEditing || !initialData) return true;

    const currentDir = form.watch("direccion_completa") || "";
    const currentCity = form.watch("ciudad") || "";
    const currentProv = form.watch("provincia") || "";
    const currentCP = form.watch("codigo_postal") || "";

    const initialDir = initialData.direccion_completa || "";
    const initialCity = initialData.ciudad || "";
    const initialProv = initialData.provincia || "";
    const initialCP = initialData.codigo_postal || "";

    return currentDir !== initialDir || currentCity !== initialCity || currentProv !== initialProv || currentCP !== initialCP;
  }, [
    isEditing,
    initialData,
    form.watch("direccion_completa"),
    form.watch("ciudad"),
    form.watch("provincia"),
    form.watch("codigo_postal"),
  ]);

  useEffect(() => {
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

  const onSubmit = async (values: CentroFormValues) => {
    try {
      setLoading(true);

      let res: Response;
      const editId = isEditing ? initialData?.id : null;

      if (isEditing) {
        if (!editId) {
          throw new Error("ID de centro no válido para actualizar");
        }
        res = await fetch(`/api/centros/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error actualizando centro");
        }
        toast({ title: "¡Éxito!", description: "Centro actualizado correctamente" });
      } else {
        res = await fetch("/api/centros", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error creando centro");
        }
        toast({ title: "¡Éxito!", description: "Centro creado correctamente" });
      }

      router.push("/protected/centros");
      router.refresh();
    } catch (error: any) {
      console.error("Error al guardar centro:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo guardar el centro",
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

          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo *</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geriatrico">Geriátrico</SelectItem>
                      <SelectItem value="escuela">Escuela</SelectItem>
                      <SelectItem value="centro medico">Centro médico</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Input placeholder="Dirección Completa" {...field} disabled={loading} />
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
                      const match = provinces.find((p) => p.name === val) || null;
                      setSelectedProvinceId(match ? match.id : null);
                      form.setValue("ciudad", "");
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
                      <SelectValue
                        placeholder={
                          loadingCities
                            ? "Cargando..."
                            : !selectedProvinceId
                              ? "Seleccioná provincia primero"
                              : "Seleccionar ciudad"
                        }
                      />
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
                  <Input placeholder="Código Postal" {...field} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="radio_metros"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Radio (metros) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="50" {...field} disabled={loading} />
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
                  <FormDescription>El centro estará habilitado en el sistema</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={loading} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ubicacion"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
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
                    geocodeVersion={addressFieldsModified ? addrVersion : undefined}
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
          <Button type="button" variant="outline" onClick={() => router.push("/protected/centros")} disabled={loading}>
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
