import { Cargando, EsqueletoEncabezado, EsqueletoTarjetas } from '@/components/esqueletos';

export default function Loading() {
  return (
    <>
      <Cargando que="las colecciones" />
      <EsqueletoEncabezado />
      <EsqueletoTarjetas n={14} alto="h-24" columnas="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" />
    </>
  );
}
