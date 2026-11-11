'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PackageXIcon, TrendingUpIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Controles } from './controles';
import { VistaMermas } from './vista-mermas';
import { VistaVentas } from './vista-ventas';

export function EstadisticasView({ vista, fecha, hoy, ultimoDia, dias, periodo, datos }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  // Toda la navegación vive en la URL (?vista=&escala=&fecha=): se puede compartir y usar "atrás"
  function navegar(cambios) {
    const params = new URLSearchParams({ vista, escala: periodo.escala, fecha, ...cambios });
    startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }));
  }

  // Clic en una barra: baja un nivel (año -> mes, mes/semana -> día)
  function profundizar(bucket) {
    if (periodo.escala === 'anio') {
      navegar({ escala: 'mes', fecha: `${fecha.slice(0, 4)}-${bucket.key}-01` });
    } else if (periodo.escala !== 'dia') {
      navegar({ escala: 'dia', fecha: bucket.key });
    }
  }

  const esMermas = vista === 'mermas';

  return (
    <>
      <PageHeader
        title="Estadísticas"
        description={esMermas ? 'Pérdidas de inventario registradas como merma' : 'Ventas realizadas a lo largo del tiempo'}
      >
        <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <Label
            htmlFor="vista"
            className={cn('flex items-center gap-1.5', esMermas ? 'text-muted-foreground' : 'text-foreground')}
          >
            <TrendingUpIcon className="size-4" /> Ventas
          </Label>
          <Switch
            id="vista"
            checked={esMermas}
            onCheckedChange={(checked) => navegar({ vista: checked ? 'mermas' : 'ventas' })}
            aria-label="Cambiar entre ventas y mermas"
          />
          <Label
            htmlFor="vista"
            className={cn('flex items-center gap-1.5', esMermas ? 'text-foreground' : 'text-muted-foreground')}
          >
            <PackageXIcon className="size-4" /> Mermas
          </Label>
        </div>
      </PageHeader>

      <Controles
        periodo={periodo}
        fecha={fecha}
        hoy={hoy}
        dias={dias}
        ultimoDia={ultimoDia}
        pending={pending}
        onChange={navegar}
      />

      <div className={cn('transition-opacity', pending && 'pointer-events-none opacity-60')}>
        {esMermas ? (
          <VistaMermas periodo={periodo} datos={datos} onBarClick={profundizar} ultimoDia={ultimoDia} onIrA={navegar} />
        ) : (
          <VistaVentas periodo={periodo} datos={datos} onBarClick={profundizar} ultimoDia={ultimoDia} onIrA={navegar} />
        )}
      </div>
    </>
  );
}
