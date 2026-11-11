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

  const cargarDatos = (periodo, anterior) =>
    vista === 'mermas' ? estadisticasMermas(periodo, anterior) : estadisticasVentas(periodo, anterior);

  // Con fecha en la URL todo se consulta en paralelo; sin ella, primero se busca el último día
  // con registros para no abrir un periodo vacío.
  const fechaUrl = parseKey(sp.fecha);
  let dias, fecha, periodo, datos;
  if (fechaUrl) {
    fecha = fechaUrl;
    periodo = getPeriodo(escala, fecha);
    [dias, datos] = await Promise.all([
      diasConRegistros(vista),
      cargarDatos(periodo, getPeriodo(escala, parseKey(periodo.prev))),
    ]);
  } else {
    dias = await diasConRegistros(vista);
    fecha = parseKey(dias.at(-1)) ?? parseKey(hoy());
    periodo = getPeriodo(escala, fecha);
    datos = await cargarDatos(periodo, getPeriodo(escala, parseKey(periodo.prev)));
  }

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
