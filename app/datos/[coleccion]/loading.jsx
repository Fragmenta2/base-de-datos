import { Cargando, EsqueletoTabla } from '@/components/esqueletos';
import { Skeleton } from '@/components/ui/skeleton';

// Misma forma que la administración: lista de colecciones a la izquierda y tabla a la derecha
export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <Cargando que="la colección" />
      <div className="hidden space-y-2 lg:block" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
      <div className="space-y-4" aria-hidden>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <EsqueletoTabla filas={10} columnas={7} />
      </div>
    </div>
  );
}
