import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { abrirTurno } from '@/lib/caja';

export async function POST(request) {
  try {
    const turno = await abrirTurno(await request.json());
    return NextResponse.json(turno, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
