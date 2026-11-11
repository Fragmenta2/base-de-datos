import { PuntoDeVenta } from '@/components/caja/punto-de-venta';
import { getCatalogo, METODOS_PAGO } from '@/lib/caja';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja' };

export default async function CajaPage() {
  const catalogo = await getCatalogo();
  return <PuntoDeVenta {...catalogo} metodos={METODOS_PAGO} />;
}
