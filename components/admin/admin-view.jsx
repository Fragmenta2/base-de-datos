'use client';

import { startTransition, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FolderIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  TriangleAlertIcon,
  TruckIcon,
  UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as api from '@/lib/api';
import { collectionLabel, fieldLabel, formatFechaHora, formatMoney, groupCollections } from '@/lib/format';
import { infoColeccion } from '@/lib/colecciones';
import { cn } from '@/lib/utils';
import { RegistroForm } from './registro-form';

const MAX_FILAS = 200;

// Ícono de cada categoría del catálogo (los ids están en lib/colecciones.js)
const ICONO_CATEGORIA = {
  ventas: ShoppingCartIcon,
  productos: PackageIcon,
  compras: TruckIcon,
  personal: UsersIcon,
};

// Color de los estados (siempre acompañado del texto)
const TONO_ESTADO = {
  bien: ['Activo', 'Activa', 'Abierta', 'Abierto', 'Pagada', 'Aprobada', 'Recibido', 'Completa'],
  mal: ['Inactivo', 'Devuelta', 'Cancelada', 'Cancelado', 'Rechazada', 'Descontinuado'],
};
const claseEstado = (v) =>
  TONO_ESTADO.bien.includes(v)
    ? 'bg-success/10 text-success'
    : TONO_ESTADO.mal.includes(v)
      ? 'bg-destructive/10 text-destructive'
      : 'bg-warning/15 text-amber-800 dark:text-amber-200';

const esEmbebido = (c) => c.kind === 'array' || c.kind === 'object';

export function AdminView({ colecciones, schema, docs, opciones, siguienteId, maximos }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [orden, setOrden] = useState({ key: '_id', dir: 1 });
  const [form, setForm] = useState({ abierto: false, doc: null, n: 0 });
  const [borrar, setBorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const etiqueta = collectionLabel(schema.name);
  const info = infoColeccion(schema.name); // categoría y descripción (lib/colecciones.js)
  const columnas = schema.fields;

  // Nombre de cada referencia: { roles: Map('R02' -> 'Cajero'), ... }
  const nombres = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(opciones).map(([col, lista]) => [col, new Map(lista.map((o) => [String(o.value), o.label]))])
      ),
    [opciones]
  );
  const nombreRef = (c, v) => nombres[c.ref]?.get(String(v));
  const tituloDoc = (d) => {
    const nombre = d.nombre ?? d.razon_social;
    return nombre ? `${nombre}${d.apellidos ? ` ${d.apellidos}` : ''} (${d._id})` : `${etiqueta} ${d._id}`;
  };

  const filas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtradas = q
      ? docs.filter((d) =>
          columnas.some((c) => {
            if (esEmbebido(c)) return false;
            const v = d[c.key];
            return (
              v !== null &&
              v !== undefined &&
              (String(v).toLowerCase().includes(q) || (c.ref && nombreRef(c, v)?.toLowerCase().includes(q)))
            );
          })
        )
      : docs;
    const campo = columnas.find((c) => c.key === orden.key);
    const valor = (d) => {
      const v = d[orden.key];
      if (campo?.ref) return nombreRef(campo, v) ?? v;
      if (Array.isArray(v)) return v.length;
      return v;
    };
    return [...filtradas].sort((a, b) => {
      const x = valor(a);
      const y = valor(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * orden.dir;
    });
  }, [docs, columnas, query, orden, nombres]);

  const abrirNuevo = () => setForm((f) => ({ abierto: true, doc: null, n: f.n + 1 }));
  const abrirEditar = (doc) => setForm((f) => ({ abierto: true, doc, n: f.n + 1 }));
  const cerrarForm = () => setForm((f) => ({ ...f, abierto: false }));
  const ordenarPor = (key) => setOrden((o) => ({ key, dir: o.key === key ? -o.dir : 1 }));

  async function guardar(datos) {
    if (form.doc) {
      await api.updateDoc(schema.name, form.doc._id, datos);
      toast.success('Cambios guardados', { description: tituloDoc(form.doc) });
    } else {
      const nuevo = await api.createDoc(schema.name, datos);
      toast.success('Registro creado', { description: `${etiqueta} · ID ${nuevo._id}` });
    }
    cerrarForm();
    startTransition(() => router.refresh());
  }

  async function confirmarBorrado() {
    setBorrando(true);
    try {
      await api.deleteDoc(schema.name, borrar._id);
      toast.success('Registro eliminado', { description: tituloDoc(borrar) });
      setBorrar(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('No se pudo eliminar', { description: err.message, duration: 8000 });
      setBorrar(null);
    } finally {
      setBorrando(false);
    }
  }

  // Contenido de una celda según el tipo de campo (función, no componente: no se remonta en cada render)
  function celda(c, v) {
    if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>;
    if (c.ref) {
      const nombre = nombreRef(c, v);
      return nombre ? (
        <span className="whitespace-nowrap">
          {nombre} <span className="text-xs text-muted-foreground">{String(v)}</span>
        </span>
      ) : (
        <span className="text-destructive" title="No existe en la colección referenciada">
          {String(v)} ⚠
        </span>
      );
    }
    if (c.opciones) return <Badge className={claseEstado(v)}>{v}</Badge>;
    if (c.kind === 'decimal') return <span className="tabular-nums">{formatMoney(v)}</span>;
    if (c.kind === 'date') return <span className="whitespace-nowrap">{formatFechaHora(v, { hora: !c.soloFecha })}</span>;
    if (c.kind === 'array') return <span className="text-muted-foreground">{v.length} {v.length === 1 ? 'renglón' : 'renglones'}</span>;
    if (c.kind === 'object') return <span className="text-muted-foreground">Sí</span>;
    return <span className="block max-w-64 truncate" title={String(v)}>{String(v)}</span>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      {/* Colecciones */}
      {/* Colecciones agrupadas por categoría (lib/colecciones.js) */}
      <nav aria-label="Colecciones por categoría" className="lg:sticky lg:top-18 lg:self-start">
        <div className="divide-y rounded-xl border bg-card">
          {groupCollections(colecciones).map((g) => {
            const Icono = ICONO_CATEGORIA[g.id] ?? FolderIcon;
            const activa = g.items.some((c) => c.name === schema.name);
            const total = g.items.reduce((n, c) => n + c.count, 0);
            return (
              <section key={g.id} aria-labelledby={`cat-${g.id}`} className="p-2">
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-lg',
                      activa ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                    )}
                  >
                    <Icono className="size-4" />
                  </span>
                  <h2 id={`cat-${g.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold" title={g.descripcion}>
                    {g.title}
                  </h2>
                  <span className="text-xs text-muted-foreground tabular-nums" title="Registros en la categoría">
                    {total}
                  </span>
                </div>
                {/* Las colecciones cuelgan de su categoría con una línea vertical */}
                <ul className="mt-1 ml-[1.15rem] space-y-0.5 border-l pl-2">
                  {g.items.map((c) => (
                    <li key={c.name}>
                      <Link
                        href={`/datos/${c.name}`}
                        aria-current={c.name === schema.name ? 'page' : undefined}
                        className={cn(
                          'flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                          c.name === schema.name
                            ? 'bg-primary font-medium text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {collectionLabel(c.name)}
                        <span className="text-xs tabular-nums opacity-70">{c.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </nav>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            {info && (
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                {info.categoria.titulo} <span className="text-muted-foreground">›</span> {etiqueta}
              </p>
            )}
            <h1 className="text-2xl font-semibold tracking-tight">{etiqueta}</h1>
            <p className="text-sm text-muted-foreground">
              {info ? `${info.descripcion} ` : ''}
              {docs.length} registros · clic en una fila para editarla.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Button onClick={abrirNuevo}>
              <PlusIcon /> Nuevo
            </Button>
          </div>
        </div>

        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnas.map((c) => (
                    <TableHead
                      key={c.key}
                      className={cn(c.kind === 'decimal' && 'text-right')}
                      aria-sort={orden.key === c.key ? (orden.dir === 1 ? 'ascending' : 'descending') : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => ordenarPor(c.key)}
                        className="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground"
                      >
                        {fieldLabel(c.key)}
                        {orden.key === c.key &&
                          (orden.dir === 1 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.slice(0, MAX_FILAS).map((d) => (
                  <TableRow key={String(d._id)} className="cursor-pointer" onClick={() => abrirEditar(d)}>
                    {columnas.map((c) => (
                      <TableCell key={c.key} className={cn(c.kind === 'decimal' && 'text-right', c.key === '_id' && 'font-medium')}>
                        {celda(c, d[c.key])}
                      </TableCell>
                    ))}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => abrirEditar(d)}>
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Eliminar"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setBorrar(d)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columnas.length + 1} className="h-24 text-center text-muted-foreground">
                      {query ? 'Sin resultados para la búsqueda.' : 'Todavía no hay registros. Crea el primero con “Nuevo”.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {filas.length > MAX_FILAS && (
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                Mostrando {MAX_FILAS} de {filas.length}. Usa la búsqueda para encontrar otros.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <RegistroForm
        key={form.n}
        abierto={form.abierto}
        doc={form.doc}
        titulo={form.doc ? tituloDoc(form.doc) : ''}
        etiqueta={etiqueta}
        schema={schema}
        opciones={opciones}
        siguienteId={siguienteId}
        maximos={maximos}
        onGuardar={guardar}
        onCerrar={cerrarForm}
      />

      <Dialog open={!!borrar} onOpenChange={(o) => !o && !borrando && setBorrar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlertIcon className="size-5 text-destructive" /> ¿Eliminar este registro?
            </DialogTitle>
            <DialogDescription>
              Se eliminará <strong>{borrar ? tituloDoc(borrar) : ''}</strong> de {etiqueta.toLowerCase()}. Esta acción no se
              puede deshacer. Si está en uso en otra parte, no se eliminará.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrar(null)} disabled={borrando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarBorrado} disabled={borrando}>
              <Trash2Icon /> {borrando ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
