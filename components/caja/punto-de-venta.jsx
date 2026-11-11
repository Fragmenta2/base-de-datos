'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRightIcon,
  BanknoteIcon,
  CreditCardIcon,
  MinusIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  ShoppingCartIcon,
  TicketIcon,
  LockOpenIcon,
  Trash2Icon,
  UserXIcon,
  WalletCardsIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import * as api from '@/lib/api';
import { TicketVenta } from './ticket-venta';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';

const ICONOS_PAGO = {
  Efectivo: BanknoteIcon,
  'Tarjeta de débito': CreditCardIcon,
  'Tarjeta de crédito': WalletCardsIcon,
  Transferencia: ArrowLeftRightIcon,
  'Vales de despensa': TicketIcon,
};
const ETIQUETA_PAGO = {
  Efectivo: 'Efectivo',
  'Tarjeta de débito': 'Débito',
  'Tarjeta de crédito': 'Crédito',
  Transferencia: 'Transfer.',
  'Vales de despensa': 'Vales',
};
const STOCK_BAJO = 10;
// Margen derecho igual al del texto de un <Input> (px-2.5 + 1px de borde) para alinear montos
const MONTO = 'pr-[11px] tabular-nums';
// Oculta las flechas de los campos numéricos (empujan el texto y rompen la alineación)
const SIN_FLECHAS =
  'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const round2 = (n) => Math.round(n * 100) / 100;

const esActivo = (c) => c?.estatus === 'Activo';
// Al elegir automáticamente: primero un cajero activo con turno abierto, luego cualquier activo
const sugerir = (lista) => lista.find((c) => esActivo(c) && c.turno) ?? lista.find(esActivo);

