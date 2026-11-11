import { notFound } from 'next/navigation';
import { AdminView } from '@/components/admin/admin-view';
import { describirColeccion } from '@/lib/admin';
import { listCollections } from '@/lib/pos';
import { collectionLabel } from '@/lib/format';

export async function generateMetadata({ params }) {
  const { coleccion } = await params;
  return { title: `${collectionLabel(coleccion)} · Administración` };
}

export default async function AdministrarColeccion({ params }) {
  const { coleccion } = await params;
  const [datos, colecciones] = await Promise.all([describirColeccion(coleccion), listCollections()]);
  if (!datos) notFound();

  return <AdminView colecciones={colecciones} {...datos} />;
}
