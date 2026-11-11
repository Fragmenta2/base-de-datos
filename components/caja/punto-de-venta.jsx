'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRightIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  MinusIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  ShoppingCartIcon,
  TicketIcon,
  Trash2Icon,
  WalletCardsIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import * as api from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';

const ICONOS_PAGO = {
  Efectivo: BanknoteIcon,
  'Tarjeta de débito': CreditCardIcon,
  'Tarjeta de crédito': WalletCardsIcon,
  Transferencia: ArrowLeftRightIcon,
  'Vales de despensa': TicketIcon,
};
const STOCK_BAJO = 10;
const round2 = (n) => Math.round(n * 100) / 100;

export function PuntoDeVenta({ articulos, categorias, clientes, turnos, metodos }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [carrito, setCarrito] = useState([]); // [{ codigo, cantidad }]
  const [turno, setTurno] = useState(turnos[0] ? String(turnos[0]._id) : '');
  const [cliente, setCliente] = useState(clientes[0] ? String(clientes[0]._id) : '');
  const [descuento, setDescuento] = useState('');
  const [metodo, setMetodo] = useState(metodos[0]);
  const [recibido, setRecibido] = useState('');
  const [tipo, setTipo] = useState('Ticket');
  const [cobrando, setCobrando] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState(null);

  const porCodigo = useMemo(() => new Map(articulos.map((a) => [a._id, a])), [articulos]);

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articulos.filter(
      (a) =>
        (categoria === 'todas' || a.codigo_categoria === categoria) &&
        (!q || a.nombre.toLowerCase().includes(q) || a.codigo_barras.includes(q) || a._id.toLowerCase() === q)
    );
  }, [articulos, categoria, query]);

  const lineas = carrito.map((l) => {
    const a = porCodigo.get(l.codigo);
    return { ...l, articulo: a, importe: round2((a?.precio ?? 0) * l.cantidad) };
  });
  const subtotal = round2(lineas.reduce((s, l) => s + l.importe, 0));
  const desc = Math.min(Math.max(Number(descuento) || 0, 0), subtotal);
  const total = round2(subtotal - desc);
  const cambio = metodo === 'Efectivo' && recibido !== '' ? round2(Number(recibido) - total) : null;
  const piezas = carrito.reduce((s, l) => s + l.cantidad, 0);

  const cantidadEnCarrito = (codigo) => carrito.find((l) => l.codigo === codigo)?.cantidad ?? 0;

  function agregar(a, delta = 1) {
    const actual = cantidadEnCarrito(a._id);
    const nueva = actual + delta;
    if (nueva > a.stock) {
      toast.error('Stock insuficiente', { description: `Solo hay ${a.stock} unidades de ${a.nombre}` });
      return;
    }
    setCarrito((prev) =>
      nueva <= 0
        ? prev.filter((l) => l.codigo !== a._id)
        : actual === 0
          ? [...prev, { codigo: a._id, cantidad: nueva }]
          : prev.map((l) => (l.codigo === a._id ? { ...l, cantidad: nueva } : l))
    );
  }

  // Enter en el buscador: agrega por código de barras exacto o si solo hay un resultado
  function handleSearchKey(e) {
    if (e.key !== 'Enter') return;
    const q = query.trim();
    if (!q) return;
    const match = articulos.find((a) => a.codigo_barras === q) ?? (visibles.length === 1 ? visibles[0] : null);
    if (!match) {
      toast.error('Producto no encontrado', {
        description: visibles.length > 1 ? `"${q}" coincide con ${visibles.length} productos` : `No hay coincidencias para "${q}"`,
      });
      return;
    }
    if (match.stock > 0) agregar(match);
    else toast.error('Producto agotado', { description: match.nombre });
    setQuery('');
  }

  function limpiar() {
    setCarrito([]);
    setDescuento('');
    setRecibido('');
  }

  function cancelar() {
    limpiar();
    toast.info('Ticket cancelado');
  }

  async function cobrar() {
    setCobrando(true);
    const id = toast.loading('Registrando venta…');
    try {
      const venta = await api.registrarVenta({
        numero_turno: turno,
        numero_socio: cliente,
        items: carrito.map((l) => ({ codigo_articulo: l.codigo, cantidad: l.cantidad })),
        descuento: desc,
        metodo_pago: metodo,
        tipo_comprobante: tipo,
      });

      toast.success(`Venta #${venta._id} registrada`, {
        id,
        description: `${venta.comprobante.folio} · ${formatMoney(venta.total)}${cambio > 0 ? ` · Cambio ${formatMoney(cambio)}` : ''}`,
      });
      setUltimaVenta({ ...venta, cambio, piezas });
      limpiar();
      router.refresh(); // existencias actualizadas
    } catch (err) {
      toast.error('No se pudo registrar la venta', { id, description: err.message });
    } finally {
      setCobrando(false);
    }
  }

  const turnoActual = turnos.find((t) => String(t._id) === turno);
  const puedeCobrar =
    carrito.length > 0 && turno && total > 0 && !cobrando && (metodo !== 'Efectivo' || recibido === '' || cambio >= 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      {/* Catálogo */}
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Caja</h1>
            <p className="text-sm text-muted-foreground">
              {turnoActual
                ? `Caja ${turnoActual.numero_caja} · ${turnoActual.cajero}`
                : 'No hay turnos abiertos'}
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar o escanear código de barras…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKey}
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ _id: 'todas', nombre: 'Todas' }, ...categorias].map((c) => (
            <Button
              key={c._id}
              size="sm"
              variant={categoria === c._id ? 'default' : 'outline'}
              className="shrink-0 rounded-full"
              onClick={() => setCategoria(c._id)}
            >
              {c.nombre}
            </Button>
          ))}
        </div>

        {visibles.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
            <SearchIcon className="size-6" />
            <p className="text-sm">No hay productos que coincidan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
            {visibles.map((a) => {
              const enCarrito = cantidadEnCarrito(a._id);
              const disponible = a.stock - enCarrito;
              const agotado = a.stock <= 0;
              return (
                <button
                  key={a._id}
                  type="button"
                  disabled={agotado}
                  onClick={() => agregar(a)}
                  className={cn(
                    'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all',
                    'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
                    'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none',
                    enCarrito > 0 && 'border-primary ring-2 ring-primary/20'
                  )}
                >
                  {enCarrito > 0 && (
                    <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {enCarrito}
                    </span>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{a.categoria}</p>
                    <p className="line-clamp-2 leading-snug font-medium">{a.nombre}</p>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-2">
                    <span className="text-lg font-semibold">{formatMoney(a.precio)}</span>
                    {agotado ? (
                      <Badge variant="destructive">Agotado</Badge>
                    ) : (
                      <Badge variant={disponible <= STOCK_BAJO ? 'destructive' : 'secondary'}>
                        {disponible} disp.
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Ticket */}
      <Card className="h-fit xl:sticky xl:top-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptIcon className="size-5" /> Ticket actual
          </CardTitle>
          <CardDescription>
            {piezas} {piezas === 1 ? 'artículo' : 'artículos'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="space-y-1.5">
              <Label>Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin turnos abiertos" />
                </SelectTrigger>
                <SelectContent>
                  {turnos.map((t) => (
                    <SelectItem key={t._id} value={String(t._id)}>
                      Caja {t.numero_caja} · {t.cajero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c._id} value={String(c._id)}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {lineas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <ShoppingCartIcon className="size-8" />
              <p className="text-sm">Agrega productos al ticket</p>
            </div>
          ) : (
            <ScrollArea className="max-h-72 pr-3">
              <ul className="space-y-3">
                {lineas.map((l) => (
                  <li key={l.codigo} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.articulo?.nombre}</p>
                      <p className="text-xs text-muted-foreground">{formatMoney(l.articulo?.precio)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon-xs" onClick={() => agregar(l.articulo, -1)} aria-label="Quitar uno">
                        <MinusIcon />
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{l.cantidad}</span>
                      <Button variant="outline" size="icon-xs" onClick={() => agregar(l.articulo, 1)} aria-label="Agregar uno">
                        <PlusIcon />
                      </Button>
                    </div>
                    <span className="w-20 text-right text-sm font-medium tabular-nums">{formatMoney(l.importe)}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => agregar(l.articulo, -l.cantidad)}
                      aria-label="Eliminar"
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Descuento</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="h-7 w-28 text-right"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
              />
            </div>
            <div className="flex items-end justify-between pt-2">
              <span className="font-medium">Total</span>
              <span className="text-3xl font-semibold">{formatMoney(total)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-2 gap-2">
              {metodos.map((m) => {
                const Icon = ICONOS_PAGO[m] ?? CreditCardIcon;
                return (
                  <Button
                    key={m}
                    variant={metodo === m ? 'default' : 'outline'}
                    className={cn('justify-start', m === 'Efectivo' && 'col-span-2')}
                    onClick={() => setMetodo(m)}
                  >
                    <Icon /> {m}
                  </Button>
                );
              })}
            </div>
          </div>

          {metodo === 'Efectivo' && (
            <div className="grid grid-cols-2 items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="recibido">Recibido</Label>
                <Input
                  id="recibido"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={total.toFixed(2)}
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                />
              </div>
              <div className="pb-1.5 text-right">
                <p className="text-xs text-muted-foreground">Cambio</p>
                <p className={cn('text-lg font-semibold tabular-nums', cambio < 0 && 'text-destructive')}>
                  {cambio === null ? '—' : formatMoney(cambio)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Comprobante</Label>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {['Ticket', 'Factura'].map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tipo === t ? 'default' : 'ghost'}
                  className="h-6"
                  onClick={() => setTipo(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={cancelar} disabled={carrito.length === 0 || cobrando}>
            Cancelar
          </Button>
          <Button className="h-10 flex-1 text-base" disabled={!puedeCobrar} onClick={cobrar}>
            {cobrando ? 'Cobrando…' : `Cobrar ${formatMoney(total)}`}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={!!ultimaVenta} onOpenChange={(open) => !open && setUltimaVenta(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <CheckCircle2Icon className="size-12 text-success" />
            <DialogTitle>Venta registrada</DialogTitle>
            <DialogDescription>
              Venta #{ultimaVenta?._id} · {ultimaVenta?.comprobante?.folio}
            </DialogDescription>
          </DialogHeader>
          {ultimaVenta && (
            <dl className="space-y-2 rounded-lg bg-muted p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Artículos</dt>
                <dd>{ultimaVenta.piezas}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pago</dt>
                <dd>{ultimaVenta.pagos?.[0]?.metodo_pago}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(ultimaVenta.total)}</dd>
              </div>
              {ultimaVenta.cambio > 0 && (
                <div className="flex justify-between text-base font-semibold text-success">
                  <dt>Cambio</dt>
                  <dd>{formatMoney(ultimaVenta.cambio)}</dd>
                </div>
              )}
            </dl>
          )}
          <DialogFooter>
            <Button className="w-full" onClick={() => setUltimaVenta(null)}>
              Nueva venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
