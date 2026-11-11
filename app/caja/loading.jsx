import { Cargando, EsqueletoTarjetas } from '@/components/esqueletos';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Misma estructura que la caja: catálogo a la izquierda y ticket a la derecha
export default function Loading() {
  return (
    <div className="grid gap-6 xl:h-[calc(100svh-7.5rem)] xl:min-h-[600px] xl:grid-cols-[minmax(0,1fr)_420px]">
      <Cargando que="la caja" />
      <section className="flex min-h-0 flex-col gap-4" aria-hidden>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-9 w-full sm:w-80" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <EsqueletoTarjetas n={12} alto="h-32" columnas="grid-cols-2 md:grid-cols-3 2xl:grid-cols-4" />
      </section>

      <Card className="min-h-0 gap-0 py-0 xl:h-full" aria-hidden>
        <CardHeader className="border-b py-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent className="flex-1 space-y-3 py-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
        </CardFooter>
      </Card>
    </div>
  );
}
