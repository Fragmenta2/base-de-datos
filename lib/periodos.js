// Periodos de tiempo para las estadísticas (compartido por servidor y cliente).
// Las fechas de pos_minorista se guardan como hora local "de pared" en UTC
// (el script de carga usa "2026-10-01 10:07" -> 2026-10-01T10:07Z), así que todo se calcula en UTC.

export const ESCALAS = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' },
];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const DAY = 86_400_000;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const toKey = (d) => d.toISOString().slice(0, 10);

export function parseKey(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? '')) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Mismo día en otro mes, ajustado si el mes destino es más corto (31 -> 30, 28...)
function shiftMonths(d, n) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const target = new Date(Date.UTC(y, m, 1));
  const day = Math.min(d.getUTCDate(), daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day));
}

const fechaLarga = (d) =>
  `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
const fechaCorta = (d) => `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()].toLowerCase()}`;

/**
 * Describe el periodo que contiene `fecha` para la escala dada:
 * rango [start, end), cubetas de la gráfica, título y fechas para navegar.
 * `formato` es el formato de $dateToString que produce la clave de cada cubeta.
 */
export function getPeriodo(escala, fecha) {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth();

  switch (escala) {
    case 'dia': {
      const start = fecha;
      return {
        escala,
        start,
        end: addDays(start, 1),
        formato: '%H',
        buckets: Array.from({ length: 24 }, (_, h) => {
          const key = String(h).padStart(2, '0');
          return { key, label: `${key}:00`, detalle: `${key}:00 – ${key}:59` };
        }),
        titulo: capitalize(fechaLarga(start)),
        unidad: 'hora',
        prev: toKey(addDays(fecha, -1)),
        next: toKey(addDays(fecha, 1)),
      };
    }
    case 'semana': {
      const start = addDays(fecha, -((fecha.getUTCDay() + 6) % 7)); // lunes
      const end = addDays(start, 7);
      const last = addDays(end, -1);
      return {
        escala,
        start,
        end,
        formato: '%Y-%m-%d',
        buckets: Array.from({ length: 7 }, (_, i) => {
          const d = addDays(start, i);
          return { key: toKey(d), label: `${DIAS_CORTOS[d.getUTCDay()]} ${d.getUTCDate()}`, detalle: capitalize(fechaLarga(d)) };
        }),
        titulo: `${fechaCorta(start)} – ${fechaCorta(last)} ${last.getUTCFullYear()}`,
        unidad: 'día',
        prev: toKey(addDays(fecha, -7)),
        next: toKey(addDays(fecha, 7)),
      };
    }
    case 'anio': {
      const start = new Date(Date.UTC(y, 0, 1));
      return {
        escala,
        start,
        end: new Date(Date.UTC(y + 1, 0, 1)),
        formato: '%m',
        buckets: MESES_CORTOS.map((label, i) => ({
          key: String(i + 1).padStart(2, '0'),
          label,
          detalle: `${capitalize(MESES[i])} ${y}`,
        })),
        titulo: String(y),
        unidad: 'mes',
        prev: toKey(shiftMonths(fecha, -12)),
        next: toKey(shiftMonths(fecha, 12)),
      };
    }
    default: {
      // mes
      const start = new Date(Date.UTC(y, m, 1));
      return {
        escala: 'mes',
        start,
        end: new Date(Date.UTC(y, m + 1, 1)),
        formato: '%Y-%m-%d',
        buckets: Array.from({ length: daysInMonth(y, m) }, (_, i) => {
          const d = new Date(Date.UTC(y, m, i + 1));
          return { key: toKey(d), label: String(i + 1), detalle: capitalize(fechaLarga(d)) };
        }),
        titulo: `${capitalize(MESES[m])} ${y}`,
        unidad: 'día',
        prev: toKey(shiftMonths(fecha, -1)),
        next: toKey(shiftMonths(fecha, 1)),
      };
    }
  }
}
