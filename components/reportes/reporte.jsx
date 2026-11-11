import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Tarjeta de reporte pensada para cualquier usuario:
 * título en lenguaje sencillo, qué responde, la conclusión principal, el detalle
 * y, aparte y plegado, cómo se calcula en MongoDB.
 */
export function Reporte({ numero, icon: Icon, titulo, pregunta, filtro, conclusion, children, tecnico }) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <span>
            <span className="text-muted-foreground">{numero}.</span> {titulo}
          </span>
        </CardTitle>
        <CardDescription>{pregunta}</CardDescription>
        {filtro && <CardAction className="print:hidden">{filtro}</CardAction>}
      </CardHeader>
      <CardContent className="space-y-4">
        {conclusion}
        {children}
        {tecnico && (
          <details className="group rounded-lg border bg-muted/30 text-sm print:hidden">
            <summary className="cursor-pointer px-3 py-2 text-muted-foreground select-none hover:text-foreground">
              Ver cómo se calcula (consulta de MongoDB)
            </summary>
            <div className="space-y-2 border-t px-3 py-3">
              <p className="text-muted-foreground">{tecnico.explicacion}</p>
              <pre className="overflow-x-auto rounded-md bg-background p-3 font-mono text-xs leading-relaxed">
                {tecnico.consulta}
              </pre>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

// Frase de conclusión destacada en la parte superior del reporte
export function Conclusion({ icon: Icon, tono = 'info', children }) {
  const estilos = {
    info: 'bg-primary/5 text-foreground [&_svg]:text-primary',
    bien: 'bg-success/10 text-foreground [&_svg]:text-success',
    alerta: 'bg-warning/15 text-foreground [&_svg]:text-amber-700 dark:[&_svg]:text-amber-300',
  };
  return (
    <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${estilos[tono]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

// Cifra resumida (p. ej. "15 ventas")
export function Cifra({ label, value }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
