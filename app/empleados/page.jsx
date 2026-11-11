import { EmpleadosView } from '@/components/empleados/empleados-view';
import { getEmpleados } from '@/lib/empleados';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Empleados' };

export default async function EmpleadosPage() {
  return <EmpleadosView inicial={await getEmpleados()} />;
}
