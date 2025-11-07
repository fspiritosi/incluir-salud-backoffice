import { z } from 'zod';

export const prestacionSchema = z.object({
  tipo_prestacion: z.string().min(1, 'Tipo requerido'),
  obra_social_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),
  fecha: z.string().min(1, 'Fecha requerida'),
  estado: z.string().optional(),
  monto: z.union([
    z.string().transform(v => v === '' ? undefined : Number(v)),
    z.number()
  ]).optional().refine(v => v === undefined || !isNaN(v), { message: 'Monto inválido' }),
  descripcion: z.string().optional(),
  notas: z.string().optional(),
  paciente_id: z.string().uuid({ message: 'Paciente requerido' }),
  user_id: z.string().uuid({ message: 'Prestador requerido' }),
});

export type PrestacionFormValues = z.input<typeof prestacionSchema>;
