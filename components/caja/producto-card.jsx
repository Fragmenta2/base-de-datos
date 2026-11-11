'use client';

import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

const STOCK_BAJO = 10;

/**
 * Tarjeta de un producto en la caja. Está memoizada: solo se vuelve a dibujar cuando cambia
 * su artículo (p. ej. sus existencias) o cuántas unidades lleva en el carrito, no cada vez que
 * cambia cualquier otra cosa del ticket. `onAgregar` debe ser una función estable.
 */
export const ProductoCard = memo(function ProductoCard({ articulo: a, enCarrito, onAgregar }) {
  const disponible = a.stock - enCarrito;
  const agotado = a.stock <= 0;

  return (
    <button
      type="button"
      disabled={agotado}
      onClick={() => onAgregar(a)}
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
          <Badge variant={disponible <= STOCK_BAJO ? 'destructive' : 'secondary'}>{disponible} disp.</Badge>
        )}
      </div>
    </button>
  );
});
