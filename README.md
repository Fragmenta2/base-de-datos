# POS Minorista — Next.js + MongoDB

Sistema de punto de venta sobre la base de datos `pos_minorista`, definida en
`pos_minorista_mongodb.js`: caja para cobrar, estadísticas de ventas y mermas, inventario,
empleados en tiempo real y un administrador de las colecciones.

**Tecnologías:** Next.js 16 (App Router) · React 19 · MongoDB 8 + Mongoose · shadcn/ui (Radix, Tailwind CSS v4) ·
Recharts · Sonner (toasts) · Lucide (íconos).

## Requisitos
- Node.js 20.9 o superior
- MongoDB Community Server instalado en `C:\Program Files\MongoDB\Server\` (o una URI de Atlas en `.env.local`)

## Puesta en marcha
```bash
npm install
npm run db        # terminal 1: arranca MongoDB local (datos en C:\data\db)
npm run db:seed   # una sola vez: crea pos_minorista con pos_minorista_mongodb.js
npm run dev       # terminal 2: http://localhost:3000
```

> ⚠️ `npm run db:seed` **borra y recrea** la base `pos_minorista` (el script hace `dropDatabase()`):
> se pierden las ventas registradas desde la caja. Úsalo solo para volver a los datos de ejemplo.

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run db` | Arranca `mongod` (busca la versión más reciente instalada; `MONGO_DBPATH` cambia la carpeta de datos) |
| `npm run db:seed` | Ejecuta `pos_minorista_mongodb.js` con mongosh (incluido como dependencia) |

## Vistas

Todas se navegan desde la barra lateral, que se puede contraer a íconos. Hay modo claro y oscuro
(botón arriba a la derecha) y cada acción muestra un toast de éxito o de error.

### Caja — `/caja`
Punto de venta para cobrar.
- Cuadrícula de productos activos con precio y existencias; filtro por categoría y buscador.
  **Enter** en el buscador agrega el producto por código de barras exacto (o si solo hay un resultado).
- Ticket con cajero, cantidades, descuento y total. No se pide cliente: las ventas se registran a nombre de
  *Público en General* (RFC genérico `XAXX010101000`). La API acepta `numero_socio` si se quiere indicar otro.
- **Cajeros:** el selector muestra a todos los empleados con rol *Cajero* o *Cajero senior* (y a
  cualquiera con un turno abierto), con su caja o "sin turno". **Solo se pueden elegir los que
  tienen estatus Activo**; los demás aparecen deshabilitados con su estatus. La caja recibe los
  cambios de estatus en tiempo real: si el cajero elegido deja de estar activo, cambia sola al
  siguiente y lo avisa. El servidor también rechaza la venta si el cajero no está activo.
- **Diseño:** en pantallas grandes la caja ocupa la ventana completa y los productos hacen scroll por
  dentro. En el ticket solo hace scroll la lista de artículos; subtotal, descuento, total, método de pago,
  recibido/cambio, comprobante y el botón **Cobrar** (grande, con el total) quedan siempre visibles.
  Si no se puede cobrar, debajo se explica por qué (sin cajero activo, sin turno, el recibido no alcanza).
- **Ticket de venta:** al cobrar se muestra el comprobante con el desglose completo (folio, fecha,
  caja, quién atendió, cliente, cada artículo con cantidad × precio e importe, subtotal, descuento,
  total, forma de pago, recibido y cambio).
- **Ticket en PDF:** *Imprimir PDF* abre el ticket como PDF real (80 mm de ancho, alto según los
  artículos) y lanza el diálogo de impresión; *Descargar PDF* lo guarda como `ticket-<folio>.pdf`.
  El PDF se genera en el servidor con jsPDF a partir de lo guardado en MongoDB, así que cualquier
  venta se puede reimprimir (en *Reportes*, el folio de cada venta abre su ticket). En pagos en
  efectivo se guardan también `recibido` y `cambio` dentro del pago para que el ticket los muestre.
- **Abrir turno:** si el cajero activo no tiene turno, se le abre uno desde la misma caja,
  eligiendo una caja libre (estado "Abierta" y sin turno abierto) y el fondo inicial ($1,000 por defecto).
