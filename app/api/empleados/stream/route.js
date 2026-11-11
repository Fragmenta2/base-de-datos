import { getEmpleados } from '@/lib/empleados';

export const dynamic = 'force-dynamic';

const INTERVALO_MS = 1500;
const LATIDO_MS = 15_000;

/**
 * Server-Sent Events con la lista de empleados.
 * Los change streams de MongoDB requieren un replica set y el servidor local es standalone,
 * así que se consulta la colección cada 1.5 s y solo se envía cuando algo cambió
 * (también detecta cambios hechos fuera de la app, p. ej. desde Compass o mongosh).
 */
export async function GET(request) {
  const encoder = new TextEncoder();
  let timer;
  let latido;

  const stream = new ReadableStream({
    async start(controller) {
      let ultimo = '';
      let cerrado = false;

      const send = (text) => {
        if (!cerrado) controller.enqueue(encoder.encode(text));
      };
      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        clearInterval(timer);
        clearInterval(latido);
        controller.close();
      };

      const revisar = async () => {
        try {
          const json = JSON.stringify(await getEmpleados());
          if (json !== ultimo) {
            ultimo = json;
            send(`event: empleados\ndata: ${json}\n\n`);
          }
        } catch {
          send(`event: error-bd\ndata: {}\n\n`);
        }
      };

      request.signal.addEventListener('abort', cerrar);
      await revisar();
      timer = setInterval(revisar, INTERVALO_MS);
      latido = setInterval(() => send(': latido\n\n'), LATIDO_MS);
    },
    cancel() {
      clearInterval(timer);
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
