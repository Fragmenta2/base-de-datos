'use client';

import { AlertTriangleIcon, ClipboardListIcon, DollarSignIcon } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatFechaHora, formatInt, formatMoney } from '@/lib/format';
import { BarrasHorizontales } from './barras-horizontales';
import { PeriodoVacio, variacion } from './comun';
import { GraficaBarras } from './grafica-barras';

export function VistaMermas({ periodo, datos, onBarClick, ultimoDia, onIrA }) {
  const { serie, resumen, anterior, motivos, lista } = datos;
  const cambio = variacion(resumen.unidades, anterior.unidades);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardDescription>Unidades perdidas · {periodo.titulo}</CardDescription>
          <CardTitle className="text-5xl font-semibold tracking-tight">{formatInt(resumen.unidades)}</CardTitle>
          {cambio !== undefined && (
            <p className="text-sm text-muted-foreground">
              {/* En mermas, bajar es bueno */}
              <span className={cambio <= 0 ? 'font-medium text-success' : 'font-medium text-destructive'}>
                {cambio >= 0 ? '+' : ''}
                {cambio.toFixed(1)}%
              </span>{' '}
              vs. periodo anterior ({formatInt(anterior.unidades)} unidades)
            </p>
          )}
        </CardHeader>
        <CardContent>
          {resumen.registros === 0 ? (
            <PeriodoVacio texto="No hay mermas en este periodo" ultimoDia={ultimoDia} onIrA={onIrA} />
          ) : (
            <GraficaBarras
              data={serie}
              dataKey="unidades"
              label="Unidades"
              color="var(--chart-2)"
              formatValue={formatInt}
              formatAxis={formatInt}
              extra={(row) => (
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Costo estimado</span>
                  <span className="font-mono tabular-nums">{formatMoney(row.costo)}</span>
                </div>
              )}
              onBarClick={periodo.escala === 'dia' ? undefined : onBarClick}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Costo estimado"
          value={formatMoney(resumen.costo)}
          icon={DollarSignIcon}
          cambio={variacion(resumen.costo, anterior.costo)}
          invertir
          hint="Cantidad × precio de venta del artículo"
        />
        <StatCard
          title="Registros de merma"
          value={formatInt(resumen.registros)}
          icon={ClipboardListIcon}
          cambio={variacion(resumen.registros, anterior.registros)}
          invertir
          hint="Sin mermas en el periodo anterior"
        />
        <StatCard
          title="Motivo principal"
          value={motivos[0]?._id ?? '—'}
          icon={AlertTriangleIcon}
          hint={motivos[0] ? `${motivos[0].unidades} unidades` : 'Sin registros'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Por motivo</CardTitle>
            <CardDescription>Unidades perdidas</CardDescription>
          </CardHeader>
          <CardContent>
            <BarrasHorizontales
              items={motivos.map((m) => ({ label: m._id, value: m.unidades, costo: m.costo }))}
              color="var(--chart-2)"
              formatValue={formatInt}
              secundario={(i) => formatMoney(i.costo)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mermas del periodo</CardTitle>
            <CardDescription>{lista.length} registros</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Registró</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((m) => (
                  <TableRow key={m._id}>
                    <TableCell>{formatFechaHora(m.fecha, { hora: false })}</TableCell>
                    <TableCell className="font-medium">{m.articulo ?? m.codigo_articulo}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.cantidad}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.motivo}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.empleado ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(m.costo)}</TableCell>
                  </TableRow>
                ))}
                {lista.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      Sin mermas en este periodo
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
