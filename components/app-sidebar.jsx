'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartColumnIcon,
  DatabaseIcon,
  FileTextIcon,
  PackageIcon,
  ShoppingCartIcon,
  StoreIcon,
  UsersIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { NOMBRE_APP } from '@/lib/format';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Operación', items: [{ title: 'Caja', href: '/caja', icon: ShoppingCartIcon }] },
  { label: 'Análisis', items: [{ title: 'Estadísticas', href: '/estadisticas', icon: ChartColumnIcon }] },
  { label: 'Almacén', items: [{ title: 'Inventario', href: '/inventario', icon: PackageIcon }] },
  { label: 'Personal', items: [{ title: 'Empleados', href: '/empleados', icon: UsersIcon }] },
  {
    label: 'Base de datos',
    items: [
      { title: 'Administración', href: '/datos', icon: DatabaseIcon, exact: true },
      { title: 'Reportes', href: '/datos/reportes', icon: FileTextIcon },
    ],
  },
];

// Seleccionado: relleno sólido del color principal (también colapsada); el resto, texto atenuado.
// No se usa la variante `data-active:` de shadcn porque la envuelve en :where() (especificidad 0) y
// los `hover:`/`active:` del botón la ganan: el texto se ponía oscuro sobre el azul al pasar el cursor.
// `[&[data-active=true]...]` sí suma el atributo, y las combinaciones con :hover/:active ganan a las de shadcn.
// El ícono hereda el color del texto; los inactivos solo se atenúan con opacidad.
const ITEM = cn(
  'h-9 text-sidebar-foreground/75 transition-colors [&_svg]:opacity-70 hover:[&_svg]:opacity-100',
  '[&[data-active=true]]:bg-sidebar-primary [&[data-active=true]]:font-semibold [&[data-active=true]]:text-sidebar-primary-foreground [&[data-active=true]]:shadow-sm [&[data-active=true]_svg]:opacity-100',
  '[&[data-active=true]:hover]:bg-sidebar-primary/90 [&[data-active=true]:hover]:text-sidebar-primary-foreground',
  '[&[data-active=true]:active]:bg-sidebar-primary/80 [&[data-active=true]:active]:text-sidebar-primary-foreground'
);

export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (item) =>
    item.exact
      ? pathname === item.href || (pathname.startsWith('/datos/') && !pathname.startsWith('/datos/reportes'))
      : pathname.startsWith(item.href);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={NOMBRE_APP} className="h-auto min-h-12 py-2">
              <Link href="/caja">
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <StoreIcon className="size-4" />
                </div>
                {/* div (no span): el botón de shadcn recorta con "…" su último span */}
                <div className="min-w-0 flex-1 text-left text-sm leading-snug font-semibold whitespace-normal">
                  {NOMBRE_APP}
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {NAV.map((group, i) => (
          <Fragment key={group.label}>
            {/* Colapsada, los títulos se ocultan: una línea separa cada sección */}
            {i > 0 && <SidebarSeparator className="mx-auto my-1 hidden w-5 group-data-[collapsible=icon]:block" />}
            <SidebarGroup className="group-data-[collapsible=icon]:py-1">
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.title} className={ITEM}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
