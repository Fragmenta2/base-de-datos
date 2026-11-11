import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { generarTicketPdf, getTicket } from '@/lib/ticket';

// GET /api/ventas/:id/ticket            -> PDF en el visor del navegador
// GET /api/ventas/:id/ticket?imprimir=1 -> abre además el diálogo de impresión
// GET /api/ventas/:id/ticket?descargar=1 -> descarga el archivo
export async function GET(request, { params }) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const ticket = await getTicket(numero);
    if (!ticket) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const pdf = generarTicketPdf(ticket, { imprimir: searchParams.has('imprimir') });
    const nombre = `ticket-${ticket.venta.comprobante?.folio ?? numero}.pdf`;

    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${searchParams.has('descargar') ? 'attachment' : 'inline'}; filename="${nombre}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
