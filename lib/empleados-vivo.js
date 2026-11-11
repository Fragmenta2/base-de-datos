// Estado de empleados en tiempo real, compartido por todas las conexiones (solo servidor).
// Antes cada pestaña abierta consultaba MongoDB cada 1.5 s; ahora hay una sola consulta
// periódica mientras haya alguien conectado, y su resultado se reparte a todos.
// (Los change streams de MongoDB necesitarían un replica set; el servidor local es standalone.)
import { getEmpleados } from './empleados';

const INTERVALO_MS = 1500;

// En desarrollo Next recarga módulos: el estado vive en globalThis para no duplicar temporizadores
const vivo =
  globalThis._empleadosVivo ??
  (globalThis._empleadosVivo = { subs: new Set(), timer: null, ultimo: null, enCurso: false });

async function revisar() {
  if (vivo.enCurso) return; // si MongoDB tarda, no se encimen consultas
  vivo.enCurso = true;
  try {
    const json = JSON.stringify(await getEmpleados());
    if (json !== vivo.ultimo) {
      vivo.ultimo = json;
      for (const enviar of vivo.subs) enviar({ tipo: 'empleados', json });
    }
  } catch {
    for (const enviar of vivo.subs) enviar({ tipo: 'error-bd' });
  } finally {
    vivo.enCurso = false;
  }
}

/** Suscribe una conexión; recibe de inmediato el último estado conocido. Devuelve la función para cancelar. */
export function suscribir(enviar) {
  vivo.subs.add(enviar);
  if (vivo.ultimo) enviar({ tipo: 'empleados', json: vivo.ultimo });
  if (!vivo.timer) {
    revisar();
    vivo.timer = setInterval(revisar, INTERVALO_MS);
  }
  return () => {
    vivo.subs.delete(enviar);
    if (vivo.subs.size === 0) {
      clearInterval(vivo.timer);
      vivo.timer = null;
      vivo.ultimo = null;
    }
  };
}

/** Fuerza una revisión inmediata (p. ej. tras cambiar un estatus desde la app). */
export function notificarCambio() {
  if (vivo.subs.size > 0) revisar();
}
