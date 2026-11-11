import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { deleteDoc, getSchema, updateDoc } from '@/lib/pos';

const notFound = (what) => NextResponse.json({ error: `${what} no encontrado` }, { status: 404 });

export async function PUT(request, { params }) {
  const { coleccion, id } = await params;
  try {
    const schema = await getSchema(coleccion);
    if (!schema) return notFound('Colección');
    const doc = await updateDoc(schema, id, await request.json());
    return doc ? NextResponse.json(doc) : notFound('Documento');
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request, { params }) {
  const { coleccion, id } = await params;
  try {
    const schema = await getSchema(coleccion);
    if (!schema) return notFound('Colección');
    return (await deleteDoc(schema, id)) ? new NextResponse(null, { status: 204 }) : notFound('Documento');
  } catch (err) {
    return handleError(err);
  }
}
