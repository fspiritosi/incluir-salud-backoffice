// lib/validations/beneficiario.ts
import * as z from 'zod';

export const beneficiarioFormSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  apellido: z.string().min(2, 'El apellido es requerido'),
  documento: z.string().min(5, 'El documento es requerido'),
  telefono: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  direccion_completa: z.string().min(5, 'La dirección es requerida'),
  ciudad: z.string().optional(),
  codigo_postal: z.string().optional(),
  provincia: z.string().optional(),
  activo: z.boolean(),
  ubicacion: z.object({
    lng: z.number(),
    lat: z.number(),
  }).nullable(),
});

export type BeneficiarioFormValues = z.infer<typeof beneficiarioFormSchema>;