// components/forms/beneficiario-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BeneficiarioFormValues, beneficiarioFormSchema } from '@/lib/validations/beneficiario';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/components/ui/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useEffect, useState } from 'react';
import { MapboxLocationPicker } from '@/components/map/MapboxLocationPicker';
interface BeneficiarioFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export function BeneficiarioForm({ initialData, isEditing = false }: BeneficiarioFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const normalizedInitialData: Partial<BeneficiarioFormValues> | undefined = initialData
    ? {
        ...initialData,
        ubicacion: initialData.ubicacion && initialData.ubicacion.coordinates
          ? { lng: initialData.ubicacion.coordinates[0], lat: initialData.ubicacion.coordinates[1] }
          : initialData.ubicacion ?? null,
      }
    : undefined;

  const form = useForm<BeneficiarioFormValues>({
    resolver: zodResolver(beneficiarioFormSchema),
    defaultValues: {
      nombre: '',
      apellido: '',
      documento: '',
      telefono: '',
      email: '',
      direccion_completa: '',
      ciudad: '',
      provincia: '',
      codigo_postal: '',
      activo: true,
      ubicacion: null,
      ...(normalizedInitialData ?? {}),
    },
  });

  const onSubmit = async (values: BeneficiarioFormValues) => {
    try {
      setLoading(true);
      const pacienteData = {
        ...values,
        ubicacion: values.ubicacion
          ? `SRID=4326;POINT(${values.ubicacion.lng} ${values.ubicacion.lat})`
          : null,
      };

      if (isEditing && initialData?.id) {
        const { error } = await supabase
          .from('pacientes')
          .update(pacienteData)
          .eq('id', initialData.id);

        if (error) throw error;
        toast({ title: '¡Éxito!', description: 'Paciente actualizado correctamente' });
      } else {
        const { error } = await supabase
          .from('pacientes')
          .insert([pacienteData]);

        if (error) throw error;
        toast({ title: '¡Éxito!', description: 'Paciente creado correctamente' });
      }

      router.push('/beneficiarios');
      router.refresh();
    } catch (error) {
      console.error('Error al guardar paciente:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el paciente',
        variant: 'destructive',
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
                  <Input placeholder="Documento" {...field} disabled={loading} />
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
                  <Input placeholder="Dirección Completa" {...field} disabled={loading} />
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
        <Input placeholder="Ciudad" {...field} disabled={loading} />
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
        <Input placeholder="Provincia" {...field} disabled={loading} />
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
              field.value
                ? (typeof (field.value as any).lng === 'number'
                    ? (field.value as any)
                    : (field.value as any).coordinates
                      ? { lng: (field.value as any).coordinates[0], lat: (field.value as any).coordinates[1] }
                      : null)
                : null
            }
            onLocationSelect={field.onChange}
            address={[
              form.watch('direccion_completa'),
              form.watch('ciudad'),
              form.watch('provincia'),
              form.watch('codigo_postal'),
              'Argentina',
            ].filter(Boolean).join(', ')}
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
            onClick={() => router.push('/beneficiarios')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Form>
  );
}