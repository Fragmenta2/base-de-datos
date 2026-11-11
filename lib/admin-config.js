// Configuración de la vista de Administración (solo servidor).
// El $jsonSchema de MongoDB dice los tipos de cada campo; aquí se agrega lo que el esquema no sabe:
//  - refs:   campos que apuntan a otra colección (se muestran como lista desplegable con nombres)
//  - enums:  valores permitidos de los campos de estado
//  - sub:    lo mismo para los documentos embebidos (detalles, pagos, entregas...)
//  - titulo: cómo se llama un documento al mostrarlo en una lista
import { METODOS_PAGO } from './caja';
import { ESTATUS } from './empleados';

export const ADMIN = {
  roles: { titulo: (d) => d.nombre },
  empleados: {
    titulo: (d) => `${d.nombre} ${d.apellidos}`,
    refs: { codigo_rol: 'roles' },
    enums: { estatus: ESTATUS },
  },
  cajas: { titulo: (d) => `Caja ${d._id}`, enums: { estado: ['Abierta', 'Cerrada', 'Mantenimiento'] } },
  turnos: {
    titulo: (d) => `Turno ${d._id} · Caja ${d.numero_caja}`,
    refs: { numero_caja: 'cajas', numero_empleado: 'empleados' },
    enums: { estado: ['Abierto', 'Cerrado'] },
    sub: { movimientos: { enums: { tipo: ['Entrada', 'Salida'] } } },
  },
  clientes: { titulo: (d) => d.nombre },
  ventas: {
    titulo: (d) => `Venta #${d._id}`,
    refs: { numero_turno: 'turnos', numero_socio: 'clientes' },
    enums: { estado: ['Pagada', 'Devuelta', 'Cancelada'] },
    sub: {
      detalles: { refs: { codigo_articulo: 'articulos' } },
      pagos: { enums: { metodo_pago: METODOS_PAGO } },
      comprobante: { enums: { tipo: ['Ticket', 'Factura'] } },
    },
  },
  devoluciones: {
    titulo: (d) => `Devolución #${d._id}`,
    refs: { folio_venta: 'ventas', numero_empleado: 'empleados' },
    enums: { estado: ['Aprobada', 'Rechazada', 'Pendiente'] },
    sub: { detalles: { refs: { codigo_articulo: 'articulos' } } },
  },
  categorias: { titulo: (d) => d.nombre },
  articulos: {
    titulo: (d) => d.nombre,
    refs: { codigo_categoria: 'categorias' },
    enums: { estado: ['Activo', 'Descontinuado'] },
  },
  almacenes: { titulo: (d) => d.nombre },
  inventario: {
    titulo: (d) => `Inventario #${d._id}`,
    refs: { codigo_articulo: 'articulos', codigo_almacen: 'almacenes' },
  },
  mermas: {
    titulo: (d) => `Merma #${d._id}`,
    refs: { codigo_articulo: 'articulos', numero_empleado: 'empleados' },
  },
  proveedores: { titulo: (d) => d.razon_social },
  pedidos: {
    titulo: (d) => `Pedido #${d._id}`,
    refs: { codigo_proveedor: 'proveedores' },
    enums: { estado: ['Pendiente', 'En tránsito', 'Recibido', 'Cancelado'] },
    sub: {
      detalles: { refs: { codigo_articulo: 'articulos' } },
      entregas: { refs: { codigo_almacen: 'almacenes' }, enums: { estatus: ['Programada', 'Parcial', 'Completa'] } },
    },
  },
};

export const tituloDe = (coleccion, doc) => ADMIN[coleccion]?.titulo?.(doc) ?? String(doc._id);

/**
 * Referencias inversas: quién apunta a cada colección.
 * p. ej. articulos <- ventas.detalles.codigo_articulo, inventario.codigo_articulo, mermas.codigo_articulo...
 * Se usa para no borrar algo que está en uso.
 */
export function referenciasA(destino) {
  const lista = [];
  for (const [coleccion, cfg] of Object.entries(ADMIN)) {
    for (const [campo, d] of Object.entries(cfg.refs ?? {})) {
      if (d === destino) lista.push({ coleccion, ruta: campo });
    }
    for (const [sub, subCfg] of Object.entries(cfg.sub ?? {})) {
      for (const [campo, d] of Object.entries(subCfg.refs ?? {})) {
        if (d === destino) lista.push({ coleccion, ruta: `${sub}.${campo}` });
      }
    }
  }
  return lista;
}
