'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as api from '@/lib/api';
import { collectionLabel, fieldLabel, formatValue } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DocForm } from './doc-form';
import { EmbeddedView } from './embedded-view';

const isEmbedded = (f) => f.kind === 'array' || f.kind === 'object';

export function CollectionView({ schema, docs }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | documento

  const scalarFields = schema.fields.filter((f) => !isEmbedded(f));
  const embeddedFields = schema.fields.filter(isEmbedded);
  const label = collectionLabel(schema.name);

  const q = query.trim().toLowerCase();
  const visible = q
    ? docs.filter((d) => scalarFields.some((f) => formatValue(d[f.key], f.kind).toLowerCase().includes(q)))
    : docs;

  // Los errores se propagan a DocForm, que los muestra en el formulario y en un toast
  async function handleSave(data) {
    if (editing === 'new') {
      const doc = await api.createDoc(schema.name, data);
      toast.success('Documento creado', { description: `${label} · ID ${doc._id}` });
    } else {
      await api.updateDoc(schema.name, editing._id, data);
      toast.success('Cambios guardados', { description: `${label} · ID ${editing._id}` });
    }
    setEditing(null);
    router.refresh();
  }

  async function handleDelete(doc) {
    if (!confirm(`¿Eliminar el documento ${doc._id} de ${label}?`)) return;
    try {
      await api.deleteDoc(schema.name, doc._id);
      toast.success('Documento eliminado', { description: `${label} · ID ${doc._id}` });
      router.refresh();
    } catch (err) {
      toast.error(`No se pudo eliminar el documento ${doc._id}`, { description: err.message });
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground">
        <Link href="/datos">
          <ArrowLeftIcon /> Colecciones
        </Link>
      </Button>
      <PageHeader title={label} description={`${docs.length} documentos · colección ${schema.name}`}>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button onClick={() => setEditing('new')}>
          <PlusIcon /> Nuevo
        </Button>
      </PageHeader>

      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                {embeddedFields.length > 0 && <TableHead className="w-8" />}
                {[...scalarFields, ...embeddedFields].map((f) => (
                  <TableHead key={f.key} className={f.kind === 'decimal' ? 'text-right' : undefined}>
                    {fieldLabel(f.key)}
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((doc) => {
                const open = expanded === doc._id;
                return (
                  <Fragment key={doc._id}>
                    <TableRow
                      data-state={open ? 'selected' : undefined}
                      className={cn(embeddedFields.length > 0 && 'cursor-pointer')}
                      onClick={() => embeddedFields.length > 0 && setExpanded(open ? null : doc._id)}
                    >
                      {embeddedFields.length > 0 && (
                        <TableCell className="text-muted-foreground">
                          {open ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                        </TableCell>
                      )}
                      {scalarFields.map((f) => (
                        <TableCell
                          key={f.key}
                          className={cn(f.kind === 'decimal' && 'text-right tabular-nums', f.key === '_id' && 'font-medium')}
                        >
                          {formatValue(doc[f.key], f.kind)}
                        </TableCell>
                      ))}
                      {embeddedFields.map((f) => (
                        <TableCell key={f.key} className="text-muted-foreground">
                          {f.kind === 'array' ? `${doc[f.key]?.length ?? 0} elem.` : doc[f.key] ? 'Sí' : '—'}
                        </TableCell>
                      ))}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(doc)}>
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Eliminar"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(doc)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={scalarFields.length + embeddedFields.length + 2} className="bg-muted/40 p-4">
                          <EmbeddedView fields={embeddedFields} doc={doc} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={scalarFields.length + embeddedFields.length + 2} className="h-24 text-center text-muted-foreground">
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DocForm
        open={!!editing}
        title={editing === 'new' ? `Nuevo en ${label}` : `Editar ${editing?._id}`}
        fields={scalarFields}
        doc={editing === 'new' ? null : editing}
        onSave={handleSave}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