- Métodos de pago: efectivo (con cálculo de cambio), tarjeta de débito o crédito, transferencia y vales.
  Comprobante tipo Ticket o Factura.
- Al cobrar, el servidor recalcula los precios desde la base de datos, descuenta el inventario,
  crea la venta con sus `detalles`, `pagos` y `comprobante` embebidos y, si es en efectivo, suma
  el total al saldo de la caja. Si falta stock de algún artículo, nada se descuenta.

### Estadísticas — `/estadisticas`
Gráficas de lo vendido a lo largo del tiempo.
- **Escala:** Día (por hora), Semana (por día, de lunes a domingo), Mes (por día) o Año (por mes).
- **Navegación:** flechas para ir al periodo anterior o siguiente dentro de la escala, calendario
  para elegir un día concreto (los días con registros aparecen subrayados), y botones *Hoy* y
  *Último registro*.
- **Clic en una barra** para bajar un nivel: año → mes → día.
- Ingresos del periodo con su variación contra el periodo anterior, número de ventas, ticket
  promedio, artículos vendidos, métodos de pago, productos más vendidos y la tabla de ventas.
- **Switch Ventas / Mermas:** la misma vista muestra las mermas, con unidades perdidas, costo
  estimado (cantidad × precio), motivo principal, desglose por motivo y la tabla de mermas.
- Los filtros viven en la URL (`?vista=mermas&escala=semana&fecha=2026-10-08`), así que se
  pueden compartir y funciona el botón "atrás".

### Inventario — `/inventario`
Existencias que quedan en cada almacén.
- Indicadores de artículos, unidades, valor a precio de venta y alertas de stock.
- Tabla con barra de nivel (con la marca del stock mínimo), mínimo y máximo, valor y estado:
  *Agotado*, *Bajo mínimo*, *Reabastecer* (menos de 1.5 × el mínimo), *Normal* o *Sobre máximo*.
- Búsqueda y filtros por categoría y estado.

### Empleados — `/empleados`
Plantilla del personal, **actualizada en tiempo real**.
- Los empleados activos aparecen primero y destacados en *Activos ahora*; el resto, en *Fuera de turno*.
- Cada tarjeta tiene un interruptor para marcarse como activo o inactivo. El cambio llega al
  instante a todas las pestañas abiertas, y las demás reciben un aviso
  ("Laura Sánchez Vega ahora está en estatus Activo"). También detecta cambios hechos fuera de la app, como Compass o mongosh.
- La ficha muestra CURP, RFC, fecha de ingreso, antigüedad, horario y salario, y permite elegir
  el estatus *Activo*, *Inactivo* o *Vacaciones*.
- El indicador *En vivo* muestra el estado de la conexión.

### Base de datos — `/datos` y `/datos/reportes`
- **Colecciones:** las 14 colecciones agrupadas con su conteo. Cada una abre una tabla con
  búsqueda y opciones para crear, editar y eliminar. Al hacer clic en una fila se ven los
  documentos embebidos (detalles, pagos, movimientos, factura, entregas…).
- **Reportes:** las tres consultas de ejemplo del script, explicadas para cualquier usuario. Cada
  reporte dice qué pregunta responde, muestra la conclusión principal arriba y guarda la consulta
  de MongoDB en un apartado plegable *“Ver cómo se calcula”*. Se pueden imprimir.
  1. **Detalle de ventas:** qué se vendió, a quién y quién lo atendió, con totales y promedio.
     Filtro *Mostrar* para ver una sola venta (`?venta=3`).
  2. **Productos por reabastecer:** lo que se está acabando, cuánto falta para el mínimo y cuánto
     conviene pedir. Filtro *Nivel de alerta*: Urgente (debajo del mínimo), Pronto (menos de 1.5 × el
     mínimo, por defecto) o Preventivo (menos de 3 ×) (`?nivel=urgente|pronto|preventivo`).
  3. **¿Cómo pagan los clientes?:** dinero cobrado por forma de pago, con su porcentaje y la más usada.

