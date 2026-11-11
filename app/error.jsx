'use client';

import { DatabaseZapIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }) {
  return (
    <Alert variant="destructive" className="max-w-xl">
      <DatabaseZapIcon />
      <AlertTitle>No se pudo cargar la página</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{error.message}</p>
        <p>
          Verifica que MongoDB esté corriendo con <code>npm run db</code>.
        </p>
        <Button variant="outline" size="sm" onClick={reset}>
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
