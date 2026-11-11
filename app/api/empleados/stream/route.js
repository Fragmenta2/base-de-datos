import { suscribir } from '@/lib/empleados-vivo';

export const dynamic = 'force-dynamic';

const LATIDO_MS = 15_000;

/**
 * Server-Sent Events con la lista de empleados cada vez que cambia.
 * Todas las conexiones comparten una sola consulta a MongoDB (ver lib/empleados-vivo.js).
 */
export async function GET(request) {
  const encoder = new TextEncoder();
  let cancelar = () => {};
  let latido;

  const stream = new ReadableStream({
    start(controller) {
      let cerrado = false;
      const send = (text) => {
        if (!cerrado) controller.enqueue(encoder.encode(text));
      };
      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        cancelar();
        clearInterval(latido);
        controller.close();
      };

      cancelar = suscribir((msg) =>
        send(msg.tipo === 'empleados' ? `event: empleados\ndata: ${msg.json}\n\n` : `event: error-bd\ndata: {}\n\n`)
      );
      latido = setInterval(() => send(': latido\n\n'), LATIDO_MS);
      request.signal.addEventListener('abort', cerrar);
    },
    cancel() {
      cancelar();
      clearInterval(latido);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
