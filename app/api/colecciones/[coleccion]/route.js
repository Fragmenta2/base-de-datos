import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { crearDocumento, describirColeccion } from '@/lib/admin';

const notFound = () => NextResponse.json({ error: 'Colección no encontrada' }, { status: 404 });

// Campos (con referencias y documentos embebidos), documentos y opciones de las listas
export async function GET(request, { params }) {
  const { coleccion } = await params;
  try {
    const datos = await describirColeccion(coleccion);
    return datos ? NextResponse.json(datos) : notFound();
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request, { params }) {
  const { coleccion } = await params;
  try {
    const doc = await crearDocumento(coleccion, await request.json());
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
