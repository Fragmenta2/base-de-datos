import { fieldLabel, formatValue } from '@/lib/format';

// Documentos embebidos (detalles, pagos, comprobante, movimientos...) de un documento
export function EmbeddedView({ fields, doc }) {
  return (
    <div className="flex flex-wrap gap-6">
      {fields.map((f) => {
        const value = doc[f.key];
        const rows = f.kind === 'array' ? (value ?? []) : value ? [value] : [];
        return (
          <div key={f.key} className="space-y-2">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{fieldLabel(f.key)}</h4>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <SubTable rows={rows} kinds={f.subKinds ?? {}} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubTable({ rows, kinds }) {
  const keys = [...new Set(rows.flatMap(Object.keys))];
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="text-sm">
        <thead className="bg-muted/60">
          <tr>
            {keys.map((k) => (
              <th key={k} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                {fieldLabel(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {keys.map((k) => (
                <td key={k} className={`px-3 py-1.5 whitespace-nowrap ${kinds[k] === 'decimal' ? 'text-right tabular-nums' : ''}`}>
                  {formatValue(row[k], kinds[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
