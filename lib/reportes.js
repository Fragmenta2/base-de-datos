// Consultas de ejemplo de pos_minorista_mongodb.js (solo servidor)
import { getDb } from './mongodb';
import { toPlain } from './pos';

// 1) Venta con nombre del cliente, cajero y nombre de cada artículo (equivalente a JOINs)
export async function ventasDetalladas(folio) {
  const db = await getDb();
  const pipeline = [
    ...(folio ? [{ $match: { _id: folio } }] : []),
    { $lookup: { from: 'clientes', localField: 'numero_socio', foreignField: '_id', as: 'cliente' } },
    { $lookup: { from: 'turnos', localField: 'numero_turno', foreignField: '_id', as: 'turno' } },
    { $lookup: { from: 'empleados', localField: 'turno.numero_empleado', foreignField: '_id', as: 'cajero' } },
    { $lookup: { from: 'articulos', localField: 'detalles.codigo_articulo', foreignField: '_id', as: 'articulos' } },
    {
      $project: {
        fecha: 1,
        estado: 1,
        total: 1,
        cliente: { $first: '$cliente.nombre' },
        cajero: { $concat: [{ $first: '$cajero.nombre' }, ' ', { $first: '$cajero.apellidos' }] },
        articulos: '$articulos.nombre',
        comprobante: '$comprobante.folio',
      },
    },
    { $sort: { _id: 1 } },
  ];
  return toPlain(await db.collection('ventas').aggregate(pipeline).toArray());
}

export async function foliosVenta() {
  const db = await getDb();
  const docs = await db.collection('ventas').find({}, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray();
  return docs.map((d) => d._id);
}

// 2) Artículos por debajo de `factor` veces su stock mínimo (alerta de reabasto)
export async function alertaReabasto(factor) {
  const db = await getDb();
  const pipeline = [
    { $match: { $expr: { $lt: ['$cantidad_disponible', { $multiply: ['$stock_minimo', factor] }] } } },
    { $lookup: { from: 'articulos', localField: 'codigo_articulo', foreignField: '_id', as: 'articulo' } },
    { $lookup: { from: 'almacenes', localField: 'codigo_almacen', foreignField: '_id', as: 'almacen' } },
    {
      $project: {
        codigo_articulo: 1,
        articulo: { $first: '$articulo.nombre' },
        almacen: { $first: '$almacen.nombre' },
        cantidad_disponible: 1,
        stock_minimo: 1,
        stock_maximo: 1,
      },
    },
    { $sort: { cantidad_disponible: 1 } },
  ];
  return toPlain(await db.collection('inventario').aggregate(pipeline).toArray());
}

// 3) Total vendido por método de pago
export async function ventasPorMetodoPago() {
  const db = await getDb();
  const pipeline = [
    { $unwind: '$pagos' },
    { $group: { _id: '$pagos.metodo_pago', total: { $sum: '$pagos.monto' }, ventas: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ];
  return toPlain(await db.collection('ventas').aggregate(pipeline).toArray());
}
