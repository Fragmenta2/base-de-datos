'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangleIcon,
  ArchiveIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  DollarSignIcon,
  PackageIcon,
  SearchIcon,
  TrendingUpIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatFechaHora, formatInt, formatMoney } from '@/lib/format';

// Estado de existencias: siempre con ícono + texto, nunca solo color
const ESTADOS = {
  agotado: { label: 'Agotado', icon: CircleSlashIcon, className: 'bg-destructive/10 text-destructive', barra: 'bg-destructive' },
  bajo: { label: 'Bajo mínimo', icon: AlertTriangleIcon, className: 'bg-destructive/10 text-destructive', barra: 'bg-destructive' },
  reabastecer: { label: 'Reabastecer', icon: AlertTriangleIcon, className: 'bg-warning/15 text-amber-800 dark:text-amber-200', barra: 'bg-warning' },
  normal: { label: 'Normal', icon: CheckCircle2Icon, className: 'bg-success/10 text-success', barra: 'bg-success' },
  exceso: { label: 'Sobre máximo', icon: TrendingUpIcon, className: 'bg-primary/10 text-primary', barra: 'bg-primary' },
};
const FACTOR_REABASTO = 1.5; // igual que la consulta de ejemplo del script

function estadoDe(f) {
  if (f.cantidad_disponible <= 0) return 'agotado';
  if (f.cantidad_disponible < f.stock_minimo) return 'bajo';
  if (f.cantidad_disponible < f.stock_minimo * FACTOR_REABASTO) return 'reabastecer';
  if (f.cantidad_disponible > f.stock_maximo) return 'exceso';
  return 'normal';
}

export function InventarioView({ filas }) {
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [estado, setEstado] = useState('todos');

  const conEstado = useMemo(() => filas.map((f) => ({ ...f, estado: estadoDe(f), valor: f.cantidad_disponible * (f.precio ?? 0) })), [filas]);
  const categorias = useMemo(() => [...new Set(filas.map((f) => f.categoria).filter(Boolean))].sort(), [filas]);

  const visibles = conEstado.filter((f) => {
    const q = query.trim().toLowerCase();
    return (
      (categoria === 'todas' || f.categoria === categoria) &&
      (estado === 'todos' || f.estado === estado) &&
      (!q || [f.articulo, f.codigo_articulo, f.codigo_barras, f.almacen].some((v) => v?.toLowerCase().includes(q)))
    );
  });

  const unidades = conEstado.reduce((s, f) => s + f.cantidad_disponible, 0);
  const valor = conEstado.reduce((s, f) => s + f.valor, 0);
  const alertas = conEstado.filter((f) => ['agotado', 'bajo', 'reabastecer'].includes(f.estado)).length;

  return (
    <>
      <PageHeader title="Inventario" description="Existencias que quedan en cada almacén" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Artículos en inventario" value={formatInt(conEstado.length)} icon={ArchiveIcon} hint="Registros de inventario" />
        <StatCard title="Unidades disponibles" value={formatInt(unidades)} icon={PackageIcon} hint="Suma de todos los almacenes" />
        <StatCard title="Valor a precio de venta" value={formatMoney(valor)} icon={DollarSignIcon} hint="Disponible × precio" />
        <StatCard
          title="Alertas de stock"
          value={formatInt(alertas)}
          icon={AlertTriangleIcon}
          hint={`Por debajo de ${FACTOR_REABASTO}× el stock mínimo`}
          className={alertas > 0 ? 'border-warning/50' : undefined}
        />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative w-full sm:w-72">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar artículo, código o almacén…"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {Object.entries(ESTADOS).map(([k, e]) => (
                  <SelectItem key={k} value={k}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artículo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="w-56">Existencia</TableHead>
                <TableHead className="text-right">Mín / Máx</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((f) => {
                const e = ESTADOS[f.estado];
                const pct = Math.min((f.cantidad_disponible / f.stock_maximo) * 100, 100);
                return (
                  <TableRow key={f._id}>
                    <TableCell>
                      <p className="font-medium">{f.articulo ?? f.codigo_articulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.codigo_articulo} · {f.codigo_barras}
                        {f.estado_articulo && f.estado_articulo !== 'Activo' && ` · ${f.estado_articulo}`}
                      </p>
                    </TableCell>
                    <TableCell>{f.categoria ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{f.almacen ?? f.codigo_almacen}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-right font-semibold tabular-nums">{f.cantidad_disponible}</span>
                        <div className="relative h-2 flex-1 rounded-full bg-muted">
                          <div className={cn('h-full rounded-full', e.barra)} style={{ width: `${pct}%` }} />
                          {/* Marca del stock mínimo */}
                          <div
                            className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/40"
                            style={{ left: `${(f.stock_minimo / f.stock_maximo) * 100}%` }}
                            title={`Mínimo: ${f.stock_minimo}`}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {f.stock_minimo} / {f.stock_maximo}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(f.valor)}</TableCell>
                    <TableCell>
                      <Badge className={cn('gap-1', e.className)}>
                        <e.icon className="size-3" /> {e.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatFechaHora(f.fecha_actualizacion)}</TableCell>
                  </TableRow>
                );
              })}
              {visibles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
