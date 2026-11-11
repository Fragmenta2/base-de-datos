// Inventario con nombres de artículo, categoría y almacén (solo servidor)
import { getDb } from './mongodb';
import { toPlain } from './pos';

export async function getInventario() {
  const db = await getDb();
  const filas = await db
    .collection('inventario')
    .aggregate([
      { $lookup: { from: 'articulos', localField: 'codigo_articulo', foreignField: '_id', as: 'a' } },
      { $lookup: { from: 'almacenes', localField: 'codigo_almacen', foreignField: '_id', as: 'al' } },
      { $set: { a: { $first: '$a' }, al: { $first: '$al' } } },
      { $lookup: { from: 'categorias', localField: 'a.codigo_categoria', foreignField: '_id', as: 'c' } },
      {
        $project: {
          codigo_articulo: 1,
          codigo_almacen: 1,
          cantidad_disponible: 1,
          stock_minimo: 1,
          stock_maximo: 1,
          fecha_actualizacion: 1,
          articulo: '$a.nombre',
          codigo_barras: '$a.codigo_barras',
          precio: '$a.precio',
          estado_articulo: '$a.estado',
          almacen: '$al.nombre',
          categoria: { $first: '$c.nombre' },
        },
      },
      { $sort: { articulo: 1 } },
    ])
    .toArray();
  return toPlain(filas);
}
