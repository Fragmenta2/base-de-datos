import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { setEstatus } from '@/lib/empleados';
import { notificarCambio } from '@/lib/empleados-vivo';

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const { estatus } = await request.json();
    if (!(await setEstatus(id, estatus))) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    notificarCambio(); // las demás pestañas se enteran al instante, sin esperar el siguiente ciclo
    return NextResponse.json({ _id: Number(id), estatus });
  } catch (err) {
    return handleError(err);
  }
}
