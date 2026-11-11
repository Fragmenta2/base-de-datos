import { CalendarSearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Variación porcentual contra el periodo anterior (indefinida si antes no hubo nada)
export const variacion = (actual, anterior) => (anterior ? ((actual - anterior) / anterior) * 100 : undefined);

export function PeriodoVacio({ texto, ultimoDia, onIrA }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
      <CalendarSearchIcon className="size-8" />
      <p className="text-sm">{texto}</p>
      {ultimoDia && (
        <Button variant="outline" size="sm" onClick={() => onIrA({ fecha: ultimoDia })}>
          Ir al último registro
        </Button>
      )}
    </div>
  );
}
