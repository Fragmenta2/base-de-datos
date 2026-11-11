import { notFound } from 'next/navigation';
import { CollectionView } from '@/components/datos/collection-view';
import { findAll, getSchema } from '@/lib/pos';
import { collectionLabel } from '@/lib/format';

export async function generateMetadata({ params }) {
  const { coleccion } = await params;
  return { title: collectionLabel(coleccion) };
}

export default async function CollectionPage({ params }) {
  const { coleccion } = await params;
  const schema = await getSchema(coleccion);
  if (!schema) notFound();
  const docs = await findAll(coleccion);

  return <CollectionView schema={schema} docs={docs} />;
}
