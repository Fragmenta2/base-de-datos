// Ticket de venta en PDF (solo servidor): se arma con los datos guardados en MongoDB,
// así cualquier venta se puede reimprimir igual que el día que se cobró.
import { jsPDF } from 'jspdf';
import { getDb } from './mongodb';
import { toPlain } from './pos';
import { formatFechaHora, formatMoney } from './format';

export async function getTicket(id) {
  const db = await getDb();
  const [v] = await db
    .collection('ventas')
    .aggregate([
      { $match: { _id: id } },
      { $lookup: { from: 'turnos', localField: 'numero_turno', foreignField: '_id', as: 't' } },
      { $lookup: { from: 'empleados', localField: 't.numero_empleado', foreignField: '_id', as: 'e' } },
      { $lookup: { from: 'clientes', localField: 'numero_socio', foreignField: '_id', as: 'c' } },
      { $lookup: { from: 'articulos', localField: 'detalles.codigo_articulo', foreignField: '_id', as: 'arts' } },
    ])
    .toArray();
  if (!v) return null;

  const venta = toPlain(v);
  const nombres = new Map(venta.arts.map((a) => [a._id, a.nombre]));
  const empleado = venta.e[0];
  return {
    venta,
    caja: venta.t[0]?.numero_caja ?? null,
    cajero: empleado ? `${empleado.nombre} ${empleado.apellidos}` : null,
    cliente: venta.c[0]?.nombre ?? 'Público en General',
    lineas: venta.detalles.map((d) => ({ ...d, nombre: nombres.get(d.codigo_articulo) ?? d.codigo_articulo })),
  };
}

// --- Diseño del ticket (mm) ---
const ANCHO = 80; // rollo de impresora térmica
const MARGEN = 5;
const UTIL = ANCHO - MARGEN * 2;
const PT_A_MM = 0.3528;
const alto = (size) => size * PT_A_MM * 1.35; // interlineado

function dibujar(doc, { venta, caja, cajero, cliente, lineas }) {
  let y = MARGEN + 2;

  const fuente = (size, bold = false) => {
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
  };
  const centro = (texto, size, bold) => {
    fuente(size, bold);
    y += alto(size);
    doc.text(texto, ANCHO / 2, y, { align: 'center' });
  };
  // Recorta un texto con "…" para que quepa en el ancho dado
  const ajustar = (texto, ancho) => {
    let t = String(texto);
    if (doc.getTextWidth(t) <= ancho) return t;
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > ancho) t = t.slice(0, -1);
    return `${t}…`;
  };
  // Etiqueta a la izquierda y valor alineado a la derecha
  const fila = (izq, der, size = 8.5, bold = false) => {
    fuente(size, bold);
    y += alto(size);
    const anchoDer = doc.getTextWidth(der);
    doc.text(ajustar(izq, UTIL - anchoDer - 2), MARGEN, y);
    doc.text(der, ANCHO - MARGEN, y, { align: 'right' });
  };
  const dato = (etiqueta, valor) => {
    fuente(8);
    y += alto(8);
    doc.text(etiqueta, MARGEN, y);
    const anchoEtiqueta = doc.getTextWidth(etiqueta);
    doc.text(ajustar(valor, UTIL - anchoEtiqueta - 2), ANCHO - MARGEN, y, { align: 'right' });
  };
  const separador = () => {
    y += 2.5;
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, y, ANCHO - MARGEN, y);
    doc.setLineDashPattern([], 0);
    y += 1;
  };

  // Encabezado
  centro('POS MINORISTA', 13, true);
  centro('Sistema de ventas', 8);
  y += 1;
  centro(`${venta.comprobante?.tipo ?? 'Ticket'} ${venta.comprobante?.folio ?? ''}`.trim(), 9, true);
  separador();

  // Datos de la venta
  dato('Venta', `#${venta._id}`);
  dato('Fecha', formatFechaHora(venta.fecha));
  if (caja !== null) dato('Caja', String(caja));
  if (cajero) dato('Atendió', cajero);
  dato('Cliente', cliente);
  separador();

  // Artículos: nombre completo (en varias líneas si hace falta) y debajo cantidad × precio = importe
  fila('ARTÍCULO', 'IMPORTE', 7.5, true);
  y += 0.8;
  for (const l of lineas) {
    fuente(8.5, true);
    for (const parte of doc.splitTextToSize(l.nombre, UTIL)) {
      y += alto(8.5);
      doc.text(parte, MARGEN, y);
    }
    fila(`  ${l.cantidad} × ${formatMoney(l.precio_unitario)}`, formatMoney(l.importe));
    y += 0.8;
  }
  separador();

  // Totales
  const piezas = lineas.reduce((s, l) => s + l.cantidad, 0);
  fila(`Subtotal (${piezas} ${piezas === 1 ? 'artículo' : 'artículos'})`, formatMoney(venta.subtotal));
  if (venta.descuento > 0) fila('Descuento', `-${formatMoney(venta.descuento)}`);
  y += 1;
  fila('TOTAL', formatMoney(venta.total), 12, true);
  separador();

  // Pago
  const pago = venta.pagos?.[0];
  if (pago) {
    fila('Forma de pago', pago.metodo_pago);
    if (pago.recibido) fila('Recibido', formatMoney(pago.recibido));
    if (pago.cambio) fila('Cambio', formatMoney(pago.cambio), 8.5, true);
  }
  separador();

  y += 1;
  centro('¡Gracias por su compra!', 9, true);
  centro('Conserve este ticket para cualquier aclaración', 6.5);
  return y + MARGEN;
}

/**
 * Genera el PDF del ticket. Primero se dibuja en una hoja de prueba para medir cuánto mide
 * y luego en una hoja con el alto exacto. `imprimir` hace que el visor abra el diálogo de impresión.
 */
export function generarTicketPdf(ticket, { imprimir = false } = {}) {
  const medida = new jsPDF({ unit: 'mm', format: [ANCHO, 1000], orientation: 'portrait' });
  const altura = Math.ceil(dibujar(medida, ticket));

  const doc = new jsPDF({ unit: 'mm', format: [ANCHO, Math.max(altura, ANCHO + 1)], orientation: 'portrait' });
  doc.setProperties({
    title: `Ticket ${ticket.venta.comprobante?.folio ?? ticket.venta._id}`,
    subject: `Venta #${ticket.venta._id}`,
    creator: 'POS Minorista',
  });
  dibujar(doc, ticket);
  if (imprimir) doc.autoPrint({ variant: 'javascript' }); // el visor del navegador abre el diálogo de impresión
  return new Uint8Array(doc.output('arraybuffer'));
}
