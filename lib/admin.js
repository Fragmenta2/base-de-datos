// Administración completa de colecciones (solo servidor): crear, editar y eliminar cualquier
// documento, incluidos sus documentos embebidos, validando referencias entre colecciones.
import mongoose from 'mongoose';
import { getDb } from './mongodb';
import { getSchema, InputError, parseProperties, toPlain } from './pos';
import { ADMIN, referenciasA, tituloDe } from './admin-config';
import { collectionLabel, fieldLabel } from './format';

const { Decimal128 } = mongoose.mongo;

export class ConflictError extends Error {
  status = 409;
}

// --- Descripción de campos -------------------------------------------------------------

const tipoDe = (v) =>
  v instanceof Date ? 'date' : v?._bsontype === 'Decimal128' ? 'decimal' : typeof v === 'number' ? 'number' : 'string';
const esMedianoche = (d) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;

// Agrega a un campo lo que el $jsonSchema no sabe: referencia, valores permitidos, si la fecha es sin hora
function enriquecer(campo, { refs = {}, enums = {} } = {}, valores = []) {
  const f = { ...campo };
  if (refs[f.key]) f.ref = refs[f.key];
  if (enums[f.key]) f.opciones = [...new Set([...enums[f.key], ...valores.filter((v) => typeof v === 'string')])];
  if (f.kind === 'date') f.soloFecha = valores.length > 0 && valores.every((v) => !(v instanceof Date) || esMedianoche(v));
  return f;
}

// Campos de un documento embebido: los del esquema, los obligatorios y los que aparecen en los datos
function subCampos(campo, prop, crudos, subCfg) {
  const def = campo.kind === 'array' ? prop?.items : prop;
  const props = def?.properties ?? {};
  const requeridos = def?.required ?? [];
  const muestras = crudos.flatMap((d) => {
    const v = d[campo.key];
    return campo.kind === 'array' ? (v ?? []) : v ? [v] : [];
  });
  const declarados = new Map(parseProperties(props, new Set(requeridos)).map((f) => [f.key, f]));
  const claves = [...new Set([...requeridos, ...Object.keys(props), ...muestras.flatMap(Object.keys)])];

  return claves.map((key) => {
    const valores = muestras.map((m) => m[key]).filter((v) => v !== null && v !== undefined);
    const base = declarados.get(key) ?? {
      key,
      kind: valores.length ? tipoDe(valores[0]) : 'string',
      nullable: false,
      required: requeridos.includes(key),
      maxLength: null,
      minLength: null,
      minimum: null,
    };
    return enriquecer(base, subCfg, valores);
  });
}

function camposDe(schema, crudos) {
  const cfg = ADMIN[schema.name] ?? {};
  const props = schema.json?.properties ?? {};
  return schema.fields.map((f) => {
    if (f.kind === 'array' || f.kind === 'object') {
      return { ...f, subFields: subCampos(f, props[f.key], crudos, cfg.sub?.[f.key]) };
    }
    const valores = crudos.map((d) => d[f.key]).filter((v) => v !== null && v !== undefined);
    return enriquecer(f, cfg, valores);
  });
}

// ID sugerido para un documento nuevo: 116 si son números, A016 si son códigos con prefijo
function siguienteId(ids) {
  if (ids.length === 0) return '';
  if (ids.every((i) => typeof i === 'number')) return Math.max(...ids) + 1;
  let mejor = null;
  for (const id of ids) {
    const m = /^(.*?)(\d+)$/.exec(String(id));
    if (m && (!mejor || Number(m[2]) > mejor.n)) mejor = { prefijo: m[1], n: Number(m[2]), ancho: m[2].length };
  }
  return mejor ? `${mejor.prefijo}${String(mejor.n + 1).padStart(mejor.ancho, '0')}` : '';
}

// Folio más alto de cada documento embebido (para numerar renglones nuevos)
function maximosEmbebidos(campos, crudos) {
  const max = {};
  for (const f of campos.filter((c) => c.subFields)) {
    for (const s of f.subFields.filter((s) => s.kind === 'number' && /^(folio|num_)/.test(s.key))) {
      const valores = crudos.flatMap((d) => {
        const v = d[f.key];
        return (f.kind === 'array' ? (v ?? []) : v ? [v] : []).map((x) => x[s.key]);
      });
      max[`${f.key}.${s.key}`] = Math.max(0, ...valores.filter((n) => typeof n === 'number'));
    }
  }
  return max;
}

// Opciones de las listas desplegables: [{ value, label }] por colección referenciada
async function opcionesDe(db, campos) {
  const destinos = new Set(campos.flatMap((f) => [f.ref, ...(f.subFields ?? []).map((s) => s.ref)]).filter(Boolean));
  const pares = await Promise.all(
    [...destinos].map(async (destino) => {
      const docs = await db.collection(destino).find().sort({ _id: 1 }).toArray();
      return [destino, docs.map((d) => ({ value: d._id, label: tituloDe(destino, toPlain(d)) }))];
    })
  );
  return Object.fromEntries(pares);
}

/** Todo lo que necesita la vista de una colección: campos enriquecidos, documentos y opciones. */
export async function describirColeccion(nombre) {
  const schema = await getSchema(nombre);
  if (!schema) return null;
  const db = await getDb();
  const crudos = await db.collection(nombre).find().sort({ _id: 1 }).toArray();
  const campos = camposDe(schema, crudos);

  return {
    schema: { name: nombre, fields: campos },
    docs: crudos.map(toPlain),
    opciones: await opcionesDe(db, campos),
    siguienteId: siguienteId(crudos.map((d) => d._id)),
    maximos: maximosEmbebidos(campos, crudos),
  };
}

