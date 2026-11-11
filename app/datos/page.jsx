import Link from 'next/link';
import { DatabaseIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listCollections } from '@/lib/pos';
import { collectionLabel, groupCollections } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Colecciones' };

export default async function DatosPage() {
  const collections = await listCollections();

  return (
    <>
      <PageHeader
        title="Colecciones"
        description={`Base de datos pos_minorista · ${collections.length} colecciones`}
      />
      {collections.length === 0 && (
        <p className="text-muted-foreground">
          La base de datos está vacía. Cárgala con <code>npm run db:seed</code>.
        </p>
      )}
      <div className="space-y-8">
        {groupCollections(collections).map((g) => (
          <section key={g.title} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">{g.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {g.items.map((c) => (
                <Link key={c.name} href={`/datos/${c.name}`} className="group">
                  <Card className="transition-colors group-hover:border-primary/50">
                    <CardHeader>
                      <CardDescription className="flex items-center gap-1.5">
                        <DatabaseIcon className="size-3.5" /> {c.name}
                      </CardDescription>
                      <CardTitle className="flex items-baseline justify-between">
                        {collectionLabel(c.name)}
                        <span className="text-2xl font-semibold text-primary">{c.count}</span>
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
