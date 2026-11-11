// Punto de venta: catálogo y registro de ventas (solo servidor)
import mongoose from 'mongoose';
import { getDb } from './mongodb';
import { InputError, toPlain } from './pos';

const { Decimal128 } = mongoose.mongo;

export const METODOS_PAGO = ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia', 'Vales de despensa'];
export const TIPOS_COMPROBANTE = ['Ticket', 'Factura'];

const round2 = (n) => Math.round(n * 100) / 100;
const dec = (n) => Decimal128.fromString(n.toFixed(2));

// Hora local "de pared" guardada como UTC, igual que los datos del script de carga
const ahora = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);

export async function getCatalogo() {
  const db = await getDb();
  const [articulos, categorias, clientes, turnos] = await Promise.all([
    db
      .collection('articulos')
      .aggregate([
        { $match: { estado: 'Activo' } },
        { $lookup: { from: 'inventario', localField: '_id', foreignField: 'codigo_articulo', as: 'inv' } },
        { $lookup: { from: 'categorias', localField: 'codigo_categoria', foreignField: '_id', as: 'cat' } },
        {
          $project: {
            nombre: 1,
            descripcion: 1,
            codigo_barras: 1,
            precio: 1,
            codigo_categoria: 1,
            categoria: { $first: '$cat.nombre' },
            stock: { $sum: '$inv.cantidad_disponible' },
          },
        },
        { $sort: { nombre: 1 } },
      ])
      .toArray(),
    db.collection('categorias').find().sort({ nombre: 1 }).toArray(),
    db.collection('clientes').find({}, { projection: { nombre: 1, rfc: 1 } }).sort({ _id: 1 }).toArray(),
    db
      .collection('turnos')
      .aggregate([
        { $match: { estado: 'Abierto' } },
        { $lookup: { from: 'empleados', localField: 'numero_empleado', foreignField: '_id', as: 'emp' } },
        {
          $project: {
            numero_caja: 1,
            fecha_apertura: 1,
            cajero: { $concat: [{ $first: '$emp.nombre' }, ' ', { $first: '$emp.apellidos' }] },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
  ]);
  return toPlain({ articulos, categorias, clientes, turnos });
}

/**
 * Registra una venta: valida precios y existencias contra la BD (nunca confía en el cliente),
 * descuenta el inventario y crea la venta con detalles, pago y comprobante embebidos.
 * MongoDB standalone no tiene transacciones, así que si algo falla se revierte el inventario a mano.
 */
export async function registrarVenta(input) {
  const db = await getDb();

  // Unificar renglones repetidos del mismo artículo
  const cantidades = new Map();
  for (const it of input.items ?? []) {
    const cantidad = Number(it.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new InputError('Cantidad inválida');
    cantidades.set(it.codigo_articulo, (cantidades.get(it.codigo_articulo) ?? 0) + cantidad);
  }
  if (cantidades.size === 0) throw new InputError('El ticket está vacío');

  const metodo = METODOS_PAGO.includes(input.metodo_pago) ? input.metodo_pago : null;
  if (!metodo) throw new InputError('Método de pago inválido');
  const tipo = TIPOS_COMPROBANTE.includes(input.tipo_comprobante) ? input.tipo_comprobante : 'Ticket';

  const turno = await db.collection('turnos').findOne({ _id: Number(input.numero_turno), estado: 'Abierto' });
  if (!turno) throw new InputError('Selecciona un turno abierto');

  let numeroSocio = null;
  if (input.numero_socio) {
    const cliente = await db.collection('clientes').findOne({ _id: Number(input.numero_socio) });
    if (!cliente) throw new InputError('Cliente no encontrado');
    numeroSocio = cliente._id;
  }

  const articulos = await db
    .collection('articulos')
    .find({ _id: { $in: [...cantidades.keys()] } })
    .toArray();
  const porCodigo = new Map(articulos.map((a) => [a._id, a]));

  const lineas = [...cantidades].map(([codigo, cantidad]) => {
    const a = porCodigo.get(codigo);
    if (!a || a.estado !== 'Activo') throw new InputError(`El artículo ${codigo} no está disponible`);
    const precio = Number(a.precio.toString());
    return { codigo, nombre: a.nombre, cantidad, precio, importe: round2(precio * cantidad) };
  });

  const subtotal = round2(lineas.reduce((s, l) => s + l.importe, 0));
  const descuento = round2(Number(input.descuento) || 0);
  if (descuento < 0 || descuento >= subtotal) throw new InputError('El descuento debe ser menor al subtotal');
  const total = round2(subtotal - descuento);

  const fecha = ahora();
  const descontados = [];
  try {
    for (const l of lineas) {
      const r = await db.collection('inventario').updateOne(
        { codigo_articulo: l.codigo, cantidad_disponible: { $gte: l.cantidad } },
        { $inc: { cantidad_disponible: -l.cantidad }, $set: { fecha_actualizacion: fecha } }
      );
      if (r.modifiedCount === 0) throw new InputError(`Stock insuficiente de ${l.nombre}`);
      descontados.push(l);
    }

    const venta = await insertarVenta(db, {
      fecha,
      estado: 'Pagada',
      subtotal: dec(subtotal),
      descuento: dec(descuento),
      total: dec(total),
      numero_turno: turno._id,
      numero_socio: numeroSocio,
      lineas,
      metodo,
      tipo,
    });

    if (metodo === 'Efectivo') {
      await db.collection('cajas').updateOne({ _id: turno.numero_caja }, { $inc: { saldo_actual: dec(total) } });
    }
    return toPlain(venta);
  } catch (err) {
    for (const l of descontados) {
      await db
        .collection('inventario')
        .updateOne({ codigo_articulo: l.codigo }, { $inc: { cantidad_disponible: l.cantidad } });
    }
    throw err;
  }
}

// Calcula los siguientes folios y reintenta si otra venta tomó los mismos (índices únicos)
async function insertarVenta(db, { lineas, metodo, tipo, ...venta }) {
  for (let intento = 0; intento < 5; intento++) {
    const [max = {}] = await db
      .collection('ventas')
      .aggregate([
        {
          $group: {
            _id: null,
            venta: { $max: '$_id' },
            detalle: { $max: { $max: '$detalles.folio_detalle_venta' } },
            pago: { $max: { $max: '$pagos.folio_pago' } },
            comprobante: { $max: '$comprobante.folio_comprobante' },
          },
        },
      ])
      .toArray();

    let folioDetalle = max.detalle ?? 0;
    const folioComprobante = (max.comprobante ?? 0) + 1;
    const doc = {
      _id: (max.venta ?? 0) + 1,
      ...venta,
      detalles: lineas.map((l) => ({
        folio_detalle_venta: ++folioDetalle,
        cantidad: l.cantidad,
        precio_unitario: dec(l.precio),
        descuento: dec(0),
        importe: dec(l.importe),
        codigo_articulo: l.codigo,
      })),
      pagos: [{ folio_pago: (max.pago ?? 0) + 1, metodo_pago: metodo, monto: venta.total, fecha: venta.fecha }],
      comprobante: {
        folio_comprobante: folioComprobante,
        tipo,
        folio: `${tipo === 'Factura' ? 'F' : 'T'}-${venta.fecha.getUTCFullYear()}-${String(folioComprobante).padStart(5, '0')}`,
        fecha_emision: venta.fecha,
      },
    };

    try {
      await db.collection('ventas').insertOne(doc);
      return doc;
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  throw new Error('No se pudo asignar folio a la venta, intenta de nuevo');
}
