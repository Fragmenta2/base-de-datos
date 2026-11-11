import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Tarjeta de indicador. `cambio` es la variación (%) contra el periodo anterior;
 * `invertir` marca como bueno un descenso (p. ej. mermas).
 */
export function StatCard({ title, value, icon: Icon, cambio, invertir = false, hint, className }) {
  const hayCambio = Number.isFinite(cambio);
  const bueno = hayCambio && (invertir ? cambio <= 0 : cambio >= 0);
  const Trend = cambio >= 0 ? TrendingUpIcon : TrendingDownIcon;

  return (
    <Card className={cn('gap-2', className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardDescription>{title}</CardDescription>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="space-y-1">
        <CardTitle className="text-2xl font-semibold">{value}</CardTitle>
        {hayCambio ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Trend className={cn('size-3.5', bueno ? 'text-success' : 'text-destructive')} />
            <span className={cn('font-medium', bueno ? 'text-success' : 'text-destructive')}>
              {cambio >= 0 ? '+' : ''}
              {cambio.toFixed(1)}%
            </span>
            vs. periodo anterior
          </p>
        ) : (
          hint && <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
