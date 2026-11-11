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
  SidebarFooter,
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
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Operación', items: [{ title: 'Caja', href: '/caja', icon: ShoppingCartIcon }] },
  { label: 'Análisis', items: [{ title: 'Estadísticas', href: '/estadisticas', icon: ChartColumnIcon }] },
  { label: 'Almacén', items: [{ title: 'Inventario', href: '/inventario', icon: PackageIcon }] },
  { label: 'Personal', items: [{ title: 'Empleados', href: '/empleados', icon: UsersIcon }] },
  {
    label: 'Base de datos',
    items: [
      { title: 'Colecciones', href: '/datos', icon: DatabaseIcon, exact: true },
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
            <SidebarMenuButton size="lg" asChild tooltip="POS Minorista">
              <Link href="/caja">
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <StoreIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">POS Minorista</span>
                  <span className="truncate text-xs text-muted-foreground">Sistema de ventas</span>
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

      <SidebarFooter>
        <div
          title="MongoDB · pos_minorista"
          className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <DatabaseIcon className="size-3.5 shrink-0" />
          <span className="truncate group-data-[collapsible=icon]:hidden">MongoDB · pos_minorista</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
