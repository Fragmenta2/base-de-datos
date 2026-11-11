// =====================================================================
//  CATÁLOGO DE COLECCIONES DE pos_minorista, AGRUPADAS POR CATEGORÍA
//  Única fuente de las categorías: de aquí salen los nombres visibles,
//  el orden y las descripciones que usan la Administración y el resto de la app.
//  (Compartido por servidor y cliente: no importa nada del servidor.)
//
//  Ventas y caja ─ ventas · devoluciones · turnos · cajas · clientes
//  Productos ───── articulos · categorias · inventario · almacenes · mermas
//  Compras ─────── pedidos · proveedores
//  Personal ────── empleados · roles
// =====================================================================

export const CATEGORIAS = [
  // ---------------------------------------------------------------------
  //  VENTAS Y CAJA: lo que ocurre en el punto de venta
  // ---------------------------------------------------------------------
  {
    id: 'ventas',
    titulo: 'Ventas y caja',
    descripcion: 'Cobros, devoluciones, turnos y el dinero de cada caja.',
    colecciones: {
      ventas: {
        etiqueta: 'Ventas',
        descripcion: 'Cada venta con sus artículos, pagos y comprobante (embebidos en el mismo documento).',
      },
      devoluciones: {
        etiqueta: 'Devoluciones',
        descripcion: 'Devoluciones de una venta con los artículos devueltos (embebidos).',
      },
      turnos: {
        etiqueta: 'Turnos',
        descripcion: 'Turno de un cajero en una caja, con sus movimientos de efectivo (embebidos).',
      },
      cajas: { etiqueta: 'Cajas', descripcion: 'Cajas registradoras, su estado y su saldo actual.' },
      clientes: { etiqueta: 'Clientes', descripcion: 'Clientes registrados, incluido "Público en General".' },
    },
  },

  // ---------------------------------------------------------------------
  //  PRODUCTOS: el catálogo y sus existencias
  // ---------------------------------------------------------------------
  {
    id: 'productos',
    titulo: 'Productos',
    descripcion: 'El catálogo de la tienda, dónde se guarda y cuánto queda.',
    colecciones: {
      articulos: { etiqueta: 'Artículos', descripcion: 'Productos a la venta con su código de barras, precio y categoría.' },
      categorias: { etiqueta: 'Categorías', descripcion: 'Clasificación de los artículos (abarrotes, bebidas, lácteos…).' },
      inventario: { etiqueta: 'Inventario', descripcion: 'Existencias de cada artículo en un almacén, con su stock mínimo y máximo.' },
      almacenes: { etiqueta: 'Almacenes', descripcion: 'Lugares donde se guarda la mercancía y su capacidad.' },
      mermas: { etiqueta: 'Mermas', descripcion: 'Mercancía perdida por caducidad, daños, robo u otros motivos.' },
    },
  },

  // ---------------------------------------------------------------------
  //  COMPRAS: abastecimiento
  // ---------------------------------------------------------------------
  {
    id: 'compras',
    titulo: 'Compras',
    descripcion: 'A quién se le compra y qué se ha pedido.',
    colecciones: {
      pedidos: {
        etiqueta: 'Pedidos',
        descripcion: 'Pedidos a proveedores con sus artículos, factura y entregas (embebidos).',
      },
      proveedores: { etiqueta: 'Proveedores', descripcion: 'Empresas que surten la mercancía.' },
    },
  },

  // ---------------------------------------------------------------------
  //  PERSONAL: quién trabaja en la tienda
  // ---------------------------------------------------------------------
  {
    id: 'personal',
    titulo: 'Personal',
    descripcion: 'La plantilla y los puestos de trabajo.',
    colecciones: {
      empleados: { etiqueta: 'Empleados', descripcion: 'Plantilla con datos personales, horario, salario, puesto y estatus.' },
      roles: { etiqueta: 'Roles', descripcion: 'Puestos de trabajo y sus responsabilidades.' },
    },
  },
];

// Índice nombre de colección -> { categoria, etiqueta, descripcion }
const INDICE = new Map(
  CATEGORIAS.flatMap((cat) =>
    Object.entries(cat.colecciones).map(([nombre, info]) => [nombre, { ...info, categoria: cat }])
  )
);

/** Información de una colección: etiqueta, descripción y la categoría a la que pertenece. */
export const infoColeccion = (nombre) => INDICE.get(nombre) ?? null;

/**
 * Agrupa una lista de colecciones [{ name, count }] por categoría, en el orden del catálogo.
 * Las colecciones que no estén en el catálogo van a "Otras".
 */
export function agruparPorCategoria(colecciones) {
  const porNombre = new Map(colecciones.map((c) => [c.name, c]));
  const grupos = CATEGORIAS.map((cat) => ({
    id: cat.id,
    title: cat.titulo,
    descripcion: cat.descripcion,
    items: Object.keys(cat.colecciones)
      .filter((n) => porNombre.has(n))
      .map((n) => porNombre.get(n)),
  }));
  const otras = colecciones.filter((c) => !INDICE.has(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (otras.length) grupos.push({ id: 'otras', title: 'Otras', descripcion: 'Colecciones fuera del catálogo.', items: otras });
  return grupos.filter((g) => g.items.length);
}
