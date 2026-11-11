'use client';

import { useEffect, useRef, useState } from 'react';
import { MoonIcon, PalmtreeIcon, SearchIcon, UserCheckIcon, UsersIcon, WalletIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Input } from '@/components/ui/input';
import * as api from '@/lib/api';
import { formatInt, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmpleadoCard } from './empleado-card';
import { EmpleadoFicha } from './empleado-ficha';

const ESTADO_CONEXION = {
  conectando: { label: 'Conectando…', dot: 'bg-warning' },
  vivo: { label: 'En vivo', dot: 'bg-success animate-pulse' },
  caido: { label: 'Reconectando…', dot: 'bg-destructive' },
};

export function EmpleadosView({ inicial }) {
  const [empleados, setEmpleados] = useState(inicial);
  const [conexion, setConexion] = useState('conectando');
  const [query, setQuery] = useState('');
  const [fichaId, setFichaId] = useState(null);
  const propios = useRef(new Set()); // cambios hechos desde esta pestaña (no se anuncian)
  const anteriores = useRef(new Map(inicial.map((e) => [e._id, e.estatus])));

  // Tiempo real: el servidor envía la lista completa cada vez que cambia
  useEffect(() => {
    const es = new EventSource('/api/empleados/stream');
    let estado = 'conectando';

    // Avisa solo en las transiciones (perdida / recuperada), con un id fijo para no apilar toasts
    const marcarVivo = () => {
      if (estado === 'caido') toast.success('Conexión en tiempo real restablecida', { id: 'sse' });
      estado = 'vivo';
      setConexion('vivo');
    };
    es.addEventListener('open', marcarVivo);
    es.addEventListener('error', () => {
      if (estado === 'vivo') {
        toast.error('Se perdió la conexión en tiempo real', { id: 'sse', description: 'Reintentando…' });
      }
      estado = 'caido';
      setConexion('caido');
    });
    es.addEventListener('error-bd', () => {
      toast.error('No se pudo leer la base de datos', { id: 'sse-bd', description: '¿Está corriendo "npm run db"?' });
    });
    es.addEventListener('empleados', (ev) => {
      const lista = JSON.parse(ev.data);
      for (const e of lista) {
        const antes = anteriores.current.get(e._id);
        if (antes && antes !== e.estatus && !propios.current.delete(`${e._id}:${e.estatus}`)) {
          const msg = `${e.nombre} ${e.apellidos}`;
          if (e.estatus === 'Activo') toast.success(`${msg} ahora está en estatus Activo`);
          else toast.info(`${msg} cambió su estatus a ${e.estatus}`);
        }
        anteriores.current.set(e._id, e.estatus);
      }
      setEmpleados(lista);
      marcarVivo();
    });
    return () => es.close();
  }, []);

  async function cambiarEstatus(empleado, estatus) {
    const previo = empleado.estatus;
    const nombre = `${empleado.nombre} ${empleado.apellidos}`;
    propios.current.add(`${empleado._id}:${estatus}`);
    setEmpleados((prev) => prev.map((e) => (e._id === empleado._id ? { ...e, estatus } : e)));
    try {
      await api.cambiarEstatus(empleado._id, estatus);
      toast.success('Estatus actualizado', { description: `${nombre} → ${estatus}` });
    } catch (err) {
      propios.current.delete(`${empleado._id}:${estatus}`);
      setEmpleados((prev) => prev.map((e) => (e._id === empleado._id ? { ...e, estatus: previo } : e)));
      toast.error(`No se pudo cambiar el estatus de ${nombre}`, { description: err.message });
    }
  }

  const q = query.trim().toLowerCase();
  const filtrados = empleados.filter(
    (e) => !q || `${e.nombre} ${e.apellidos} ${e.rol} ${e._id}`.toLowerCase().includes(q)
  );
  const activos = filtrados.filter((e) => e.estatus === 'Activo');
  const fuera = filtrados.filter((e) => e.estatus !== 'Activo');

  const totalActivos = empleados.filter((e) => e.estatus === 'Activo').length;
  const vacaciones = empleados.filter((e) => e.estatus === 'Vacaciones').length;
  const nomina = empleados.reduce((s, e) => s + (e.salario ?? 0), 0);
  const c = ESTADO_CONEXION[conexion];

  return (
    <>
      <PageHeader title="Empleados" description="Plantilla y disponibilidad del personal">
        <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className={cn('size-2 rounded-full', c.dot)} />
          {c.label}
        </span>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o rol…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </PageHeader>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Activos ahora" value={`${totalActivos} / ${empleados.length}`} icon={UserCheckIcon} hint="Se actualiza en tiempo real" />
        <StatCard title="Fuera de turno" value={formatInt(empleados.length - totalActivos - vacaciones)} icon={MoonIcon} hint="Marcados como inactivos" />
        <StatCard title="De vacaciones" value={formatInt(vacaciones)} icon={PalmtreeIcon} hint="Ausencias programadas" />
        <StatCard title="Nómina mensual" value={formatMoney(nomina, { decimals: 0 })} icon={WalletIcon} hint="Suma de salarios" />
      </div>

      <section className="mb-8 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="size-2.5 rounded-full bg-success" /> Activos ahora
          <span className="text-sm font-normal text-muted-foreground">({activos.length})</span>
        </h2>
        {activos.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nadie tiene estatus Activo en este momento.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {activos.map((e) => (
              <EmpleadoCard key={`${e._id}-${e.estatus}`} empleado={e} onCambiar={cambiarEstatus} onVerFicha={setFichaId} destacado />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UsersIcon className="size-4 text-muted-foreground" /> Fuera de turno
          <span className="text-sm font-normal text-muted-foreground">({fuera.length})</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {fuera.map((e) => (
            <EmpleadoCard key={`${e._id}-${e.estatus}`} empleado={e} onCambiar={cambiarEstatus} onVerFicha={setFichaId} />
          ))}
        </div>
      </section>

      <EmpleadoFicha
        empleado={empleados.find((e) => e._id === fichaId) ?? null}
        onClose={() => setFichaId(null)}
        onCambiar={cambiarEstatus}
      />
    </>
  );
}
