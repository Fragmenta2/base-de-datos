// Estadísticas de ventas y mermas por periodo (solo servidor)
import { getDb } from './mongodb';
import { toPlain } from './pos';

const enRango = (periodo) => ({ fecha: { $gte: periodo.start, $lt: periodo.end } });
const cubeta = (periodo) => ({ $dateToString: { format: periodo.formato, date: '$fecha' } });

// Rellena las cubetas vacías para que la gráfica muestre todo el periodo
function serieCompleta(periodo, filas, campos) {
  const porClave = new Map(filas.map((f) => [f._id, f]));
  return periodo.buckets.map((b) => ({
    ...b,
    ...Object.fromEntries(campos.map((c) => [c, porClave.get(b.key)?.[c] ?? 0])),
  }));
}

// Días (YYYY-MM-DD) que tienen registros: se marcan en el calendario
export async function diasConRegistros(coleccion) {
  const db = await getDb();
  const filas = await db
    .collection(coleccion)
    .aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } } } }, { $sort: { _id: 1 } }])
    .toArray();
  return filas.map((f) => f._id);
}

async function resumenVentas(db, periodo) {
  const [r] = await db
    .collection('ventas')
    .aggregate([
      { $match: enRango(periodo) },
      {
        $group: {
          _id: null,
          ingresos: { $sum: '$total' },
          ventas: { $sum: 1 },
          articulos: { $sum: { $sum: '$detalles.cantidad' } },
        },
      },
    ])
    .toArray();
  const { ingresos = 0, ventas = 0, articulos = 0 } = toPlain(r ?? {});
  return { ingresos, ventas, articulos, ticketPromedio: ventas ? ingresos / ventas : 0 };
}

export async function estadisticasVentas(periodo, periodoAnterior) {
  const db = await getDb();
  const ventas = db.collection('ventas');
  const match = { $match: enRango(periodo) };

  const [serie, resumen, anterior, metodos, top, lista] = await Promise.all([
    ventas
      .aggregate([match, { $group: { _id: cubeta(periodo), ingresos: { $sum: '$total' }, ventas: { $sum: 1 } } }])
      .toArray(),
    resumenVentas(db, periodo),
    resumenVentas(db, periodoAnterior),
    ventas
      .aggregate([
        match,
        { $unwind: '$pagos' },
        { $group: { _id: '$pagos.metodo_pago', total: { $sum: '$pagos.monto' }, ventas: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ])
      .toArray(),
    ventas
      .aggregate([
        match,
        { $unwind: '$detalles' },
        {
          $group: {
            _id: '$detalles.codigo_articulo',
            cantidad: { $sum: '$detalles.cantidad' },
            importe: { $sum: '$detalles.importe' },
          },
        },
        { $sort: { importe: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'articulos', localField: '_id', foreignField: '_id', as: 'a' } },
        { $set: { nombre: { $first: '$a.nombre' } } },
        { $project: { a: 0 } },
      ])
      .toArray(),
    ventas
      .aggregate([
        match,
        { $sort: { fecha: -1 } },
        { $limit: 100 },
        { $lookup: { from: 'clientes', localField: 'numero_socio', foreignField: '_id', as: 'c' } },
        {
          $project: {
            fecha: 1,
            estado: 1,
            total: 1,
            cliente: { $first: '$c.nombre' },
            metodo: { $first: '$pagos.metodo_pago' },
            articulos: { $sum: '$detalles.cantidad' },
            folio: '$comprobante.folio',
          },
        },
      ])
      .toArray(),
  ]);

  return {
    serie: serieCompleta(periodo, toPlain(serie), ['ingresos', 'ventas']),
    resumen,
    anterior,
    metodos: toPlain(metodos),
    top: toPlain(top),
    lista: toPlain(lista),
  };
}

// Mermas con el precio del artículo para estimar su costo
const conPrecio = [
  { $lookup: { from: 'articulos', localField: 'codigo_articulo', foreignField: '_id', as: 'a' } },
  {
    $set: {
      articulo: { $first: '$a.nombre' },
      costo: { $multiply: ['$cantidad', { $ifNull: [{ $first: '$a.precio' }, 0] }] },
    },
  },
  { $project: { a: 0 } },
];

async function resumenMermas(db, periodo) {
  const [r] = await db
    .collection('mermas')
    .aggregate([
      { $match: enRango(periodo) },
      ...conPrecio,
      { $group: { _id: null, unidades: { $sum: '$cantidad' }, costo: { $sum: '$costo' }, registros: { $sum: 1 } } },
    ])
    .toArray();
  const { unidades = 0, costo = 0, registros = 0 } = toPlain(r ?? {});
  return { unidades, costo, registros };
}

export async function estadisticasMermas(periodo, periodoAnterior) {
  const db = await getDb();
  const mermas = db.collection('mermas');
  const match = { $match: enRango(periodo) };

  const [serie, resumen, anterior, motivos, lista] = await Promise.all([
    mermas
      .aggregate([
        match,
        ...conPrecio,
        { $group: { _id: cubeta(periodo), unidades: { $sum: '$cantidad' }, costo: { $sum: '$costo' } } },
      ])
      .toArray(),
    resumenMermas(db, periodo),
    resumenMermas(db, periodoAnterior),
    mermas
      .aggregate([
        match,
        ...conPrecio,
        { $group: { _id: '$motivo', unidades: { $sum: '$cantidad' }, costo: { $sum: '$costo' } } },
        { $sort: { unidades: -1 } },
      ])
      .toArray(),
    mermas
      .aggregate([
        match,
        { $sort: { fecha: -1 } },
        ...conPrecio,
        { $lookup: { from: 'empleados', localField: 'numero_empleado', foreignField: '_id', as: 'e' } },
        { $set: { empleado: { $concat: [{ $first: '$e.nombre' }, ' ', { $first: '$e.apellidos' }] } } },
        { $project: { e: 0 } },
      ])
      .toArray(),
  ]);

  return {
    serie: serieCompleta(periodo, toPlain(serie), ['unidades', 'costo']),
    resumen,
    anterior,
    motivos: toPlain(motivos),
    lista: toPlain(lista),
  };
}
