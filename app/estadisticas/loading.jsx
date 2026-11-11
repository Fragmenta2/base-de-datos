import { Cargando, EsqueletoEncabezado } from '@/components/esqueletos';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <Cargando que="las estadísticas" />
      <EsqueletoEncabezado acciones={1} />
      <div className="mb-6 flex flex-wrap gap-3" aria-hidden>
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="space-y-6" aria-hidden>
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-12 w-56" />
          </CardHeader>
          <CardContent>
            {/* Columnas de la gráfica */}
            <div className="flex h-72 items-end gap-2 border-b pb-1">
              {[40, 65, 30, 80, 55, 70, 25, 60, 45, 75, 35, 50].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    </>
  );
}