export function PuntoDeVenta({
  articulos,
  categorias,
  cajeros: cajerosIniciales,
  cajasLibres,
  metodos,
  saldoInicial,
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [carrito, setCarrito] = useState([]); // [{ codigo, cantidad }]
  // Estatus de los cajeros en tiempo real (mismo canal que la vista de Empleados)
  const [estatusVivo, setEstatusVivo] = useState(() => new Map());
  const cajeros = useMemo(
    () =>
      cajerosIniciales
        .map((c) => ({ ...c, estatus: estatusVivo.get(c._id) ?? c.estatus }))
        .sort((a, b) => Number(esActivo(b)) - Number(esActivo(a))), // activos primero
    [cajerosIniciales, estatusVivo]
  );
  const sugerido = sugerir(cajeros);
  const [cajeroId, setCajeroId] = useState(sugerido ? String(sugerido._id) : '');
  const [cajaNueva, setCajaNueva] = useState(cajasLibres[0] ? String(cajasLibres[0]._id) : '');
  const [fondo, setFondo] = useState(String(saldoInicial));
  const [abriendo, setAbriendo] = useState(false);
  const [descuento, setDescuento] = useState('');
  const [metodo, setMetodo] = useState(metodos[0]);
  const [recibido, setRecibido] = useState('');
  const [tipo, setTipo] = useState('Ticket');
  const [cobrando, setCobrando] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState(null);

  useEffect(() => {
    const es = new EventSource('/api/empleados/stream');
    es.addEventListener('empleados', (ev) => {
      setEstatusVivo(new Map(JSON.parse(ev.data).map((e) => [e._id, e.estatus])));
    });
    return () => es.close();
  }, []);

  // Si el cajero elegido deja de estar activo, se pasa al siguiente activo
  const cajero = cajeros.find((c) => String(c._id) === cajeroId);
  const turnoActual = cajero?.turno ?? null;
  useEffect(() => {
    if (cajero && !esActivo(cajero)) {
      setCajeroId(sugerido ? String(sugerido._id) : '');
      toast.warning(`${cajero.nombre} ya no puede cobrar`, {
        description: `Su estatus cambió a ${cajero.estatus}. ${sugerido ? `Se seleccionó a ${sugerido.nombre}` : 'No hay otro cajero activo'}`,
      });
    } else if (!cajeroId && sugerido) {
      setCajeroId(String(sugerido._id));
      toast.info(`${sugerido.nombre} está disponible para cobrar`);
    }
  }, [cajero, sugerido, cajeroId]);

  // La lista de cajas libres cambia al abrir un turno: mantener una opción válida
  useEffect(() => {
    if (!cajasLibres.some((c) => String(c._id) === cajaNueva)) {
      setCajaNueva(cajasLibres[0] ? String(cajasLibres[0]._id) : '');
    }
  }, [cajasLibres, cajaNueva]);

  async function abrirTurno() {
    setAbriendo(true);
    const id = toast.loading('Abriendo turno…');
    try {
      const t = await api.abrirTurno({ numero_empleado: cajero._id, numero_caja: cajaNueva, saldo_inicial: fondo });
      toast.success(`Turno #${t._id} abierto`, {
        id,
        description: `Caja ${t.numero_caja} · ${cajero.nombre} · Fondo ${formatMoney(t.saldo_inicial)}`,
      });
      router.refresh(); // trae el turno nuevo y actualiza las cajas libres
    } catch (err) {
      toast.error('No se pudo abrir el turno', { id, description: err.message });
    } finally {
      setAbriendo(false);
    }
  }

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
        numero_turno: turnoActual._id,
        items: carrito.map((l) => ({ codigo_articulo: l.codigo, cantidad: l.cantidad })),
        descuento: desc,
        metodo_pago: metodo,
        tipo_comprobante: tipo,
        recibido: metodo === 'Efectivo' && recibido !== '' ? Number(recibido) : undefined,
      });

      toast.success(`Venta #${venta._id} registrada`, {
        id,
        description: `${venta.comprobante.folio} · ${formatMoney(venta.total)}${cambio > 0 ? ` · Cambio ${formatMoney(cambio)}` : ''}`,
      });
      setUltimaVenta({
        venta,
        lineas: venta.detalles.map((d) => ({ ...d, nombre: porCodigo.get(d.codigo_articulo)?.nombre ?? d.codigo_articulo })),
        cajero: cajero.nombre,
        caja: turnoActual.numero_caja,
        cliente: 'Público en General',
        recibido: metodo === 'Efectivo' && recibido !== '' ? Number(recibido) : null,
        cambio,
      });
      limpiar();
      router.refresh(); // existencias actualizadas
    } catch (err) {
      toast.error('No se pudo registrar la venta', { id, description: err.message });
    } finally {
      setCobrando(false);
    }
  }

  const motivoBloqueo = !esActivo(cajero)
    ? 'Selecciona un cajero activo para cobrar'
    : !turnoActual
      ? 'Abre un turno para este cajero para poder cobrar'
      : cambio !== null && cambio < 0
        ? 'El monto recibido no cubre el total'
        : null;

  const puedeCobrar =
    carrito.length > 0 &&
    esActivo(cajero) &&
    turnoActual &&
    total > 0 &&
    !cobrando &&
    (metodo !== 'Efectivo' || recibido === '' || cambio >= 0);

  return (
    // En pantallas grandes la caja ocupa exactamente la ventana: header (3.5rem) + padding (3rem) + margen del inset (1rem).
    // Productos y ticket hacen scroll por dentro y el botón Cobrar queda siempre visible.
    <div className="grid gap-6 xl:h-[calc(100svh-7.5rem)] xl:min-h-[600px] xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* Catálogo */}
      <section className="flex min-h-0 min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Caja</h1>
            <p className="text-sm text-muted-foreground">
              {!cajero
                ? 'Ningún cajero activo'
                : turnoActual
                  ? `Caja ${turnoActual.numero_caja} · ${cajero.nombre}`
                  : `${cajero.nombre} · sin turno abierto`}
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

        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
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

        <div className="-m-2 min-h-0 flex-1 p-2 xl:overflow-y-auto">
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
        </div>
      </section>

      {/* Ticket: encabezado y pie fijos; en medio (cajero + artículos) es lo único que hace scroll */}
      <Card className="min-h-0 gap-0 py-0 xl:h-full">
        <CardHeader className="shrink-0 border-b py-4">
          <CardTitle className="flex items-center gap-2">
            <ReceiptIcon className="size-5" /> Ticket actual
          </CardTitle>
          <CardDescription>
            {piezas} {piezas === 1 ? 'artículo' : 'artículos'}
          </CardDescription>
          <CardAction>
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Tipo de comprobante">
              {['Ticket', 'Factura'].map((t) => (
                <Button
                  key={t}
                  size="xs"
                  variant={tipo === t ? 'default' : 'ghost'}
                  aria-pressed={tipo === t}
                  onClick={() => setTipo(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-3 py-4 xl:overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Cajero</Label>
            <Select value={cajeroId} onValueChange={setCajeroId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Ningún cajero activo" />
              </SelectTrigger>
              <SelectContent>
                {/* Todos los cajeros; solo se pueden elegir los que tienen estatus Activo */}
                {cajeros.map((c) => (
                  <SelectItem key={c._id} value={String(c._id)} disabled={!esActivo(c)}>
                    <span className={cn('size-2 shrink-0 rounded-full', esActivo(c) ? 'bg-success' : 'bg-muted-foreground/40')} />
                    {c.nombre}
                    <span className="text-xs text-muted-foreground">
                      {!esActivo(c) ? `(${c.estatus?.toLowerCase()})` : c.turno ? `· Caja ${c.turno.numero_caja}` : '· sin turno'}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!sugerido && (
              <p className="flex items-start gap-1.5 rounded-md bg-warning/15 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
                <UserXIcon className="mt-px size-3.5 shrink-0" />
                <span>
                  Ningún cajero tiene estatus Activo.{' '}
                  <Link href="/empleados" className="font-medium underline underline-offset-2">
                    Actívalo en Empleados
                  </Link>
                </span>
              </p>
            )}

            {/* Cajero activo sin turno: se le abre uno en una caja libre */}
            {esActivo(cajero) && !turnoActual && (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <p className="text-xs text-muted-foreground">
                  {cajero.nombre} no tiene un turno abierto. Ábrelo para poder cobrar.
                </p>
                {cajasLibres.length === 0 ? (
                  <p className="text-xs text-destructive">No hay cajas libres en estado “Abierta”.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Caja</Label>
                        <Select value={cajaNueva} onValueChange={setCajaNueva}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {cajasLibres.map((c) => (
                              <SelectItem key={c._id} value={String(c._id)}>
                                Caja {c._id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="fondo" className="text-xs">
                          Fondo inicial
                        </Label>
                        <Input id="fondo" type="number" min="0" step="0.01" value={fondo} onChange={(e) => setFondo(e.target.value)} />
                      </div>
                    </div>
                    <Button size="sm" className="w-full" disabled={!cajaNueva || abriendo} onClick={abrirTurno}>
                      <LockOpenIcon /> {abriendo ? 'Abriendo…' : 'Abrir turno'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Fuera de pantallas grandes la tarjeta no tiene altura fija: la lista lleva su propio límite y scroll */}
          <div className="max-h-80 overflow-y-auto xl:max-h-none xl:overflow-visible">
            {lineas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <ShoppingCartIcon className="size-8" />
                <p className="text-sm">Agrega productos al ticket</p>
              </div>
            ) : (
              <ul className="divide-y">
                {lineas.map((l) => (
                  <li key={l.codigo} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.articulo?.nombre}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {l.cantidad} × {formatMoney(l.articulo?.precio)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="outline" size="icon-xs" onClick={() => agregar(l.articulo, -1)} aria-label="Quitar uno">
                        <MinusIcon />
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{l.cantidad}</span>
                      <Button variant="outline" size="icon-xs" onClick={() => agregar(l.articulo, 1)} aria-label="Agregar uno">
                        <PlusIcon />
                      </Button>
                    </div>
                    <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">{formatMoney(l.importe)}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => agregar(l.articulo, -l.cantidad)}
                      aria-label="Eliminar"
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>

        {/* Pie fijo y compacto: siempre se ven subtotal, total, método de pago y el botón de cobrar */}
        <CardFooter className="shrink-0 flex-col items-stretch gap-3">
          {/* Los montos llevan el mismo margen derecho que el texto del input (padding + borde),
              así subtotal, descuento y total terminan en la misma línea */}
          <div className="space-y-1 text-sm">
            <div className="flex h-7 items-center justify-between gap-3">
              <span className="text-muted-foreground">Subtotal</span>
              <span className={MONTO}>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex h-7 items-center justify-between gap-3">
              <Label htmlFor="descuento" className="font-normal text-muted-foreground">
                Descuento
              </Label>
              <div className="relative w-32">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
                  −$
                </span>
                <Input
                  id="descuento"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={cn('h-7 w-full bg-background pl-7 text-right md:text-sm', SIN_FLECHAS)}
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                />
              </div>
            </div>
            <div className="flex h-8 items-center justify-between gap-3">
              <span className="font-medium">Total</span>
              <span className={cn(MONTO, 'text-xl font-semibold')}>{formatMoney(total)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-5 gap-1" role="group" aria-label="Método de pago">
              {metodos.map((m) => {
                const Icon = ICONOS_PAGO[m] ?? CreditCardIcon;
                const activo = metodo === m;
                return (
                  <button
                    key={m}
                    type="button"
                    title={m}
                    aria-label={m}
                    aria-pressed={activo}
                    onClick={() => setMetodo(m)}
                    className={cn(
                      'flex h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1 text-[11px] leading-none font-medium transition-colors',
                      activo
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="w-full truncate text-center">{ETIQUETA_PAGO[m] ?? m}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {metodo === 'Efectivo' && (
            <div className="flex items-center gap-3">
              <Label htmlFor="recibido" className="shrink-0">
                Recibido
              </Label>
              <Input
                id="recibido"
                type="number"
                min="0"
                step="0.01"
                placeholder={total.toFixed(2)}
                className={cn('h-8 min-w-0 flex-1 bg-background', SIN_FLECHAS)}
                value={recibido}
                onChange={(e) => setRecibido(e.target.value)}
              />
              <div className="shrink-0 text-right leading-tight">
                <p className="text-[11px] text-muted-foreground">Cambio</p>
                <p className={cn('font-semibold tabular-nums', cambio < 0 && 'text-destructive')}>
                  {cambio === null ? '—' : formatMoney(cambio)}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-14 w-14 shrink-0 bg-background"
              onClick={cancelar}
              disabled={carrito.length === 0 || cobrando}
              aria-label="Cancelar ticket"
              title="Cancelar ticket"
            >
              <Trash2Icon className="size-5" />
            </Button>
            <Button
              size="lg"
              className="h-14 min-w-0 flex-1 justify-between rounded-xl px-5 text-lg font-semibold shadow-md"
              disabled={!puedeCobrar}
              onClick={cobrar}
            >
              <span className="flex items-center gap-2">
                <ReceiptIcon className="size-5" /> {cobrando ? 'Cobrando…' : 'Cobrar'}
              </span>
              <span className="truncate text-2xl tabular-nums">{formatMoney(total)}</span>
            </Button>
          </div>
          {motivoBloqueo && carrito.length > 0 && (
            <p className="-mt-1 text-center text-xs text-muted-foreground">{motivoBloqueo}</p>
          )}
        </CardFooter>
      </Card>

      <TicketVenta ticket={ultimaVenta} onClose={() => setUltimaVenta(null)} />
    </div>
  );
}
