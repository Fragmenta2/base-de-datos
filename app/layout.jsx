import { Geist } from 'next/font/google';
import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NOMBRE_APP } from '@/lib/format';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
  title: { default: NOMBRE_APP, template: `%s · ${NOMBRE_APP}` },
  description: `${NOMBRE_APP} (Next.js + MongoDB)`,
};

export default async function RootLayout({ children }) {
  // shadcn guarda en esta cookie si la barra lateral está abierta; leerla evita el parpadeo al recargar
  const defaultOpen = (await cookies()).get('sidebar_state')?.value !== 'false';

  return (
    <html lang="es" className={cn('font-sans', geist.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <SidebarProvider defaultOpen={defaultOpen} style={{ '--sidebar-width': '18rem' }}>
              <AppSidebar />
              <SidebarInset>
                <header className="app-header sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:rounded-t-xl">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                  <span className="min-w-0 truncate text-sm text-muted-foreground">{NOMBRE_APP}</span>
                  <div className="ml-auto">
                    <ThemeToggle />
                  </div>
                </header>
                <div className="flex-1 p-4 md:p-6">{children}</div>
              </SidebarInset>
            </SidebarProvider>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
