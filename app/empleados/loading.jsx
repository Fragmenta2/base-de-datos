import { Cargando, EsqueletoEncabezado, EsqueletoIndicadores, EsqueletoTarjetas } from '@/components/esqueletos';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <Cargando que="los empleados" />
      <EsqueletoEncabezado acciones={1} />
      <EsqueletoIndicadores />
      <Skeleton className="mb-3 h-6 w-40" aria-hidden />
      <EsqueletoTarjetas n={8} alto="h-36" />
    </>
  );
}
