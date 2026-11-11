import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  CreditCardIcon,
  FileDownIcon,
  InfoIcon,
  PackageSearchIcon,
  ReceiptTextIcon,
  TrophyIcon,
} from 'lucide-react';
import { BarrasHorizontales } from '@/components/estadisticas/barras-horizontales';
import { PageHeader } from '@/components/page-header';
import { BotonImprimir } from '@/components/reportes/boton-imprimir';
import { Filtro } from '@/components/reportes/filtro';
import { Cifra, Conclusion, Reporte } from '@/components/reportes/reporte';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { alertaReabasto, foliosVenta, ventasDetalladas, ventasPorMetodoPago } from '@/lib/reportes';
import { formatFechaHora, formatInt, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Reportes' };

// Niveles de alerta en palabras; cada uno equivale a un múltiplo del stock mínimo
const NIVELES = {
  urgente: { factor: 1, label: 'Urgente: ya está debajo del mínimo' },
  pronto: { factor: 1.5, label: 'Pronto: cerca del mínimo' },
  preventivo: { factor: 3, label: 'Preventivo: revisión anticipada' },
};

const plural = (n, uno, varios) => `${formatInt(n)} ${n === 1 ? uno : varios}`;

export default async function ReportesPage({ searchParams }) {
  const params = await searchParams;
  const folio = Number(params.venta) || null;
  const nivel = NIVELES[params.nivel] ? params.nivel : 'pronto';
  const { factor } = NIVELES[nivel];

  const [ventas, folios, reabasto, porMetodo] = await Promise.all([
    ventasDetalladas(folio),
    foliosVenta(),
    alertaReabasto(factor),
    ventasPorMetodoPago(),
  ]);

  // Resumen de ventas
  const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
  const devueltas = ventas.filter((v) => v.estado === 'Devuelta').length;

  // Resumen de formas de pago
  const granTotal = porMetodo.reduce((s, m) => s + m.total, 0);
  const pct = (n) => (granTotal ? (n / granTotal) * 100 : 0);
  const masUsado = porMetodo[0];

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Resúmenes listos para consultar: qué se vendió, qué hay que reabastecer y cómo pagan los clientes."
      >
        <BotonImprimir />
      </PageHeader>

      <div className="space-y-6">
        {/* 1. Ventas */}
        <Reporte
          numero={1}
          icon={ReceiptTextIcon}
          titulo="Detalle de ventas"
          pregunta="¿Qué se vendió, a quién y quién lo atendió?"
          filtro={
            <Filtro
              name="venta"
              label="Mostrar"
              value={folio ? String(folio) : 'todas'}
              className="w-44"
              options={[
                { value: 'todas', label: 'Todas las ventas' },
                ...folios.map((f) => ({ value: String(f), label: `Solo la venta #${f}` })),
              ]}
            />
          }
          conclusion={
            <div className="grid gap-3 sm:grid-cols-4">
              <Cifra label="Ventas" value={formatInt(ventas.length)} />
              <Cifra label="Total vendido" value={formatMoney(totalVentas)} />
              <Cifra label="Promedio por venta" value={formatMoney(ventas.length ? totalVentas / ventas.length : 0)} />
              <Cifra label="Devueltas" value={formatInt(devueltas)} />
            </div>
          }
          tecnico={{
            explicacion:
              'Las ventas guardan solo los números de cliente, turno y artículos. Para mostrar nombres se "unen" con otras colecciones mediante $lookup, que es el equivalente de un JOIN en SQL.',
            consulta: `db.ventas.aggregate([
  { $lookup: { from: "clientes",  localField: "numero_socio",          foreignField: "_id", as: "cliente" } },
  { $lookup: { from: "turnos",    localField: "numero_turno",          foreignField: "_id", as: "turno" } },
  { $lookup: { from: "empleados", localField: "turno.numero_empleado", foreignField: "_id", as: "cajero" } },
  { $lookup: { from: "articulos", localField: "detalles.codigo_articulo", foreignField: "_id", as: "articulos" } }
])`,
          }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venta</TableHead>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Atendió</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.map((v) => (
                <TableRow key={v._id}>
                  <TableCell className="font-medium">
                    <a
                      href={`/api/ventas/${v._id}/ticket`}
                      target="_blank"
                      rel="noopener"
                      title="Ver ticket en PDF"
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                      #{v._id} <FileDownIcon className="size-3.5" />
                    </a>
                  </TableCell>
                  <TableCell>{formatFechaHora(v.fecha)}</TableCell>
                  <TableCell>{v.cliente ?? 'Público en general'}</TableCell>
                  <TableCell>{v.cajero ?? '—'}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {v.articulos?.length ? v.articulos.join(', ') : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.comprobante ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={v.estado === 'Devuelta' ? 'destructive' : 'secondary'}>{v.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(v.total)}</TableCell>
                </TableRow>
              ))}
              {ventas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                    No hay ventas registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Reporte>

        {/* 2. Reabasto */}
        <Reporte
          numero={2}
          icon={PackageSearchIcon}
          titulo="Productos por reabastecer"
          pregunta="¿Qué productos se están acabando y cuánto conviene pedir?"
          filtro={
            <Filtro
              name="nivel"
              label="Nivel de alerta"
              value={nivel}
              className="w-64"
              options={Object.entries(NIVELES).map(([value, n]) => ({ value, label: n.label }))}
            />
          }
          conclusion={
            reabasto.length === 0 ? (
              <Conclusion icon={CheckCircle2Icon} tono="bien">
                <strong>Todo en orden.</strong> Ningún producto entra en el nivel de alerta elegido. Si quieres
                anticiparte, cambia a <em>“Preventivo”</em>.
              </Conclusion>
            ) : (
              <Conclusion icon={AlertTriangleIcon} tono="alerta">
                <strong>{plural(reabasto.length, 'producto necesita', 'productos necesitan')} reabastecerse.</strong>{' '}
                La columna <em>“Sugerido pedir”</em> indica cuántas unidades faltan para llenar el almacén hasta su
                máximo.
              </Conclusion>
            )
          }
          tecnico={{
            explicacion: `Se buscan los registros de inventario cuya existencia es menor que el stock mínimo multiplicado por ${factor} (según el nivel elegido) y se agregan los nombres del artículo y del almacén.`,
            consulta: `db.inventario.find({
  $expr: { $lt: ["$cantidad_disponible", { $multiply: ["$stock_minimo", ${factor}] }] }
})`,
          }}
        >
          {reabasto.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Dónde está</TableHead>
                  <TableHead className="text-right">Hay</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Faltan para el mínimo</TableHead>
                  <TableHead className="text-right">Sugerido pedir</TableHead>
                  <TableHead>Situación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reabasto.map((r) => {
                  const faltan = Math.max(r.stock_minimo - r.cantidad_disponible, 0);
                  const agotado = r.cantidad_disponible <= 0;
                  const bajo = r.cantidad_disponible < r.stock_minimo;
                  const Icon = agotado ? CircleSlashIcon : AlertTriangleIcon;
                  return (
                    <TableRow key={r._id}>
                      <TableCell className="font-medium">{r.articulo ?? r.codigo_articulo}</TableCell>
                      <TableCell className="text-muted-foreground">{r.almacen}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatInt(r.cantidad_disponible)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(r.stock_minimo)}</TableCell>
                      <TableCell className="text-right tabular-nums">{faltan ? formatInt(faltan) : '—'}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatInt(Math.max(r.stock_maximo - r.cantidad_disponible, 0))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'gap-1',
                            bajo ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-amber-800 dark:text-amber-200'
                          )}
                        >
                          <Icon className="size-3" /> {agotado ? 'Agotado' : bajo ? 'Debajo del mínimo' : 'Cerca del mínimo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Reporte>

        {/* 3. Formas de pago */}
        <Reporte
          numero={3}
          icon={CreditCardIcon}
          titulo="¿Cómo pagan los clientes?"
          pregunta="¿Cuánto dinero entró por cada forma de pago?"
          conclusion={
            masUsado ? (
              <Conclusion icon={TrophyIcon}>
                La forma de pago que más dinero deja es <strong>{masUsado._id}</strong>:{' '}
                <strong>{formatMoney(masUsado.total)}</strong>, el {pct(masUsado.total).toFixed(0)}% de todo lo cobrado (
                {formatMoney(granTotal)}).
              </Conclusion>
            ) : (
              <Conclusion icon={InfoIcon}>Todavía no hay pagos registrados.</Conclusion>
            )
          }
          tecnico={{
            explicacion:
              'Cada venta guarda sus pagos dentro del mismo documento. $unwind separa cada pago y $group los suma por forma de pago.',
            consulta: `db.ventas.aggregate([
  { $unwind: "$pagos" },
  { $group: { _id: "$pagos.metodo_pago", total: { $sum: "$pagos.monto" }, ventas: { $sum: 1 } } },
  { $sort: { total: -1 } }
])`,
          }}
        >
          <BarrasHorizontales
            items={porMetodo.map((m) => ({ label: m._id, value: m.total, ventas: m.ventas }))}
            color="var(--chart-1)"
            formatValue={formatMoney}
            secundario={(i) => `${plural(i.ventas, 'venta', 'ventas')} · ${pct(i.value).toFixed(0)}%`}
          />
        </Reporte>
      </div>
    </>
  );
}
