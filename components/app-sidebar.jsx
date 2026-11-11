'use client';

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
} from '@/components/ui/sidebar';

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
            <SidebarMenuButton size="lg" asChild>
              <Link href="/caja">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
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

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.title}>
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
        ))}
      </SidebarContent>

      <SidebarFooter>
        <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          MongoDB · pos_minorista
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
