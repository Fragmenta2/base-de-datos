import { InventarioView } from '@/components/inventario/inventario-view';
import { getInventario } from '@/lib/inventario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inventario' };

export default async function InventarioPage() {
  return <InventarioView filas={await getInventario()} />;
}
