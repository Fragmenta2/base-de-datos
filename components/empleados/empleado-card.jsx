'use client';

import { ClockIcon, IdCardIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export const iniciales = (e) => `${e.nombre[0] ?? ''}${e.apellidos[0] ?? ''}`.toUpperCase();

export function EmpleadoCard({ empleado: e, onCambiar, onVerFicha, destacado = false }) {
  const activo = e.estatus === 'Activo';
  const switchId = `activo-${e._id}`;

  return (
    <Card
      className={cn(
        'gap-4 animate-in duration-300 fade-in zoom-in-95',
        destacado && 'border-success/40 bg-success/5 ring-1 ring-success/20',
        !activo && 'opacity-80'
      )}
    >
      <CardContent className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="size-11">
            <AvatarFallback className={cn('font-semibold', activo && 'bg-success/15 text-success')}>
              {iniciales(e)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-card',
              activo ? 'bg-success' : e.estatus === 'Vacaciones' ? 'bg-warning' : 'bg-muted-foreground/50'
            )}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate leading-tight font-semibold">
            {e.nombre} {e.apellidos}
          </p>
          <Badge variant="secondary">{e.rol ?? e.codigo_rol}</Badge>
          <p className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
            <ClockIcon className="size-3" /> {e.horario}
          </p>
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch id={switchId} checked={activo} onCheckedChange={(on) => onCambiar(e, on ? 'Activo' : 'Inactivo')} />
          <Label htmlFor={switchId} className={cn('text-sm', activo ? 'text-success' : 'text-muted-foreground')}>
            {activo ? 'Activo' : e.estatus}
          </Label>
        </div>

        <Button variant="ghost" size="sm" onClick={() => onVerFicha(e._id)}>
          <IdCardIcon /> Ficha
        </Button>
      </CardFooter>
    </Card>
  );
}