## API
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/ventas` | Registra una venta `{ numero_turno, numero_socio?, items: [{ codigo_articulo, cantidad }], descuento, metodo_pago, recibido?, tipo_comprobante }` |
| GET | `/api/ventas/:id/ticket` | Ticket de la venta en PDF (`?imprimir=1` abre el diálogo de impresión, `?descargar=1` lo descarga) |
| POST | `/api/turnos` | Abre un turno `{ numero_empleado, numero_caja, saldo_inicial }` para un cajero activo sin turno |
| PATCH | `/api/empleados/:id` | Cambia el estatus `{ estatus: "Activo" \| "Inactivo" \| "Vacaciones" }` |
| GET | `/api/empleados/stream` | Server-Sent Events con la lista de empleados cada vez que cambia |
| GET | `/api/colecciones` | Colecciones con su conteo |
| GET / POST | `/api/colecciones/:coleccion` | Esquema y documentos / crear documento |
| PUT / DELETE | `/api/colecciones/:coleccion/:id` | Actualizar / eliminar documento |

Los errores responden `{ error }` con 400 (validación), 404, 409 (valor único repetido) o
503 (MongoDB no disponible).

## Estructura
```
pos_minorista_mongodb.js          # esquema ($jsonSchema), datos de ejemplo e índices
app/
├── layout.jsx                    # barra lateral, tema claro/oscuro, toasts
├── page.jsx                      # redirige a /caja
├── caja/  estadisticas/  inventario/  empleados/
├── datos/                        # colecciones, [coleccion] y reportes
├── error.jsx                     # error de página (p. ej. MongoDB apagado)
└── api/                          # ventas, empleados (+ stream) y colecciones
components/
├── app-sidebar.jsx  page-header.jsx  stat-card.jsx  theme-*.jsx
├── caja/punto-de-venta.jsx
├── estadisticas/                 # vista, controles de periodo, gráfica, ventas y mermas
├── inventario/inventario-view.jsx
├── empleados/                    # vista en tiempo real, tarjeta y ficha
├── datos/                        # tabla genérica, formulario y documentos embebidos
└── ui/                           # componentes de shadcn/ui
lib/
├── mongodb.js                    # conexión (Mongoose, cacheada)
├── caja.js                       # catálogo y registro de ventas
├── estadisticas.js               # agregaciones de ventas y mermas por periodo
├── ticket.js                     # ticket de venta en PDF (jsPDF)
├── periodos.js                   # día / semana / mes / año: rangos, cubetas y navegación
├── inventario.js  empleados.js  reportes.js
├── pos.js                        # lectura del $jsonSchema, conversión de tipos, CRUD genérico
├── api.js                        # llamadas desde el navegador
├── format.js                     # formato de montos, fechas y etiquetas
└── http.js                       # errores -> respuestas HTTP
scripts/db.mjs                    # arranca mongod
```

## Cómo funciona
- **Fechas:** el script de carga guarda la hora local "de pared" como UTC (`"2026-10-01 10:07"` →
  `2026-10-01T10:07Z`). La app sigue la misma convención para las ventas nuevas y agrupa
  las estadísticas en UTC, así que las horas se ven tal como se registraron.
- **Ventas sin transacciones:** el MongoDB local es *standalone* y no admite transacciones.
  Por eso el inventario se descuenta con una condición (`cantidad_disponible >= cantidad`) y,
  si algo falla, se devuelve a mano. Los folios (venta, detalle, pago, comprobante) se calculan
  como el máximo + 1, y si chocan con el índice único se reintenta.
- **Tiempo real:** los *change streams* requieren un replica set, así que
  `/api/empleados/stream` consulta la colección cada 1.5 s y solo envía datos cuando cambian.
  El navegador se reconecta solo si se cae la conexión.
- **Esquema sin duplicar:** el administrador de colecciones lee el validador `$jsonSchema` de
  MongoDB para armar las tablas y los formularios y para convertir los tipos al guardar
  (`Decimal128`, `Date`, números, texto). MongoDB aplica las reglas del script (obligatorios,
  longitudes, `precio > 0`, `stock_maximo >= stock_minimo`, índices únicos) y la API devuelve el error.
- **Gráficas:** cada gráfica tiene una sola serie (ingresos en azul, mermas en naranja), con
  colores validados para daltonismo y contraste en modo claro y oscuro. Cada una va acompañada
  de su tabla de datos.
- **Llaves foráneas:** MongoDB no las valida. Si eliminas desde `/datos`, p. ej., un artículo
  usado en ventas, la referencia queda huérfana.
