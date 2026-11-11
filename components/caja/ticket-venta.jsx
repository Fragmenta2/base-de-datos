'use client';

import { useState } from 'react';
import { CheckCircle2Icon, DownloadIcon, PrinterIcon, StoreIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatFechaHora, formatMoney, NOMBRE_APP } from '@/lib/format';

/**
 * Comprobante de una venta recién cobrada, con el desglose de cada artículo.
 * `ticket` = { venta, lineas: [{ nombre, cantidad, precio_unitario, importe }], cajero, caja, cliente, recibido, cambio }
 */
export function TicketVenta({ ticket: ticketActual, onClose, onCloseAutoFocus }) {
  // Se conserva el último ticket mientras el diálogo hace su animación de salida;
  // si no, el contenido desaparece de golpe y el diálogo se encoge vacío antes de cerrarse.
  const [ultimo, setUltimo] = useState(ticketActual);
  if (ticketActual && ticketActual !== ultimo) setUltimo(ticketActual);
  const ticket = ticketActual ?? ultimo;

  const venta = ticket?.venta;
  const piezas = ticket?.lineas.reduce((s, l) => s + l.cantidad, 0) ?? 0;

  return (
    <Dialog open={!!ticketActual} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader className="items-center text-center">
          <CheckCircle2Icon className="size-10 text-success" />
          <DialogTitle>Venta registrada</DialogTitle>
          <DialogDescription>Este es el desglose de la compra.</DialogDescription>
        </DialogHeader>

        {venta && (
          <div className="rounded-lg border bg-background p-5 font-mono text-[13px] leading-relaxed">
            <div className="flex flex-col items-center gap-1 text-center">
              <StoreIcon className="size-6" />
              <p className="text-sm leading-snug font-bold tracking-wide uppercase">{NOMBRE_APP}</p>
              <p className="text-xs text-muted-foreground">
                {venta.comprobante.tipo} {venta.comprobante.folio}
              </p>
            </div>

            <Separador />

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
              <dt className="text-muted-foreground">Venta</dt>
              <dd className="text-right">#{venta._id}</dd>
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="text-right">{formatFechaHora(venta.fecha)}</dd>
              <dt className="text-muted-foreground">Caja</dt>
              <dd className="text-right">{ticket.caja}</dd>
              <dt className="text-muted-foreground">Atendió</dt>
              <dd className="truncate text-right">{ticket.cajero}</dd>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="truncate text-right">{ticket.cliente ?? 'Público en general'}</dd>
            </dl>

            <Separador />

            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Artículo</span>
              <span>Importe</span>
            </div>
            <ul className="space-y-2">
              {ticket.lineas.map((l, i) => (
                <li key={i}>
                  <p className="font-medium">{l.nombre}</p>
                  <p className="flex justify-between text-muted-foreground">
                    <span>
                      {l.cantidad} × {formatMoney(l.precio_unitario)}
                    </span>
                    <span className="text-foreground">{formatMoney(l.importe)}</span>
                  </p>
                </li>
              ))}
            </ul>

            <Separador />

            <dl className="space-y-1">
              <Fila label={`Subtotal (${piezas} ${piezas === 1 ? 'artículo' : 'artículos'})`} value={formatMoney(venta.subtotal)} />
              {venta.descuento > 0 && <Fila label="Descuento" value={`-${formatMoney(venta.descuento)}`} />}
              <div className="flex items-baseline justify-between pt-1 text-base font-bold">
                <dt>TOTAL</dt>
                <dd>{formatMoney(venta.total)}</dd>
              </div>
            </dl>

            <Separador />

            <dl className="space-y-1">
              <Fila label="Forma de pago" value={venta.pagos[0]?.metodo_pago} />
              {ticket.recibido > 0 && <Fila label="Recibido" value={formatMoney(ticket.recibido)} />}
              {ticket.cambio > 0 && <Fila label="Cambio" value={formatMoney(ticket.cambio)} strong />}
            </dl>

            <Separador />
            <p className="text-center text-xs text-muted-foreground">¡Gracias por su compra!</p>
          </div>
        )}

        {/* El PDF se genera en el servidor con los datos guardados de la venta (80 mm, listo para impresora de tickets) */}
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button variant="outline" asChild disabled={!venta}>
            <a href={venta ? `/api/ventas/${venta._id}/ticket?imprimir=1` : undefined} target="_blank" rel="noopener">
              <PrinterIcon /> Imprimir PDF
            </a>
          </Button>
          <Button variant="outline" asChild disabled={!venta}>
            <a href={venta ? `/api/ventas/${venta._id}/ticket?descargar=1` : undefined} download>
              <DownloadIcon /> Descargar PDF
            </a>
          </Button>
          <Button className="col-span-2" onClick={onClose}>
            Nueva venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Separador() {
  return <div className="my-3 border-t border-dashed border-foreground/30" />;
}

function Fila({ label, value, strong }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-bold' : ''}`}>
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
