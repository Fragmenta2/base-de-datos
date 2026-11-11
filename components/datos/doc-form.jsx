'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldLabel } from '@/lib/format';

// Valor del documento -> valor del <input>
function toInput(value, kind) {
  if (value === null || value === undefined) return '';
  if (kind === 'date') return value.slice(0, 16); // ISO UTC -> "YYYY-MM-DDTHH:mm"
  return String(value);
}

// Formulario generado a partir del $jsonSchema de la colección
export function DocForm({ open, title, fields, doc, onSave, onClose }) {
  const isNew = !doc;
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(fields.map((f) => [f.key, toInput(doc?.[f.key], f.kind)])));
    setError('');
  }, [open, doc, fields]);

  async function handleSubmit(e) {
    e.preventDefault();
    const data = {};
    for (const f of fields) {
      if (f.key === '_id' && !isNew) continue;
      const v = values[f.key];
      // Las fechas se guardan en UTC, igual que en el script de carga
      data[f.key] = f.kind === 'date' && v ? `${v}:00Z` : v;
    }
    try {
      setSaving(true);
      setError('');
      await onSave(data);
    } catch (err) {
      setError(err.message);
      toast.error('No se pudo guardar', { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Los campos con * son obligatorios. MongoDB valida el resto de reglas.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`f-${f.key}`}>
                  {fieldLabel(f.key)}
                  {f.required && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id={`f-${f.key}`}
                  type={f.kind === 'date' ? 'datetime-local' : f.kind === 'string' ? 'text' : 'number'}
                  step={f.kind === 'decimal' ? '0.01' : f.kind === 'number' ? 'any' : undefined}
                  min={f.minimum ?? undefined}
                  maxLength={f.maxLength ?? undefined}
                  minLength={f.minLength ?? undefined}
                  required={f.required}
                  disabled={f.key === '_id' && !isNew}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
