'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const SIN_ASIGNAR = '__sin_asignar__';
const SIN_FLECHAS =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// Valor guardado -> texto del formulario
export function aFormulario(campo, valor) {
  if (valor === null || valor === undefined) return '';
  if (campo.kind === 'date') return campo.soloFecha ? valor.slice(0, 10) : valor.slice(0, 16);
  return String(valor);
}

// Texto del formulario -> valor que se envía (el servidor lo convierte al tipo de MongoDB)
export function aEnvio(campo, texto) {
  if (texto === '' || texto === null || texto === undefined) return null;
  // Las fechas se guardan como hora "de pared" en UTC, igual que el script de carga
  if (campo.kind === 'date') return campo.soloFecha ? `${texto}T00:00:00Z` : `${texto}:00Z`;
  return texto;
}

/**
 * Control según el tipo de campo: lista desplegable con nombres para referencias,
 * opciones fijas para estados, fecha, número o texto.
 */
export function Campo({ campo, valor, onChange, opciones, id, disabled, compacto }) {
  const alto = compacto ? 'h-8' : undefined;

  if (campo.ref || campo.opciones) {
    const lista = campo.ref
      ? (opciones[campo.ref] ?? []).map((o) => ({ value: String(o.value), label: o.label, codigo: String(o.value) }))
      : campo.opciones.map((o) => ({ value: o, label: o }));
    const huerfano = valor && !lista.some((o) => o.value === valor); // apunta a algo que ya no existe
    const vacioPermitido = !campo.required;

    return (
      <Select
        value={valor === '' ? (vacioPermitido ? SIN_ASIGNAR : '') : valor}
        onValueChange={(v) => onChange(v === SIN_ASIGNAR ? '' : v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn('w-full min-w-0', alto)} aria-invalid={huerfano || undefined}>
          <SelectValue placeholder="Selecciona…" />
        </SelectTrigger>
        <SelectContent>
          {vacioPermitido && <SelectItem value={SIN_ASIGNAR}>— Sin asignar —</SelectItem>}
          {lista.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
              {o.codigo && o.codigo !== o.label && <span className="text-xs text-muted-foreground">· {o.codigo}</span>}
            </SelectItem>
          ))}
          {huerfano && <SelectItem value={valor}>{valor} (no existe)</SelectItem>}
        </SelectContent>
      </Select>
    );
  }

  const numerico = campo.kind === 'number' || campo.kind === 'decimal';
  return (
    <Input
      id={id}
      type={campo.kind === 'date' ? (campo.soloFecha ? 'date' : 'datetime-local') : numerico ? 'number' : 'text'}
      inputMode={campo.kind === 'decimal' ? 'decimal' : numerico ? 'numeric' : undefined}
      step={campo.kind === 'decimal' ? '0.01' : numerico ? 'any' : undefined}
      maxLength={campo.maxLength ?? undefined}
      minLength={campo.minLength ?? undefined}
      required={campo.required}
      disabled={disabled}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={cn('min-w-0', alto, numerico && cn('text-right tabular-nums', SIN_FLECHAS))}
    />
  );
}
