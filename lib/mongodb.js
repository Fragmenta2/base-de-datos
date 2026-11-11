import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;

// Cache global: en desarrollo Next recarga módulos y abriría conexiones nuevas en cada cambio
const cached = globalThis._mongoose ?? (globalThis._mongoose = { conn: null, promise: null });

export async function connectDB() {
  if (!uri) throw new Error('Falta MONGODB_URI en .env.local');
  if (cached.conn) return cached.conn;
  cached.promise ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  asegurarIndices(cached.conn.connection.db);
  return cached.conn;
}

// Se ejecuta una vez por conexión, sin bloquear la petición.
// - mermas.fecha: estadísticas de mermas por periodo
// - turnos {estado, numero_empleado}: turno abierto de cada cajero
// - clientes.rfc: cliente "Público en General" en cada venta
function asegurarIndices(db) {
  Promise.all([
    db.collection('mermas').createIndex({ fecha: 1 }),
    db.collection('turnos').createIndex({ estado: 1, numero_empleado: 1 }),
    db.collection('clientes').createIndex({ rfc: 1 }),
  ]).catch((err) => console.warn('No se pudieron crear índices:', err.message));
}

// Acceso directo al driver nativo: las colecciones ya tienen su esquema ($jsonSchema) en MongoDB
export async function getDb() {
  const conn = await connectDB();
  return conn.connection.db;
}
