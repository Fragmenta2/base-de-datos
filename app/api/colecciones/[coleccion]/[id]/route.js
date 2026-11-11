import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { actualizarDocumento, eliminarDocumento } from '@/lib/admin';

const noEncontrado = () => NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

export async function PUT(request, { params }) {
  const { coleccion, id } = await params;
  try {
    const doc = await actualizarDocumento(coleccion, id, await request.json());
    return doc ? NextResponse.json(doc) : noEncontrado();
  } catch (err) {
    return handleError(err);
  }
}

// Responde 409 si el registro está en uso en otra colección
export async function DELETE(request, { params }) {
  const { coleccion, id } = await params;
  try {
    return (await eliminarDocumento(coleccion, id)) ? new NextResponse(null, { status: 204 }) : noEncontrado();
  } catch (err) {
    return handleError(err);
  }
}
