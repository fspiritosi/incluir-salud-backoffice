import * as z from "zod";

export const centroFormSchema = z.object({
  nombre: z.string().min(2, "El nombre es requerido"),
  tipo: z.enum(["geriatrico", "escuela", "centro medico", "otro"]),
  direccion_completa: z.string().min(5, "La dirección es requerida"),
  ciudad: z.string().optional(),
  codigo_postal: z.string().optional(),
  provincia: z.string().optional(),
  radio_metros: z.coerce.number().int().min(1, "El radio debe ser mayor a 0"),
  activo: z.boolean(),
  ubicacion: z
    .object({
      lng: z.number(),
      lat: z.number(),
    })
    .nullable()
    .refine((val) => val !== null, { message: "Ubicación requerida" }),
});

export type CentroFormValues = z.infer<typeof centroFormSchema>;
