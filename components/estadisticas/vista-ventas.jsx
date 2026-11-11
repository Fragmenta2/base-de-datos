'use client';

import { PackageIcon, ReceiptIcon, ShoppingBagIcon } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatFechaHora, formatInt, formatMoney } from '@/lib/format';
import { BarrasHorizontales } from './barras-horizontales';
import { PeriodoVacio, variacion } from './comun';
import { GraficaBarras, ejeDinero } from './grafica-barras';

export function VistaVentas({ periodo, datos, onBarClick, ultimoDia, onIrA }) {
  const { serie, resumen, anterior, metodos, top, lista } = datos;
  const cambio = variacion(resumen.ingresos, anterior.ingresos);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardDescription>Ingresos · {periodo.titulo}</CardDescription>
          {/* Cifra principal de la vista */}
          <CardTitle className="text-5xl font-semibold tracking-tight">{formatMoney(resumen.ingresos)}</CardTitle>
          {cambio !== undefined && (
            <p className="text-sm text-muted-foreground">
              <span className={cambio >= 0 ? 'font-medium text-success' : 'font-medium text-destructive'}>
                {cambio >= 0 ? '+' : ''}
                {cambio.toFixed(1)}%
              </span>{' '}
              vs. periodo anterior ({formatMoney(anterior.ingresos)})
            </p>
          )}
        </CardHeader>
        <CardContent>
          {resumen.ventas === 0 ? (
            <PeriodoVacio texto="No hay ventas en este periodo" ultimoDia={ultimoDia} onIrA={onIrA} />
          ) : (
            <GraficaBarras
              data={serie}
              dataKey="ingresos"
              label="Ingresos"
              color="var(--chart-1)"
              formatValue={formatMoney}
              formatAxis={ejeDinero}
              extra={(row) => (
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Ventas</span>
                  <span className="font-mono tabular-nums">{row.ventas}</span>
                </div>
              )}
              onBarClick={periodo.escala === 'dia' ? undefined : onBarClick}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Ventas"
          value={formatInt(resumen.ventas)}
          icon={ReceiptIcon}
          cambio={variacion(resumen.ventas, anterior.ventas)}
          hint="Sin ventas en el periodo anterior"
        />
        <StatCard
          title="Ticket promedio"
          value={formatMoney(resumen.ticketPromedio)}
          icon={ShoppingBagIcon}
          cambio={variacion(resumen.ticketPromedio, anterior.ticketPromedio)}
          hint="Sin ventas en el periodo anterior"
        />
        <StatCard
          title="Artículos vendidos"
          value={formatInt(resumen.articulos)}
          icon={PackageIcon}
          cambio={variacion(resumen.articulos, anterior.articulos)}
          hint="Sin ventas en el periodo anterior"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Métodos de pago</CardTitle>
            <CardDescription>Total cobrado por método</CardDescription>
          </CardHeader>
          <CardContent>
            <BarrasHorizontales
              items={metodos.map((m) => ({ label: m._id, value: m.total, ventas: m.ventas }))}
              color="var(--chart-1)"
              formatValue={formatMoney}
              secundario={(i) => `${i.ventas} ${i.ventas === 1 ? 'venta' : 'ventas'}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>Top 5 por importe</CardDescription>
          </CardHeader>
          <CardContent>
            <BarrasHorizontales
              items={top.map((t) => ({ label: t.nombre ?? t._id, value: t.importe, cantidad: t.cantidad }))}
              color="var(--chart-1)"
              formatValue={formatMoney}
              secundario={(i) => `${i.cantidad} pzas`}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas del periodo</CardTitle>
          <CardDescription>{lista.length} registros</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Artículos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((v) => (
                <TableRow key={v._id}>
                  <TableCell className="font-medium">
                    #{v._id}
                    <span className="ml-2 text-xs text-muted-foreground">{v.folio}</span>
                  </TableCell>
                  <TableCell>{formatFechaHora(v.fecha)}</TableCell>
                  <TableCell>{v.cliente ?? '—'}</TableCell>
                  <TableCell>{v.metodo ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.articulos}</TableCell>
                  <TableCell>
                    <Badge variant={v.estado === 'Pagada' ? 'secondary' : 'destructive'}>{v.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(v.total)}</TableCell>
                </TableRow>
              ))}
              {lista.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    Sin ventas en este periodo
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
