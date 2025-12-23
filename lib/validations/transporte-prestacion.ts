import { z } from "zod";

const sentidoValues = ["ida", "vuelta", "ida_y_vuelta"] as const;

export const transportePrestacionSchema = z
  .object({
    paciente_id: z.string().uuid({ message: "Paciente requerido" }),
    user_id: z.string().uuid({ message: "Transportista requerido" }),
    centro_id: z.string().uuid({ message: "Centro requerido" }),
    sentido: z.enum(sentidoValues, { message: "Sentido requerido" }),
    fecha: z.string().min(1, "Fecha requerida"),
    cronico: z.boolean().optional(),
    monto: z
      .union([z.string().transform((v) => (v === "" ? undefined : Number(v))), z.number()])
      .optional()
      .refine((v) => v === undefined || !isNaN(v), { message: "Monto inválido" }),
    descripcion: z.string().optional(),
    notas: z.string().optional(),
  });

export const transportePrestacionFormSchema = transportePrestacionSchema.extend({
  fecha: z.string().optional(),
});

export type TransportePrestacionInput = z.input<typeof transportePrestacionSchema>;
export type TransportePrestacionFormValues = z.input<typeof transportePrestacionFormSchema>;

const transportePrestacionCommonSchema = transportePrestacionSchema.omit({
  fecha: true,
});

export const transportePrestacionBulkSchema = z.object({
  common: transportePrestacionCommonSchema,
  fechas: z.array(z.string()).min(1, "No hay fechas"),
});

export const transportePrestacionRequestSchema = z.union([
  transportePrestacionSchema,
  transportePrestacionBulkSchema,
]);
