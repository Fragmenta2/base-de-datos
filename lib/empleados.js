// Empleados con su rol (solo servidor)
import { getDb } from './mongodb';
import { InputError, toPlain } from './pos';

export const ESTATUS = ['Activo', 'Inactivo', 'Vacaciones'];

export async function getEmpleados() {
  const db = await getDb();
  const filas = await db
    .collection('empleados')
    .aggregate([
      { $lookup: { from: 'roles', localField: 'codigo_rol', foreignField: '_id', as: 'r' } },
      { $set: { rol: { $first: '$r.nombre' } } },
      { $project: { r: 0 } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  return toPlain(filas);
}

export async function setEstatus(id, estatus) {
  if (!ESTATUS.includes(estatus)) throw new InputError('Estatus inválido');
  const numero = Number(id);
  if (!Number.isInteger(numero)) throw new InputError('ID inválido');
  const db = await getDb();
  const r = await db.collection('empleados').updateOne({ _id: numero }, { $set: { estatus } });
  return r.matchedCount > 0;
}