async function esquemaAdmin(nombre) {
  const schema = await getSchema(nombre);
  if (!schema) throw new InputError('Colección no encontrada');
  const db = await getDb();
  const muestra = await db.collection(nombre).find().limit(200).toArray(); // para inferir campos embebidos
  return { name: nombre, fields: camposDe(schema, muestra) };
}

// --- Conversión de tipos ----------------------------------------------------------------

function convertir(f, raw, ruta) {
  const nombre = ruta.join(' › ');
  if (raw === '' || raw === null || raw === undefined) {
    if (f.nullable) return null;
    if (f.required) throw new InputError(`Falta "${nombre}"`);
    return undefined;
  }
  switch (f.kind) {
    case 'number':
    case 'decimal': {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new InputError(`"${nombre}" debe ser un número`);
      return f.kind === 'decimal' ? Decimal128.fromString(n.toFixed(2)) : n;
    }
    case 'date': {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) throw new InputError(`"${nombre}" no es una fecha válida`);
      return d;
    }
    case 'array': {
      if (!Array.isArray(raw)) throw new InputError(`"${nombre}" debe ser una lista`);
      return raw.map((fila, i) => convertirCampos(f.subFields, fila, [...ruta, `renglón ${i + 1}`]));
    }
    case 'object':
      return convertirCampos(f.subFields, raw, ruta);
    default:
      return String(raw).trim();
  }
}

function convertirCampos(campos, input, ruta = []) {
  const out = {};
  for (const f of campos) {
    if (!(f.key in input)) {
      if (f.required && ruta.length > 0) throw new InputError(`Falta "${[...ruta, fieldLabel(f.key)].join(' › ')}"`);
      continue;
    }
    const v = convertir(f, input[f.key], [...ruta, fieldLabel(f.key)]);
    if (v !== undefined) out[f.key] = v;
  }
  return out;
}

// --- Integridad referencial -------------------------------------------------------------

// Comprueba que cada referencia (rol, categoría, artículo de un detalle...) exista
async function validarReferencias(db, campos, doc) {
  const buscados = new Map(); // destino -> Map(valor -> descripción del campo)
  const anotar = (destino, valor, donde) => {
    if (valor === null || valor === undefined) return;
    if (!buscados.has(destino)) buscados.set(destino, new Map());
    buscados.get(destino).set(valor, donde);
  };
  for (const f of campos) {
    const v = doc[f.key];
    if (f.ref) anotar(f.ref, v, fieldLabel(f.key));
    if (f.subFields && v) {
      const filas = f.kind === 'array' ? v : [v];
      filas.forEach((fila, i) => {
        for (const s of f.subFields.filter((s) => s.ref)) {
          anotar(s.ref, fila[s.key], `${fieldLabel(f.key)}${f.kind === 'array' ? ` (renglón ${i + 1})` : ''} › ${fieldLabel(s.key)}`);
        }
      });
    }
  }
  for (const [destino, valores] of buscados) {
    const existentes = new Set(
      (await db.collection(destino).find({ _id: { $in: [...valores.keys()] } }, { projection: { _id: 1 } }).toArray()).map((d) => d._id)
    );
    for (const [valor, donde] of valores) {
      if (!existentes.has(valor)) throw new InputError(`${donde}: "${valor}" no existe en ${collectionLabel(destino)}`);
    }
  }
}

function parseId(campos, id) {
  if (campos.find((f) => f.key === '_id')?.kind !== 'number') return id;
  const n = Number(id);
  if (Number.isNaN(n)) throw new InputError('ID inválido');
  return n;
}

// --- Operaciones ------------------------------------------------------------------------

export async function crearDocumento(nombre, input) {
  const { fields } = await esquemaAdmin(nombre);
  const doc = convertirCampos(fields, input);
  if (doc._id === undefined || doc._id === null || doc._id === '') throw new InputError('Falta el ID');
  const db = await getDb();
  await validarReferencias(db, fields, doc);
  await db.collection(nombre).insertOne(doc);
  return toPlain(doc);
}

export async function actualizarDocumento(nombre, id, input) {
  const { fields } = await esquemaAdmin(nombre);
  const { _id, ...cambios } = convertirCampos(fields, input);
  const db = await getDb();
  await validarReferencias(db, fields, cambios);
  const doc = await db
    .collection(nombre)
    .findOneAndUpdate({ _id: parseId(fields, id) }, { $set: cambios }, { returnDocument: 'after' });
  return doc && toPlain(doc);
}

/** Elimina solo si nadie lo usa; si no, explica dónde se usa. */
export async function eliminarDocumento(nombre, id) {
  const { fields } = await esquemaAdmin(nombre);
  const _id = parseId(fields, id);
  const db = await getDb();

  const usos = (
    await Promise.all(
      referenciasA(nombre).map(async ({ coleccion, ruta }) => ({
        coleccion,
        n: await db.collection(coleccion).countDocuments({ [ruta]: _id }),
      }))
    )
  ).filter((u) => u.n > 0);

  if (usos.length) {
    // Sumar por colección (una venta puede usar el artículo en varios campos)
    const porColeccion = new Map();
    for (const u of usos) porColeccion.set(u.coleccion, (porColeccion.get(u.coleccion) ?? 0) + u.n);
    const detalle = [...porColeccion].map(([c, n]) => `${n} en ${collectionLabel(c).toLowerCase()}`).join(', ');
    throw new ConflictError(`No se puede eliminar porque está en uso: ${detalle}. Primero cambia o elimina esos registros.`);
  }

  const { deletedCount } = await db.collection(nombre).deleteOne({ _id });
  return deletedCount > 0;
}
