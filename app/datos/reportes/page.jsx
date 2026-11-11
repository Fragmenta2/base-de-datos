import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { alertaReabasto, foliosVenta, ventasDetalladas, ventasPorMetodoPago } from '@/lib/reportes';
import { formatFechaHora, formatMoney } from '@/lib/format';

export const metadata = { title: 'Reportes' };

const DEFAULT_FACTOR = 1.5;

export default async function ReportesPage({ searchParams }) {
  const params = await searchParams;
  const folio = Number(params.venta) || null;
  const factor = Number(params.factor) > 0 ? Number(params.factor) : DEFAULT_FACTOR;

  const [ventas, folios, reabasto, porMetodo] = await Promise.all([
    ventasDetalladas(folio),
    foliosVenta(),
    alertaReabasto(factor),
    ventasPorMetodoPago(),
  ]);
  const granTotal = porMetodo.reduce((s, m) => s + m.total, 0);

  return (
    <>
      <PageHeader title="Reportes" description="Consultas de ejemplo de pos_minorista_mongodb.js" />

      {/* Formulario GET: los filtros viajan en la URL */}
      <form className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>Venta</Label>
          <Select name="venta" defaultValue={folio ? String(folio) : 'todas'}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {folios.map((f) => (
                <SelectItem key={f} value={String(f)}>
                  Venta {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="factor">Factor de stock mínimo</Label>
          <Input id="factor" name="factor" type="number" step="0.1" min="0.1" defaultValue={factor} className="w-40" />
        </div>
        <Button type="submit">Aplicar</Button>
      </form>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Ventas con cliente, cajero y artículos</CardTitle>
            <CardDescription>
              <code>$lookup</code> de ventas → clientes, turnos → empleados y artículos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead>Artículos</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((v) => (
                  <TableRow key={v._id}>
                    <TableCell className="font-medium">{v._id}</TableCell>
                    <TableCell>{formatFechaHora(v.fecha)}</TableCell>
                    <TableCell>{v.estado}</TableCell>
                    <TableCell>{v.cliente ?? '—'}</TableCell>
                    <TableCell>{v.cajero ?? '—'}</TableCell>
                    <TableCell className="max-w-64 truncate">{v.articulos?.join(', ') || '—'}</TableCell>
                    <TableCell>{v.comprobante ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>2. Alerta de reabasto</CardTitle>
              <CardDescription>
                Inventario con <code>cantidad_disponible &lt; stock_minimo × {factor}</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículo</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-right">Umbral</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reabasto.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell>{r.articulo}</TableCell>
                      <TableCell className="text-muted-foreground">{r.almacen}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.cantidad_disponible}</TableCell>
                      <TableCell className="text-right tabular-nums">{+(r.stock_minimo * factor).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {reabasto.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        Ningún artículo está por debajo de {factor} × su stock mínimo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Total vendido por método de pago</CardTitle>
              <CardDescription>
                <code>$unwind</code> de pagos y <code>$group</code> por método
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porMetodo.map((m) => (
                    <TableRow key={m._id}>
                      <TableCell>{m._id}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.ventas}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(m.total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {granTotal ? ((m.total / granTotal) * 100).toFixed(1) : '0.0'}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{porMetodo.reduce((s, m) => s + m.ventas, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(granTotal)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
