// Piezas de esqueleto para los loading.jsx de cada vista.
// Next precarga estos estados de carga, así al navegar la vista nueva aparece al instante
// mientras el servidor trae los datos.
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function EsqueletoEncabezado({ acciones = 0 }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {acciones > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: acciones }, (_, i) => (
            <Skeleton key={i} className="h-9 w-40" />
          ))}
        </div>
      )}
    </div>
  );
}

export function EsqueletoIndicadores({ n = 4 }) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <Card key={i} className="gap-3">
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-36" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EsqueletoTabla({ filas = 8, columnas = 6 }) {
  return (
    <Card aria-hidden>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="space-y-2 pt-2">
          {Array.from({ length: filas + 1 }, (_, i) => (
            <div key={i} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
              {Array.from({ length: columnas }, (_, j) => (
                <Skeleton key={j} className={i === 0 ? 'h-4 w-2/3' : 'h-5'} />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function EsqueletoTarjetas({ n = 8, alto = 'h-28', columnas = 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' }) {
  return (
    <div className={`grid gap-4 ${columnas}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className={`${alto} rounded-xl`} />
      ))}
    </div>
  );
}

// Texto para lectores de pantalla mientras carga
export function Cargando({ que }) {
  return (
    <span className="sr-only" role="status">
      Cargando {que}…
    </span>
  );
}
