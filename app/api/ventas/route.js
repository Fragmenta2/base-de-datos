import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { registrarVenta } from '@/lib/caja';

export async function POST(request) {
  try {
    const venta = await registrarVenta(await request.json());
    return NextResponse.json(venta, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
