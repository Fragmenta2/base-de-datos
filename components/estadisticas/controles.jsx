'use client';

import { useState } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, LoaderIcon } from 'lucide-react';
import { es } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ESCALAS } from '@/lib/periodos';

// El calendario trabaja con fechas locales; los datos con claves "YYYY-MM-DD"
const keyToLocal = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const localToKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function Controles({ periodo, fecha, hoy, dias, ultimoDia, pending, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const seleccionada = keyToLocal(fecha);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <Tabs value={periodo.escala} onValueChange={(escala) => onChange({ escala })}>
        <TabsList>
          {ESCALAS.map((e) => (
            <TabsTrigger key={e.value} value={e.value}>
              {e.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Periodo anterior" onClick={() => onChange({ fecha: periodo.prev })}>
          <ChevronLeftIcon />
        </Button>

        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-56 justify-start font-normal">
              <CalendarIcon className="text-muted-foreground" />
              {periodo.titulo}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={es}
              captionLayout="dropdown"
              selected={seleccionada}
              defaultMonth={seleccionada}
              onSelect={(d) => {
                if (!d) return;
                setAbierto(false);
                onChange({ fecha: localToKey(d) });
              }}
              modifiers={{ conDatos: dias.map(keyToLocal) }}
              modifiersClassNames={{
                conDatos: '[&_button]:font-bold [&_button]:underline [&_button]:decoration-primary [&_button]:decoration-2 [&_button]:underline-offset-4',
              }}
            />
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">Subrayados: días con registros</p>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="icon" aria-label="Periodo siguiente" onClick={() => onChange({ fecha: periodo.next })}>
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onChange({ fecha: hoy })}>
          Hoy
        </Button>
        {ultimoDia && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ fecha: ultimoDia })}>
            Último registro
          </Button>
        )}
      </div>

      {pending && <LoaderIcon className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
