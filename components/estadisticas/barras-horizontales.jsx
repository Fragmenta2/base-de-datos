// Barras horizontales de magnitud (un solo tono) con la etiqueta y el valor siempre visibles
export function BarrasHorizontales({ items, color, formatValue, secundario }) {
  const max = Math.max(...items.map((i) => i.value), 0);

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin datos en este periodo</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatValue(item.value)}
              {secundario && <span className="ml-2 text-xs font-normal text-muted-foreground">{secundario(item)}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${max ? (item.value / max) * 100 : 0}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
