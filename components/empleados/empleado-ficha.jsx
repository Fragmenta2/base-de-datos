'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatFechaHora, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { iniciales } from './empleado-card';

const ESTATUS = ['Activo', 'Inactivo', 'Vacaciones'];

function antiguedad(iso) {
  const inicio = new Date(iso);
  const hoy = new Date();
  let anios = hoy.getUTCFullYear() - inicio.getUTCFullYear();
  const antesDelAniversario =
    hoy.getUTCMonth() < inicio.getUTCMonth() ||
    (hoy.getUTCMonth() === inicio.getUTCMonth() && hoy.getUTCDate() < inicio.getUTCDate());
  if (antesDelAniversario) anios--;
  return anios < 1 ? 'Menos de un año' : `${anios} ${anios === 1 ? 'año' : 'años'}`;
}

// Ficha del empleado; recibe el documento vivo, así que refleja cambios en tiempo real
export function EmpleadoFicha({ empleado: e, onClose, onCambiar }) {
  return (
    <Dialog open={!!e} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {e && (
          <>
            <DialogHeader className="flex-row items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="font-semibold">{iniciales(e)}</AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle>
                  {e.nombre} {e.apellidos}
                </DialogTitle>
                <DialogDescription>
                  Empleado #{e._id} · {e.rol}
                </DialogDescription>
              </div>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted p-4 text-sm">
              <Dato label="CURP" value={e.curp} mono />
              <Dato label="RFC" value={e.rfc} mono />
              <Dato label="Fecha de ingreso" value={formatFechaHora(e.fecha_ingreso, { hora: false })} />
              <Dato label="Antigüedad" value={antiguedad(e.fecha_ingreso)} />
              <Dato label="Horario" value={e.horario} />
              <Dato label="Salario mensual" value={formatMoney(e.salario)} />
            </dl>
            <div className="flex items-center justify-between gap-3">
              <Label>Estatus</Label>
              <Select value={e.estatus} onValueChange={(v) => onCambiar(e, v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...ESTATUS, e.estatus])].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Dato({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-medium', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}
