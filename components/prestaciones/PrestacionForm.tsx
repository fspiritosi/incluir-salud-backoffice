'use client';

import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { prestacionSchema, PrestacionFormValues } from '@/lib/validations/prestacion';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

type PrestacionFormProps = {
  initialData?: any;
  isEditing?: boolean;
  pacientes: { id: string; nombre: string; apellido: string }[];
  obrasSociales: { id: string; nombre: string }[];
  prestadores: { id: string; apellido: string; nombre: string; documento?: string }[];
};

export function PrestacionForm({ initialData, isEditing = false, pacientes, obrasSociales, prestadores }: PrestacionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fPaciente, setFPaciente] = useState('');
  const [fObra, setFObra] = useState('');
  const [fPrestador, setFPrestador] = useState('');

  const form = useForm<PrestacionFormValues>({
    resolver: zodResolver(prestacionSchema),
    defaultValues: {
      tipo_prestacion: initialData?.tipo_prestacion || '',
      obra_social_id: initialData?.obra_social_id || '',
      fecha: initialData?.fecha ? new Date(initialData.fecha).toISOString().slice(0,16) : '',
      estado: initialData?.estado || 'pendiente',
      monto: initialData?.monto ?? undefined,
      descripcion: initialData?.descripcion || '',
      notas: initialData?.notas || '',
      paciente_id: initialData?.paciente_id || '',
      user_id: initialData?.user_id || '',
    },
  });

  const onSubmit = async (values: PrestacionFormValues) => {
    try {
      setLoading(true);
      const payload = {
        ...values,
        fecha: values.fecha ? new Date(values.fecha).toISOString() : new Date().toISOString(),
        monto: values.monto == null ? null : Number(values.monto),
      };

      let res: Response;
      if (isEditing && initialData?.id) {
        res = await fetch(`/api/prestaciones/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/prestaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        throw new Error('Error guardando prestación');
      }

      router.push('/protected/prestaciones');
      router.refresh();
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
            name="tipo_prestacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Prestación *</FormLabel>
                <FormControl>
                  <Input placeholder="Tipo" {...field} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fecha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha *</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <FormControl>
                  <Input placeholder="pendiente | realizada | cancelada" {...field} value={field.value || ''} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="monto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value == null ? '' : String(field.value)} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="obra_social_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Obra Social</FormLabel>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" disabled={loading}>
                      {obrasSociales.find(o => o.id === field.value)?.nombre || 'Seleccionar obra social'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-72 p-2">
                    <Input
                      placeholder="Buscar obra social"
                      value={fObra}
                      onChange={(e) => setFObra(e.target.value)}
                      className="mb-2"
                    />
                    {obrasSociales
                      .filter(o => o.nombre.toLowerCase().includes(fObra.toLowerCase()))
                      .map((o) => (
                        <DropdownMenuItem
                          key={o.id}
                          onClick={() => {
                            field.onChange(o.id);
                          }}
                        >
                          {o.nombre}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paciente_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paciente</FormLabel>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" disabled={loading}>
                      {(() => {
                        const p = pacientes.find(p => p.id === field.value);
                        return p ? `${p.apellido}, ${p.nombre}` : 'Seleccionar paciente';
                      })()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-72 p-2">
                    <Input
                      placeholder="Buscar paciente"
                      value={fPaciente}
                      onChange={(e) => setFPaciente(e.target.value)}
                      className="mb-2"
                    />
                    {pacientes
                      .filter(p => (`${p.apellido} ${p.nombre}`).toLowerCase().includes(fPaciente.toLowerCase()))
                      .map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => {
                            field.onChange(p.id);
                          }}
                        >
                          {p.apellido}, {p.nombre}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="user_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prestador</FormLabel>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" disabled={loading}>
                      {(() => {
                        const pr = prestadores.find(p => p.id === field.value);
                        return pr ? `${pr.nombre} ${pr.apellido}${pr.documento ? ' - DNI ' + pr.documento : ''}` : 'Seleccionar prestador';
                      })()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 p-2">
                    <Input
                      placeholder="Buscar prestador (Nombre Apellido o DNI)"
                      value={fPrestador}
                      onChange={(e) => setFPrestador(e.target.value)}
                      className="mb-2"
                    />
                    {prestadores
                      .filter(p => {
                        const full = `${p.apellido} ${p.nombre}`.toLowerCase();
                        const doc = (p.documento || '').toLowerCase();
                        const q = fPrestador.toLowerCase();
                        return full.includes(q) || doc.includes(q);
                      })
                      .map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => {
                            field.onChange(p.id);
                          }}
                        >
                          {p.nombre} {p.apellido}{p.documento ? ` - DNI ${p.documento}` : ''}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="descripcion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <textarea rows={3} className="border rounded px-3 py-2 w-full" placeholder="Descripción" {...field} value={field.value || ''} disabled={loading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <textarea rows={3} className="border rounded px-3 py-2 w-full" placeholder="Notas" {...field} value={field.value || ''} disabled={loading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.push('/protected/prestaciones')} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear prestación'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
