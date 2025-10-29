'use client';

import { BeneficiarioForm } from '@/components/forms/beneficiario-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Separator } from '@/components/ui/separator';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CrearBeneficiarioPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Link
          href="/protected/beneficiarios"
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la lista de beneficiarios
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo Beneficiario</h1>
        <p className="text-muted-foreground">
          Complete el formulario para registrar un nuevo beneficiario en el sistema.
        </p>
      </div>

      {/* <Separator className="my-6" /> */}

      <Card>
        <CardHeader>
          <CardTitle>Información del Beneficiario</CardTitle>
          <CardDescription>
            Ingrese los datos del nuevo beneficiario. Todos los campos son obligatorios a menos que se indique lo contrario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BeneficiarioForm />
        </CardContent>
      </Card>
    </div>
  );
}
