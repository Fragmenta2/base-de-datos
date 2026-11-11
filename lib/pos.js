// Acceso genérico a las colecciones de pos_minorista (solo servidor)
import mongoose from 'mongoose';
import { getDb } from './mongodb';

const { Decimal128 } = mongoose.mongo;

export class InputError extends Error {
  status = 400;
}

// Lista las colecciones con su número de documentos
export async function listCollections() {
  const db = await getDb();
  const infos = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = infos.map((c) => c.name).filter((n) => !n.startsWith('system.'));
  return Promise.all(
    names.map(async (name) => ({ name, count: await db.collection(name).countDocuments() }))
  );
}

// Lee el validador $jsonSchema de la colección y lo convierte en una lista de campos
export async function getSchema(name) {
  const db = await getDb();
  const [info] = await db.listCollections({ name }).toArray();
  if (!info) return null;

  const validator = info.options?.validator ?? {};
  const json =
    validator.$jsonSchema ?? validator.$and?.find((c) => c.$jsonSchema)?.$jsonSchema ?? {};
  const required = new Set(json.required ?? []);

  return { name, fields: parseProperties(json.properties, required) };
}

function parseProperties(properties = {}, required = new Set()) {
  return Object.entries(properties).map(([key, p]) => {
    const types = [].concat(p.bsonType ?? 'string');
    const kind = types.includes('array')
      ? 'array'
      : types.includes('object')
        ? 'object'
        : types.find((t) => t !== 'null');
    const field = {
      key,
      kind, // string | number | decimal | date | array | object
      nullable: types.includes('null'),
      required: required.has(key),
      maxLength: p.maxLength ?? null,
      minLength: p.minLength ?? null,
      minimum: p.minimum ?? null,
    };
    // Tipos de los campos de documentos embebidos (para formatear p. ej. importes)
    const sub = kind === 'array' ? p.items?.properties : kind === 'object' ? p.properties : null;
    if (sub) field.subKinds = Object.fromEntries(parseProperties(sub).map((f) => [f.key, f.kind]));
    return field;
  });
}

export async function findAll(name) {
  const db = await getDb();
  const docs = await db.collection(name).find().sort({ _id: 1 }).toArray();
  return docs.map(toPlain);
}

export async function insertDoc(schema, input) {
  const doc = coerce(schema, input);
  if (doc._id === undefined || doc._id === null) throw new InputError('El campo "_id" es obligatorio');
  const db = await getDb();
  await db.collection(schema.name).insertOne(doc);
  return toPlain(doc);
}

export async function updateDoc(schema, id, input) {
  const { _id, ...changes } = coerce(schema, input);
  const db = await getDb();
  const doc = await db
    .collection(schema.name)
    .findOneAndUpdate({ _id: parseId(schema, id) }, { $set: changes }, { returnDocument: 'after' });
  return doc && toPlain(doc);
}

export async function deleteDoc(schema, id) {
  const db = await getDb();
  const { deletedCount } = await db.collection(schema.name).deleteOne({ _id: parseId(schema, id) });
  return deletedCount > 0;
}

// El _id de la URL llega como texto; si la colección usa _id numérico se convierte
function parseId(schema, id) {
  const idField = schema.fields.find((f) => f.key === '_id');
  if (idField?.kind !== 'number') return id;
  const n = Number(id);
  if (Number.isNaN(n)) throw new InputError('ID inválido');
  return n;
}

// Convierte los valores del formulario a los tipos BSON que exige el validador.
// Solo maneja campos escalares; los arreglos/objetos embebidos no se editan desde aquí.
function coerce(schema, input) {
  const out = {};
  for (const f of schema.fields) {
    if (f.kind === 'array' || f.kind === 'object' || !(f.key in input)) continue;
    const raw = input[f.key];

    if (raw === '' || raw === null || raw === undefined) {
      if (f.nullable) out[f.key] = null;
      else if (f.required) throw new InputError(`El campo "${f.key}" es obligatorio`);
      continue;
    }

    switch (f.kind) {
      case 'number':
      case 'decimal': {
        const n = Number(raw);
        if (Number.isNaN(n)) throw new InputError(`"${f.key}" debe ser un número`);
        out[f.key] = f.kind === 'decimal' ? Decimal128.fromString(n.toFixed(2)) : n;
        break;
      }
      case 'date': {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) throw new InputError(`"${f.key}" no es una fecha válida`);
        out[f.key] = d;
        break;
      }
      default:
        out[f.key] = String(raw).trim();
    }
  }
  return out;
}

// BSON -> JSON plano para el cliente (Decimal128 -> number, Date -> ISO)
export function toPlain(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (v._bsontype === 'Decimal128') return Number(v.toString());
  if (v._bsontype === 'ObjectId') return v.toHexString();
  if (Array.isArray(v)) return v.map(toPlain);
  if (typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toPlain(x)]));
  }
  return v;
}
