// Acceso genérico a las colecciones de pos_minorista (solo servidor)
import { getDb } from './mongodb';

export class InputError extends Error {
  status = 400;
}

// Lista las colecciones con su número de documentos
export async function listCollections() {
  const db = await getDb();
  const infos = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = infos.map((c) => c.name).filter((n) => !n.startsWith('system.'));
  return Promise.all(
    names.map(async (name) => ({ name, count: await db.collection(name).estimatedDocumentCount() }))
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

  return { name, json, fields: parseProperties(json.properties, required) };
}

export function parseProperties(properties = {}, required = new Set()) {
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
