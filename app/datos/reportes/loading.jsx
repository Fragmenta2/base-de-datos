import { Cargando, EsqueletoEncabezado, EsqueletoTabla } from '@/components/esqueletos';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <Cargando que="los reportes" />
      <EsqueletoEncabezado acciones={1} />
      <div className="space-y-6" aria-hidden>
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <EsqueletoTabla filas={8} columnas={7} />
      </div>
    </>
  );
}
