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
  return cached.conn;
}

// Acceso directo al driver nativo: las colecciones ya tienen su esquema ($jsonSchema) en MongoDB
export async function getDb() {
  const conn = await connectDB();
  return conn.connection.db;
}
