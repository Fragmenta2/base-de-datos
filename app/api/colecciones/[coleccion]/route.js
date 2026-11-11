import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { findAll, getSchema, insertDoc } from '@/lib/pos';

const notFound = () => NextResponse.json({ error: 'Colección no encontrada' }, { status: 404 });

export async function GET(request, { params }) {
  const { coleccion } = await params;
  try {
    const schema = await getSchema(coleccion);
    if (!schema) return notFound();
    return NextResponse.json({ schema, docs: await findAll(coleccion) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request, { params }) {
  const { coleccion } = await params;
  try {
    const schema = await getSchema(coleccion);
    if (!schema) return notFound();
    const doc = await insertDoc(schema, await request.json());
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
