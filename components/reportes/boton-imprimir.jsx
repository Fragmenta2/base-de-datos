'use client';

import { PrinterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BotonImprimir() {
  return (
    <Button variant="outline" onClick={() => window.print()} className="print:hidden">
      <PrinterIcon /> Imprimir
    </Button>
  );
}
