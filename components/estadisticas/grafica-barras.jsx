'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';

/**
 * Columnas de una sola serie sobre las cubetas del periodo.
 * Specs: barras <= 24px con extremo redondeado de 4px, rejilla horizontal fina y sólida,
 * tooltip por barra. Una sola serie: sin leyenda (el título de la tarjeta la nombra).
 */
export function GraficaBarras({ data, dataKey, label, color, formatValue, formatAxis, extra, onBarClick }) {
  const config = { [dataKey]: { label, color } };
  const clickable = Boolean(onBarClick);

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={6} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatAxis}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload;
            return (
              <div className="grid min-w-40 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                <p className="font-medium">{row.detalle}</p>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2.5 rounded-[2px]" style={{ background: `var(--color-${dataKey})` }} />
                    {label}
                  </span>
                  <span className="font-mono font-medium tabular-nums">{formatValue(row[dataKey])}</span>
                </div>
                {extra?.(row)}
                {clickable && row[dataKey] > 0 && <p className="pt-1 text-muted-foreground">Clic para ver el detalle</p>}
              </div>
            );
          }}
        />
        <Bar
          animationDuration={350}
          dataKey={dataKey}
          fill={`var(--color-${dataKey})`}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          className={clickable ? 'cursor-pointer' : undefined}
          onClick={clickable ? (entry) => onBarClick(entry.payload ?? entry) : undefined}
        />
      </BarChart>
    </ChartContainer>
  );
}

export const ejeDinero = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `$${v}`);
