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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { ChevronDown } from 'lucide-react';

type PrestacionFormProps = {
  initialData?: any;
  isEditing?: boolean;
  pacientes: { id: string; nombre: string; apellido: string; documento?: string }[];
  obrasSociales: { id: string; nombre: string }[];
  prestadores: { id: string; apellido: string; nombre: string; documento?: string }[];
};

export function PrestacionForm({ initialData, isEditing = false, pacientes, obrasSociales, prestadores }: PrestacionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [fPaciente, setFPaciente] = useState('');
  const [fObra, setFObra] = useState('');
  const [fPrestador, setFPrestador] = useState('');

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkModeType, setBulkModeType] = useState<'cada-n' | 'dias-semana' | 'fechas-custom'>('cada-n');
  const [bulkStart, setBulkStart] = useState<string>('');
  const [bulkEnd, setBulkEnd] = useState<string>('');
  const [bulkHour, setBulkHour] = useState<string>('');
  const [bulkIntervalDays, setBulkIntervalDays] = useState<number>(2);
  const [bulkCount, setBulkCount] = useState<number>(10);
  const [bulkWeekdays, setBulkWeekdays] = useState<{[k:string]: boolean}>({
    lun: true, mar: false, mie: true, jue: false, vie: true, sab: false, dom: false,
  });
  const [customDatesInput, setCustomDatesInput] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>('');
  const [customTime, setCustomTime] = useState<string>('');
  const [generatedDates, setGeneratedDates] = useState<string[]>([]);

  function toISO(dtLocal: string) {
    try { return new Date(dtLocal).toISOString(); } catch { return ''; }
  }

  function generateDates() {
    const out: string[] = [];
    if (bulkModeType === 'cada-n') {
      if (!bulkStart || bulkIntervalDays <= 0 || bulkCount <= 0) return setGeneratedDates([]);
      let cur = new Date(bulkStart);
      for (let i = 0; i < Math.min(bulkCount, 60); i++) {
        out.push(cur.toISOString());
        cur = new Date(cur.getTime() + bulkIntervalDays * 24 * 60 * 60 * 1000);
      }
    } else if (bulkModeType === 'dias-semana') {
      if (!bulkStart || !bulkEnd || !bulkHour) return setGeneratedDates([]);
      const start = new Date(bulkStart);
      const end = new Date(bulkEnd);
      if (end < start) return setGeneratedDates([]);
      const chosen = new Set<number>();
      if (bulkWeekdays.dom) chosen.add(0);
      if (bulkWeekdays.lun) chosen.add(1);
      if (bulkWeekdays.mar) chosen.add(2);
      if (bulkWeekdays.mie) chosen.add(3);
      if (bulkWeekdays.jue) chosen.add(4);
      if (bulkWeekdays.vie) chosen.add(5);
      if (bulkWeekdays.sab) chosen.add(6);
      const [hh, mm] = bulkHour.split(':').map(Number);
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 24*60*60*1000)) {
        if (chosen.has(d.getDay())) {
          const dt = new Date(d);
          dt.setHours(hh || 0, mm || 0, 0, 0);
          out.push(dt.toISOString());
          if (out.length >= 60) break;
        }
      }
    } else if (bulkModeType === 'fechas-custom') {
      const out = [...generatedDates];
      setGeneratedDates(out);
    }
    setGeneratedDates(out);
    if (out[0]) {
      form.setValue('fecha', new Date(out[0]).toISOString().slice(0,16));
    }
  }

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

      if (bulkMode) {
        if (generatedDates.length === 0) {
          throw new Error('No se generaron fechas. Genera las fechas antes de guardar.');
        }
        if (!values.user_id) throw new Error('Seleccioná un prestador.');
        if (!values.paciente_id) throw new Error('Seleccioná un paciente.');
        const common = {
          ...values,
          user_id: values.user_id,
          paciente_id: values.paciente_id,
          obra_social_id: values.obra_social_id ? values.obra_social_id : null,
          fecha: undefined as any,
          monto: values.monto == null ? null : Number(values.monto),
        };
        const res = await fetch('/api/prestaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ common, fechas: generatedDates }),
        });
        if (!res.ok) {
          const t = await res.json().catch(() => ({} as any));
          throw new Error(t?.error || t?.message || `Error guardando prestaciones (${res.status})`);
        }
        toast({ title: 'Prestaciones creadas', description: `Se crearon ${generatedDates.length} prestaciones.` });
      } else {
        if (!values.user_id) throw new Error('Seleccioná un prestador.');
        if (!values.paciente_id) throw new Error('Seleccioná un paciente.');
        const payload = {
          ...values,
          user_id: values.user_id,
          paciente_id: values.paciente_id,
          obra_social_id: values.obra_social_id ? values.obra_social_id : null,
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
          const t = await res.json().catch(() => ({} as any));
          throw new Error(t?.error || t?.message || `Error guardando prestación (${res.status})`);
        }
        toast({ title: isEditing ? 'Prestación actualizada' : 'Prestación creada' });
      }

      router.push('/protected/prestaciones');
      router.refresh();
    } catch (err: any) {
      toast({ title: 'No se pudo guardar', description: err?.message || 'Intentalo nuevamente', variant: 'destructive' });
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
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    disabled={loading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Acompañante Terapeutico">Acompañante Terapeutico</SelectItem>
                      <SelectItem value="Kinesiología">Kinesiología</SelectItem>
                    </SelectContent>
                  </Select>
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

          {isEditing && (
            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value || 'pendiente'}
                      onValueChange={field.onChange}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">pendiente</SelectItem>
                        <SelectItem value="completada">completada</SelectItem>
                        <SelectItem value="cancelada">cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

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
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      className="w-full justify-between h-10 rounded-md border border-input bg-background px-3 text-sm font-normal hover:bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={field.value ? '' : 'text-muted-foreground'}>
                        {obrasSociales.find(o => o.id === field.value)?.nombre || 'Seleccionar obra social'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-72 p-2">
                    <Input
                      placeholder="Buscar obra social"
                      value={fObra}
                      onChange={(e) => setFObra(e.target.value)}
                      className="mb-2"
                    />
                    <DropdownMenuItem onClick={() => field.onChange('')}>Sin obra social</DropdownMenuItem>
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
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      className="w-full justify-between h-10 rounded-md border border-input bg-background px-3 text-sm font-normal hover:bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={field.value ? '' : 'text-muted-foreground'}>{(() => {
                        const p = pacientes.find(p => p.id === field.value);
                        return p ? `${p.apellido}, ${p.nombre}` : 'Seleccionar paciente';
                      })()}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 p-2">
                    <Input
                      placeholder="Buscar paciente (Nombre Apellido o DNI)"
                      value={fPaciente}
                      onChange={(e) => setFPaciente(e.target.value)}
                      className="mb-2"
                    />
                    {pacientes
                      .filter(p => {
                        const full = `${p.apellido} ${p.nombre}`.toLowerCase();
                        const docRaw = (p.documento || '');
                        const doc = docRaw.toLowerCase();
                        const docDigits = docRaw.replace(/\D/g, '');
                        const q = fPaciente.toLowerCase().trim();
                        const qDigits = q.replace(/\D/g, '');
                        return (
                          full.includes(q) ||
                          doc.includes(q) ||
                          (!!qDigits && docDigits.includes(qDigits))
                        );
                      })
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
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      className="w-full justify-between h-10 rounded-md border border-input bg-background px-3 text-sm font-normal hover:bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={field.value ? '' : 'text-muted-foreground'}>{(() => {
                        const pr = prestadores.find(p => p.id === field.value);
                        return pr ? `${pr.nombre} ${pr.apellido}${pr.documento ? ' - DNI ' + pr.documento : ''}` : 'Seleccionar prestador';
                      })()}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
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

        {!isEditing && (
          <div className="rounded-md border p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Switch id="bulkMode" checked={bulkMode} onCheckedChange={setBulkMode} disabled={loading} />
              <label htmlFor="bulkMode" className="font-medium">Crear múltiples prestaciones</label>
            </div>

            {bulkMode && (
              <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium">Modo</label>
                <Select
                  value={bulkModeType}
                  onValueChange={(value: 'cada-n' | 'dias-semana' | 'fechas-custom') => setBulkModeType(value)}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cada-n">Cada N días</SelectItem>
                    <SelectItem value="dias-semana">Días de la semana</SelectItem>
                    <SelectItem value="fechas-custom">Fechas personalizadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bulkModeType === 'cada-n' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">Fecha de inicio</label>
                    <Input type="datetime-local" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} disabled={loading} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Intervalo (días)</label>
                    <Input type="number" min={1} value={bulkIntervalDays} onChange={(e) => setBulkIntervalDays(Number(e.target.value))} disabled={loading} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Cantidad</label>
                    <Input type="number" min={1} max={60} value={bulkCount} onChange={(e) => setBulkCount(Number(e.target.value))} disabled={loading} />
                  </div>
                </div>
              )}

              {bulkModeType === 'dias-semana' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium">Fecha inicio</label>
                      <Input type="date" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} disabled={loading} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Fecha fin</label>
                      <Input type="date" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} disabled={loading} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Hora</label>
                      <Input type="time" value={bulkHour} onChange={(e) => setBulkHour(e.target.value)} disabled={loading} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 items-center">
                    {[
                      ['lun','Lun'],['mar','Mar'],['mie','Mié'],['jue','Jue'],['vie','Vie'],['sab','Sáb'],['dom','Dom']
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={Boolean(bulkWeekdays[key as keyof typeof bulkWeekdays])}
                          onCheckedChange={(checked) => setBulkWeekdays(prev => ({ ...prev, [key]: Boolean(checked) }))}
                          disabled={loading}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {bulkModeType === 'fechas-custom' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium">Fecha</label>
                      <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} disabled={loading} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Hora</label>
                      <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} disabled={loading} />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={() => {
                          if (!customDate || !customTime) return;
                          const dt = new Date(`${customDate}T${customTime}`);
                          const iso = dt.toISOString();
                          setGeneratedDates((prev) => {
                            const next = Array.from(new Set([...prev, iso])).slice(0, 60);
                            return next.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                          });
                          if (!form.getValues('fecha')) {
                            form.setValue('fecha', `${customDate}T${customTime}`);
                          }
                        }}
                        disabled={loading}
                      >
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={generateDates} disabled={loading}>Generar fechas</Button>
                <span className="text-sm text-muted-foreground">Máximo 60</span>
              </div>

              {generatedDates.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Preview ({generatedDates.length})</div>
                  <div className="max-h-48 overflow-auto border rounded">
                    <ul className="divide-y text-sm">
                      {generatedDates.map((d, i) => (
                        <li key={i} className="flex items-center justify-between px-3 py-2">
                          <span>{new Date(d).toLocaleString()}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setGeneratedDates(prev => prev.filter((_, idx) => idx !== i))} disabled={loading}>Quitar</Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              </div>
            )}
          </div>
        )}

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
