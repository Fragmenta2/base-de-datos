'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { fieldLabel } from '@/lib/format';
import { Campo } from './campo';

const esFolio = (s) => s.kind === 'number' && /^(folio|num_)/.test(s.key);
const ANCHO = { ref: 'min-w-48', date: 'min-w-44', decimal: 'min-w-28', number: 'min-w-24', string: 'min-w-36' };

// Siguiente folio de un campo embebido: el mayor entre lo guardado y lo que ya hay en el formulario, + 1
function siguienteFolio(maximos, campo, sub, filas) {
  const guardado = maximos[`${campo.key}.${sub.key}`] ?? 0;
  const enFormulario = Math.max(0, ...filas.map((f) => Number(f?.[sub.key]) || 0));
  return Math.max(guardado, enFormulario) + 1;
}

function filaVacia(campo, maximos, filas) {
  return Object.fromEntries(
    campo.subFields.map((s) => [s.key, esFolio(s) ? String(siguienteFolio(maximos, campo, s, filas)) : ''])
  );
}

/** Lista embebida editable (detalles, pagos, movimientos, entregas...) */
export function SubTabla({ campo, filas, onChange, opciones, maximos }) {
  const cambiar = (i, key, v) => onChange(filas.map((f, j) => (j === i ? { ...f, [key]: v } : f)));

  return (
    <div className="space-y-2">
      {filas.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-8 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">#</th>
                {campo.subFields.map((s) => (
                  <th key={s.key} className="px-2 py-1.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">
                    {fieldLabel(s.key)}
                    {s.required && <span className="text-destructive">*</span>}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                  {campo.subFields.map((s) => (
                    <td key={s.key} className={`px-1 py-1 ${ANCHO[s.ref || s.opciones ? 'ref' : s.kind] ?? 'min-w-32'}`}>
                      <Campo
                        compacto
                        campo={s}
                        valor={fila[s.key] ?? ''}
                        onChange={(v) => cambiar(i, s.key, v)}
                        opciones={opciones}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Quitar renglón ${i + 1}`}
                      onClick={() => onChange(filas.filter((_, j) => j !== i))}
                    >
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...filas, filaVacia(campo, maximos, filas)])}
      >
        <PlusIcon /> Agregar renglón
      </Button>
    </div>
  );
}

/** Documento embebido único (comprobante, factura). Si puede ser nulo, se activa con un interruptor. */
export function SubObjeto({ campo, valor, onChange, opciones, maximos }) {
  const id = `incluir-${campo.key}`;
  return (
    <div className="space-y-3">
      {campo.nullable && (
        <div className="flex items-center gap-2">
          <Switch
            id={id}
            checked={!!valor}
            onCheckedChange={(on) => onChange(on ? filaVacia(campo, maximos, []) : null)}
          />
          <Label htmlFor={id}>Incluir {fieldLabel(campo.key).toLowerCase()}</Label>
        </div>
      )}
      {valor && (
        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          {campo.subFields.map((s) => (
            <div key={s.key} className="space-y-1.5">
              <Label htmlFor={`${campo.key}-${s.key}`} className="text-xs">
                {fieldLabel(s.key)}
                {s.required && <span className="text-destructive">*</span>}
              </Label>
              <Campo
                id={`${campo.key}-${s.key}`}
                campo={s}
                valor={valor[s.key] ?? ''}
                onChange={(v) => onChange({ ...valor, [s.key]: v })}
                opciones={opciones}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
