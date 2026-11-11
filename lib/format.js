// Utilidades de presentación compartidas por servidor y cliente

export const COLLECTION_GROUPS = [
  { title: 'Ventas y caja', items: ['ventas', 'devoluciones', 'turnos', 'cajas', 'clientes'] },
  { title: 'Productos', items: ['articulos', 'categorias', 'inventario', 'almacenes', 'mermas'] },
  { title: 'Compras', items: ['pedidos', 'proveedores'] },
  { title: 'Personal', items: ['empleados', 'roles'] },
];

const COLLECTION_LABELS = {
  articulos: 'Artículos',
  categorias: 'Categorías',
};

const FIELD_LABELS = {
  _id: 'ID',
  numero_socio: 'Cliente (socio)',
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const collectionLabel = (name) => COLLECTION_LABELS[name] ?? capitalize(name.replace(/_/g, ' '));
export const fieldLabel = (key) => FIELD_LABELS[key] ?? capitalize(key.replace(/_/g, ' '));

// Agrupa las colecciones existentes según COLLECTION_GROUPS; las desconocidas van a "Otras"
export function groupCollections(collections) {
  const byName = new Map(collections.map((c) => [c.name, c]));
  const groups = COLLECTION_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((n) => byName.has(n)).map((n) => byName.get(n)),
  }));
  const known = new Set(COLLECTION_GROUPS.flatMap((g) => g.items));
  const others = collections.filter((c) => !known.has(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (others.length) groups.push({ title: 'Otras', items: others });
  return groups.filter((g) => g.items.length);
}

// Números con separador de miles, sin toLocaleString (mismo resultado en servidor y navegador)
const thousands = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatMoney(n, { decimals = 2 } = {}) {
  const value = Number(n) || 0;
  const [int, dec] = Math.abs(value).toFixed(decimals).split('.');
  return `${value < 0 ? '-' : ''}$${thousands(int)}${dec ? `.${dec}` : ''}`;
}

export const formatInt = (n) => thousands(String(Math.round(Number(n) || 0)));

// "2026-10-03T12:21:00.000Z" -> "03/10/2026 12:21" (hora "de pared" guardada en UTC)
export function formatFechaHora(iso, { hora = true } = {}) {
  if (!iso) return '—';
  const [date, time] = iso.split('T');
  const [y, m, d] = date.split('-');
  return hora ? `${d}/${m}/${y} ${time.slice(0, 5)}` : `${d}/${m}/${y}`;
}

const ISO_DATE =/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// Formato determinista (sin toLocaleString) para que servidor y navegador rendericen igual
export function formatValue(value, kind) {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'date' || (typeof value === 'string' && ISO_DATE.test(value))) {
    const [date, time] = value.split('T');
    const hhmm = time.slice(0, 5);
    return hhmm === '00:00' ? date : `${date} ${hhmm}`;
  }
  if (kind === 'decimal' || (typeof value === 'number' && !Number.isInteger(value))) {
    const [int, dec] = Number(value).toFixed(2).split('.');
    return `$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
