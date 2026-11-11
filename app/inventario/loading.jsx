import { Cargando, EsqueletoEncabezado, EsqueletoIndicadores, EsqueletoTabla } from '@/components/esqueletos';

export default function Loading() {
  return (
    <>
      <Cargando que="el inventario" />
      <EsqueletoEncabezado />
      <EsqueletoIndicadores />
      <EsqueletoTabla filas={10} columnas={7} />
    </>
  );
}
