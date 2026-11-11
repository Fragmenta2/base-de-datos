'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { fieldLabel } from '@/lib/format';
import { aEnvio, aFormulario, Campo } from './campo';
import { SubObjeto, SubTabla } from './embebidos';

const esEmbebido = (c) => c.kind === 'array' || c.kind === 'object';

// Documento -> estado del formulario (todo como texto; listas y objetos embebidos por renglón)
function valoresIniciales(campos, doc, siguienteId) {
  const v = {};
  for (const c of campos) {
    const x = doc?.[c.key];
    if (c.kind === 'array') {
      v[c.key] = (x ?? []).map((fila) => Object.fromEntries(c.subFields.map((s) => [s.key, aFormulario(s, fila[s.key])])));
    } else if (c.kind === 'object') {
      v[c.key] = x ? Object.fromEntries(c.subFields.map((s) => [s.key, aFormulario(s, x[s.key])])) : null;
    } else {
      v[c.key] = aFormulario(c, x);
    }
  }
  if (!doc) v._id = siguienteId === '' || siguienteId === undefined ? '' : String(siguienteId);
  return v;
}

// Renglón embebido -> lo que se envía (sin los campos opcionales vacíos)
const filaEnvio = (subFields, fila) =>
  Object.fromEntries(subFields.map((s) => [s.key, aEnvio(s, fila[s.key])]).filter(([, v]) => v !== null));

function construirEnvio(campos, valores, esNuevo) {
  const out = {};
  for (const c of campos) {
    if (c.key === '_id' && !esNuevo) continue;
    const v = valores[c.key];
    if (c.kind === 'array') out[c.key] = v.map((fila) => filaEnvio(c.subFields, fila));
    else if (c.kind === 'object') out[c.key] = v ? filaEnvio(c.subFields, v) : null;
    else out[c.key] = aEnvio(c, v);
  }
  return out;
}

/**
 * Panel lateral para crear o editar un registro de cualquier colección, incluidas sus listas
 * embebidas. Se monta de nuevo cada vez que se abre (key en el padre), así arranca con los datos frescos.
 */
export function RegistroForm({ abierto, doc, titulo, etiqueta, schema, opciones, siguienteId, maximos, onGuardar, onCerrar }) {
  const esNuevo = !doc;
  const [valores, setValores] = useState(() => valoresIniciales(schema.fields, doc, siguienteId));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const generales = schema.fields.filter((c) => !esEmbebido(c));
  const embebidos = schema.fields.filter(esEmbebido);
  const poner = (key, v) => setValores((prev) => ({ ...prev, [key]: v }));

  async function enviar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await onGuardar(construirEnvio(schema.fields, valores, esNuevo));
    } catch (err) {
      setError(err.message);
      toast.error('No se pudo guardar', { description: err.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Sheet open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-3xl!">
        <form onSubmit={enviar} className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>{esNuevo ? `Nuevo registro · ${etiqueta}` : `Editar · ${titulo}`}</SheetTitle>
            <SheetDescription>
              Los campos con <span className="text-destructive">*</span> son obligatorios. Las listas muestran nombres; se
              guarda el código correspondiente.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Datos generales</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {generales.map((c) => (
                  <div key={c.key} className="min-w-0 space-y-1.5">
                    <Label htmlFor={`campo-${c.key}`}>
                      {fieldLabel(c.key)}
                      {c.required && <span className="text-destructive">*</span>}
                    </Label>
                    <Campo
                      id={`campo-${c.key}`}
                      campo={c}
                      valor={valores[c.key]}
                      onChange={(v) => poner(c.key, v)}
                      opciones={opciones}
                      disabled={c.key === '_id' && !esNuevo}
                    />
                    {c.key === '_id' && esNuevo && siguienteId !== '' && (
                      <p className="text-xs text-muted-foreground">Sugerido: el siguiente disponible.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {embebidos.map((c) => (
              <section key={c.key} className="space-y-3">
                <h3 className="text-sm font-semibold">
                  {fieldLabel(c.key)}
                  {c.kind === 'array' && (
                    <span className="ml-2 font-normal text-muted-foreground">({valores[c.key].length})</span>
                  )}
                </h3>
                {c.kind === 'array' ? (
                  <SubTabla
                    campo={c}
                    filas={valores[c.key]}
                    onChange={(v) => poner(c.key, v)}
                    opciones={opciones}
                    maximos={maximos}
                  />
                ) : (
                  <SubObjeto
                    campo={c}
                    valor={valores[c.key]}
                    onChange={(v) => poner(c.key, v)}
                    opciones={opciones}
                    maximos={maximos}
                  />
                )}
              </section>
            ))}

            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : esNuevo ? 'Crear' : 'Guardar cambios'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
