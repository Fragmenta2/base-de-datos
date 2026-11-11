import { EstadisticasView } from '@/components/estadisticas/estadisticas-view';
import { diasConRegistros, estadisticasMermas, estadisticasVentas } from '@/lib/estadisticas';
import { ESCALAS, getPeriodo, parseKey, toKey } from '@/lib/periodos';

export const metadata = { title: 'Estadísticas' };

// Sin datos guardados, se usa la fecha local de hoy
const hoy = () => toKey(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000));

export default async function EstadisticasPage({ searchParams }) {
  const sp = await searchParams;
  const vista = sp.vista === 'mermas' ? 'mermas' : 'ventas';
  const escala = ESCALAS.some((e) => e.value === sp.escala) ? sp.escala : 'mes';

  const dias = await diasConRegistros(vista);
  // Por defecto se abre el último día con registros para no mostrar un periodo vacío
  const fecha = parseKey(sp.fecha) ?? parseKey(dias.at(-1)) ?? parseKey(hoy());

  const periodo = getPeriodo(escala, fecha);
  const anterior = getPeriodo(escala, parseKey(periodo.prev));
  const datos =
    vista === 'mermas' ? await estadisticasMermas(periodo, anterior) : await estadisticasVentas(periodo, anterior);

  const { start, end, ...periodoCliente } = periodo;

  return (
    <EstadisticasView
      vista={vista}
      fecha={toKey(fecha)}
      hoy={hoy()}
      ultimoDia={dias.at(-1) ?? null}
      dias={dias}
      periodo={periodoCliente}
      datos={datos}
    />
  );
}
