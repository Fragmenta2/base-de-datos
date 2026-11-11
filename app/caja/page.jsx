import { PuntoDeVenta } from '@/components/caja/punto-de-venta';
import { getCatalogo, METODOS_PAGO, SALDO_INICIAL } from '@/lib/caja';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja' };

export default async function CajaPage() {
  const catalogo = await getCatalogo();
  return <PuntoDeVenta {...catalogo} metodos={METODOS_PAGO} saldoInicial={SALDO_INICIAL} />;
}
