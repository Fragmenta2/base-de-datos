// Punto de venta: catálogo y registro de ventas (solo servidor)
import mongoose from 'mongoose';
import { getDb } from './mongodb';
import { InputError, toPlain } from './pos';

const { Decimal128 } = mongoose.mongo;

export const METODOS_PAGO = ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia', 'Vales de despensa'];
export const TIPOS_COMPROBANTE = ['Ticket', 'Factura'];
const RFC_PUBLICO_GENERAL = 'XAXX010101000';

const round2 = (n) => Math.round(n * 100) / 100;
const dec = (n) => Decimal128.fromString(n.toFixed(2));

// Hora local "de pared" guardada como UTC, igual que los datos del script de carga
const ahora = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);

export async function getCatalogo() {
  const db = await getDb();
  const [articulos, categorias, cajas] = await Promise.all([
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
    getCajeros(db),
  ]);
  return toPlain({ articulos, categorias, ...cajas });
}

// Roles que pueden cobrar: Cajero y Cajero senior (además de quien ya tenga un turno abierto)
export const ROLES_CAJERO = ['R02', 'R11'];
export const SALDO_INICIAL = 1000;

/**
 * Cajeros con su turno abierto (si tienen) y cajas libres para abrir uno nuevo.
 * Una caja está libre si su estado es "Abierta" y no tiene un turno abierto.
 */
async function getCajeros(db) {
  const turnosAbiertos = await db.collection('turnos').find({ estado: 'Abierto' }).toArray();
  const turnoDe = new Map(turnosAbiertos.map((t) => [t.numero_empleado, t]));

  const [empleados, cajas] = await Promise.all([
    db
      .collection('empleados')
      .aggregate([
        { $match: { $or: [{ codigo_rol: { $in: ROLES_CAJERO } }, { _id: { $in: [...turnoDe.keys()] } }] } },
        { $lookup: { from: 'roles', localField: 'codigo_rol', foreignField: '_id', as: 'r' } },
        { $project: { nombre: 1, apellidos: 1, estatus: 1, rol: { $first: '$r.nombre' } } },
        { $sort: { nombre: 1 } },
      ])
      .toArray(),
    db.collection('cajas').find({ estado: 'Abierta' }).sort({ _id: 1 }).toArray(),
  ]);

  const ocupadas = new Set(turnosAbiertos.map((t) => t.numero_caja));
  return {
    cajeros: empleados.map((e) => {
      const t = turnoDe.get(e._id);
      return {
        _id: e._id,
        nombre: `${e.nombre} ${e.apellidos}`,
        rol: e.rol,
        estatus: e.estatus,
        turno: t ? { _id: t._id, numero_caja: t.numero_caja, fecha_apertura: t.fecha_apertura } : null,
      };
    }),
    cajasLibres: cajas.filter((c) => !ocupadas.has(c._id)).map((c) => ({ _id: c._id, saldo_actual: c.saldo_actual })),
  };
}

/** Abre un turno para un cajero activo sin turno, en una caja libre. */
export async function abrirTurno(input) {
  const db = await getDb();
  const numeroEmpleado = Number(input.numero_empleado);
  const numeroCaja = Number(input.numero_caja);
  const saldoInicial = round2(Number(input.saldo_inicial ?? SALDO_INICIAL));
  if (!Number.isFinite(saldoInicial) || saldoInicial < 0) throw new InputError('El fondo inicial debe ser 0 o más');

  const empleado = await db.collection('empleados').findOne({ _id: numeroEmpleado });
  if (!empleado) throw new InputError('Empleado no encontrado');
  const nombre = `${empleado.nombre} ${empleado.apellidos}`;
  if (empleado.estatus !== 'Activo') throw new InputError(`El estatus de ${nombre} no es Activo`);
  if (await db.collection('turnos').findOne({ numero_empleado: numeroEmpleado, estado: 'Abierto' })) {
    throw new InputError(`${nombre} ya tiene un turno abierto`);
  }

  const caja = await db.collection('cajas').findOne({ _id: numeroCaja });
  if (!caja) throw new InputError('Caja no encontrada');
  if (caja.estado !== 'Abierta') throw new InputError(`La caja ${numeroCaja} está ${caja.estado.toLowerCase()}`);
  if (await db.collection('turnos').findOne({ numero_caja: numeroCaja, estado: 'Abierto' })) {
    throw new InputError(`La caja ${numeroCaja} ya tiene un turno abierto`);
  }

  // _id = máximo + 1; si otro proceso tomó el mismo, se reintenta
  for (let intento = 0; intento < 5; intento++) {
    const [ultimo] = await db.collection('turnos').find().sort({ _id: -1 }).limit(1).toArray();
    const turno = {
      _id: (ultimo?._id ?? 0) + 1,
      fecha_apertura: ahora(),
      fecha_cierre: null,
      saldo_inicial: dec(saldoInicial),
      saldo_final: null,
      estado: 'Abierto',
      numero_caja: numeroCaja,
      numero_empleado: numeroEmpleado,
      movimientos: [],
    };
    try {
      await db.collection('turnos').insertOne(turno);
      return toPlain(turno);
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  throw new Error('No se pudo abrir el turno, intenta de nuevo');
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

  // Solo un cajero activo puede cobrar
  const cajero = await db.collection('empleados').findOne({ _id: turno.numero_empleado });
  if (cajero?.estatus !== 'Activo') {
    const nombre = cajero ? `${cajero.nombre} ${cajero.apellidos}` : `El empleado ${turno.numero_empleado}`;
    throw new InputError(`El estatus de ${nombre} no es Activo; no se pueden registrar ventas en su turno`);
  }

  // La caja no pide cliente: la venta queda a nombre de "Público en General" (RFC genérico del SAT).
  // La API aún acepta numero_socio por si se quiere registrar a un cliente específico.
  let numeroSocio = null;
  if (input.numero_socio) {
    const cliente = await db.collection('clientes').findOne({ _id: Number(input.numero_socio) });
    if (!cliente) throw new InputError('Cliente no encontrado');
    numeroSocio = cliente._id;
  } else {
    const publico = await db.collection('clientes').findOne({ rfc: RFC_PUBLICO_GENERAL }, { projection: { _id: 1 } });
    numeroSocio = publico?._id ?? null;
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

  // En efectivo se guarda lo recibido y el cambio para poder reimprimir el ticket completo
  let efectivo = null;
  if (metodo === 'Efectivo' && input.recibido !== undefined && input.recibido !== null && input.recibido !== '') {
    const recibido = round2(Number(input.recibido));
    if (!Number.isFinite(recibido) || recibido < total) throw new InputError('El monto recibido no cubre el total');
    efectivo = { recibido: dec(recibido), cambio: dec(round2(recibido - total)) };
  }

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
      efectivo,
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
async function insertarVenta(db, { lineas, metodo, tipo, efectivo, ...venta }) {
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
      pagos: [
        // recibido/cambio son campos extra: el $jsonSchema de pagos no los prohíbe
        { folio_pago: (max.pago ?? 0) + 1, metodo_pago: metodo, monto: venta.total, fecha: venta.fecha, ...efectivo },
      ],
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
