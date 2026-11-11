// =====================================================================
//  POS MINORISTA - Versión NoSQL (MongoDB)
//  Ejecutar con:  mongosh pos_minorista_mongodb.js
//
//  Criterios de modelado:
//   - Cada PK relacional se usa como _id del documento.
//   - Entidades "dueñas" de sus hijos se EMBEBEN:
//       venta      -> detalles[], pagos[], comprobante
//       turno      -> movimientos[]  (movimiento_caja)
//       devolucion -> detalles[]     (detalle_devolucion)
//       pedido     -> detalles[], factura, entregas[]
//   - Catálogos compartidos se REFERENCIAN por su clave:
//       rol, empleado, caja, cliente, categoria, articulo,
//       almacen, proveedor
//   - inventario y merma quedan como colecciones propias.
//   - Dinero -> Decimal128 (NumberDecimal); fechas -> Date (UTC).
//   - Los CHECK / NOT NULL / UNIQUE se replican con $jsonSchema e índices.
//     MongoDB NO valida llaves foráneas: la integridad referencial
//     queda a cargo de la aplicación.
// =====================================================================

db = db.getSiblingDB("pos_minorista");
db.dropDatabase();

// ---------- Helpers ----------
const dec = v => (v === null || v === undefined) ? null : NumberDecimal(Number(v).toFixed(2));
const dt  = s => s ? new Date(s.length === 10 ? s + "T00:00:00Z" : s.replace(" ", "T") + "Z") : null;
const groupBy = (arr, key) => arr.reduce((m, x) => ((m[x[key]] ||= []).push(x), m), {});
const NUM = "number";               // int, long, double o decimal
const STR = "string";
const DATE = "date";
const DEC = "decimal";

// =====================================================================
//  COLECCIONES CON VALIDACIÓN
// =====================================================================

db.createCollection("roles", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "nombre"],
  properties: {
    _id: { bsonType: STR, maxLength: 10 },
    nombre: { bsonType: STR, maxLength: 50 },
    descripcion: { bsonType: [STR, "null"], maxLength: 200 }
  }
}}});

db.createCollection("empleados", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["_id", "nombre", "apellidos", "curp", "rfc", "fecha_ingreso", "salario", "horario", "estatus", "codigo_rol"],
  properties: {
    _id: { bsonType: NUM },
    nombre: { bsonType: STR, maxLength: 60 },
    apellidos: { bsonType: STR, maxLength: 80 },
    curp: { bsonType: STR, minLength: 18, maxLength: 18 },
    rfc: { bsonType: STR, maxLength: 13 },
    fecha_ingreso: { bsonType: DATE },
    salario: { bsonType: DEC, minimum: 0, exclusiveMinimum: true },
    horario: { bsonType: STR, maxLength: 30 },
    estatus: { bsonType: STR, maxLength: 20 },
    codigo_rol: { bsonType: STR }
  }
}}});

db.createCollection("cajas", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "saldo_actual", "estado"],
  properties: {
    _id: { bsonType: NUM },
    saldo_actual: { bsonType: DEC },
    estado: { bsonType: STR, maxLength: 20 }
  }
}}});

db.createCollection("turnos", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["_id", "fecha_apertura", "saldo_inicial", "estado", "numero_caja", "numero_empleado"],
  properties: {
    _id: { bsonType: NUM },
    fecha_apertura: { bsonType: DATE },
    fecha_cierre: { bsonType: [DATE, "null"] },
    saldo_inicial: { bsonType: DEC },
    saldo_final: { bsonType: [DEC, "null"] },
    estado: { bsonType: STR, maxLength: 20 },
    numero_caja: { bsonType: NUM },
    numero_empleado: { bsonType: NUM },
    movimientos: { bsonType: "array", items: {
      bsonType: "object", required: ["folio_movimiento", "tipo", "monto", "fecha_hora"],
      properties: {
        folio_movimiento: { bsonType: NUM },
        tipo: { bsonType: STR, maxLength: 20 },
        monto: { bsonType: DEC, minimum: 0, exclusiveMinimum: true },
        fecha_hora: { bsonType: DATE },
        motivo: { bsonType: [STR, "null"], maxLength: 150 }
      }
    }}
  }
}}});

db.createCollection("clientes", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "nombre"],
  properties: {
    _id: { bsonType: NUM },
    nombre: { bsonType: STR, maxLength: 100 },
    rfc: { bsonType: [STR, "null"], maxLength: 13 },
    correo: { bsonType: [STR, "null"], maxLength: 100 }
  }
}}});

db.createCollection("ventas", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["_id", "fecha", "estado", "subtotal", "descuento", "total", "numero_turno"],
  properties: {
    _id: { bsonType: NUM },
    fecha: { bsonType: DATE },
    estado: { bsonType: STR, maxLength: 20 },
    subtotal: { bsonType: DEC },
    descuento: { bsonType: DEC },
    total: { bsonType: DEC },
    numero_turno: { bsonType: NUM },
    numero_socio: { bsonType: [NUM, "null"] },
    detalles: { bsonType: "array", items: {
      bsonType: "object",
      required: ["folio_detalle_venta", "cantidad", "precio_unitario", "descuento", "importe", "codigo_articulo"],
      properties: {
        cantidad: { bsonType: NUM, minimum: 1 },
        precio_unitario: { bsonType: DEC },
        descuento: { bsonType: DEC },
        importe: { bsonType: DEC },
        codigo_articulo: { bsonType: STR }
      }
    }},
    pagos: { bsonType: "array", items: {
      bsonType: "object", required: ["folio_pago", "metodo_pago", "monto", "fecha"],
      properties: {
        metodo_pago: { bsonType: STR, maxLength: 30 },
        monto: { bsonType: DEC, minimum: 0, exclusiveMinimum: true },
        fecha: { bsonType: DATE }
      }
    }},
    comprobante: { bsonType: ["object", "null"],
      required: ["folio_comprobante", "tipo", "folio", "fecha_emision"] }
  }
}}});

db.createCollection("devoluciones", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["_id", "motivo", "fecha", "monto_devuelto", "estado", "folio_venta", "numero_empleado"],
  properties: {
    _id: { bsonType: NUM },
    motivo: { bsonType: STR, maxLength: 150 },
    fecha: { bsonType: DATE },
    monto_devuelto: { bsonType: DEC },
    estado: { bsonType: STR, maxLength: 20 },
    folio_venta: { bsonType: NUM },
    numero_empleado: { bsonType: NUM },
    detalles: { bsonType: "array", items: {
      bsonType: "object", required: ["folio_detalle_devolucion", "cantidad", "importe", "codigo_articulo"],
      properties: {
        cantidad: { bsonType: NUM, minimum: 1 },
        importe: { bsonType: DEC },
        codigo_articulo: { bsonType: STR }
      }
    }}
  }
}}});

db.createCollection("categorias", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "nombre"],
  properties: {
    _id: { bsonType: STR, maxLength: 10 },
    nombre: { bsonType: STR, maxLength: 50 },
    descripcion: { bsonType: [STR, "null"], maxLength: 200 }
  }
}}});

db.createCollection("articulos", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["_id", "codigo_barras", "nombre", "precio", "estado", "codigo_categoria"],
  properties: {
    _id: { bsonType: STR, maxLength: 10 },
    codigo_barras: { bsonType: STR, maxLength: 13 },
    nombre: { bsonType: STR, maxLength: 100 },
    descripcion: { bsonType: [STR, "null"], maxLength: 200 },
    precio: { bsonType: DEC, minimum: 0, exclusiveMinimum: true },
    estado: { bsonType: STR, maxLength: 20 },
    codigo_categoria: { bsonType: STR }
  }
}}});

db.createCollection("almacenes", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "nombre", "ubicacion", "capacidad"],
  properties: {
    _id: { bsonType: STR, maxLength: 10 },
    nombre: { bsonType: STR, maxLength: 60 },
    ubicacion: { bsonType: STR, maxLength: 150 },
    capacidad: { bsonType: NUM, minimum: 1 }
  }
}}});

db.createCollection("inventario", { validator: { $and: [
  { $jsonSchema: {
    bsonType: "object",
    required: ["_id", "cantidad_disponible", "stock_minimo", "stock_maximo", "fecha_actualizacion", "codigo_articulo", "codigo_almacen"],
    properties: {
      _id: { bsonType: NUM },
      cantidad_disponible: { bsonType: NUM, minimum: 0 },
      stock_minimo: { bsonType: NUM },
      stock_maximo: { bsonType: NUM },
      fecha_actualizacion: { bsonType: DATE },
      codigo_articulo: { bsonType: STR },
      codigo_almacen: { bsonType: STR }
    }
  }},
  { $expr: { $gte: ["$stock_maximo", "$stock_minimo"] } }   // CHECK (stock_maximo >= stock_minimo)
]}});

db.createCollection("mermas", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["_id", "fecha", "cantidad", "motivo", "codigo_articulo", "numero_empleado"],
  properties: {
    _id: { bsonType: NUM },
    fecha: { bsonType: DATE },
    cantidad: { bsonType: NUM, minimum: 1 },
    motivo: { bsonType: STR, maxLength: 150 },
    codigo_articulo: { bsonType: STR },
    numero_empleado: { bsonType: NUM }
  }
}}});

db.createCollection("proveedores", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "razon_social", "rfc"],
  properties: {
    _id: { bsonType: STR, maxLength: 10 },
    razon_social: { bsonType: STR, maxLength: 120 },
    rfc: { bsonType: STR, maxLength: 13 },
    telefono: { bsonType: [STR, "null"], maxLength: 15 },
    correo: { bsonType: [STR, "null"], maxLength: 100 }
  }
}}});

db.createCollection("pedidos", { validator: { $jsonSchema: {
  bsonType: "object", required: ["_id", "fecha", "estado", "total", "codigo_proveedor"],
  properties: {
    _id: { bsonType: NUM },
    fecha: { bsonType: DATE },
    estado: { bsonType: STR, maxLength: 20 },
    total: { bsonType: DEC },
    codigo_proveedor: { bsonType: STR },
    detalles: { bsonType: "array", items: {
      bsonType: "object", required: ["num_detalle_pedido", "cantidad", "costo_unitario", "importe", "codigo_articulo"],
      properties: {
        cantidad: { bsonType: NUM, minimum: 1 },
        costo_unitario: { bsonType: DEC },
        importe: { bsonType: DEC },
        codigo_articulo: { bsonType: STR }
      }
    }},
    factura: { bsonType: ["object", "null"],
      required: ["folio_factura", "folio_fiscal", "fecha_emision", "subtotal", "impuestos", "total"],
      properties: { folio_fiscal: { bsonType: STR, minLength: 36, maxLength: 36 } } },
    entregas: { bsonType: "array", items: {
      bsonType: "object", required: ["folio_entrega", "fecha_recepcion", "estatus", "codigo_almacen"]
    }}
  }
}}});

// =====================================================================
//  DATOS
// =====================================================================

// ---------- roles ----------
db.roles.insertMany([
  ["R01", "Gerente", "Administra la tienda y autoriza operaciones"],
  ["R02", "Cajero", "Opera la caja y registra ventas"],
  ["R03", "Almacenista", "Controla entradas y salidas del almacén"],
  ["R04", "Supervisor", "Supervisa turnos y autoriza devoluciones"],
  ["R05", "Auxiliar de piso", "Acomoda mercancía y atiende clientes"],
  ["R06", "Comprador", "Gestiona pedidos a proveedores"],
  ["R07", "Contador", "Lleva la contabilidad y facturación"],
  ["R08", "Encargado de inventario", "Realiza conteos y ajustes de inventario"],
  ["R09", "Seguridad", "Vigila accesos y prevención de pérdidas"],
  ["R10", "Recepcionista de mercancía", "Recibe entregas de proveedores"],
  ["R11", "Cajero senior", "Capacita cajeros y cubre cierres"],
  ["R12", "Atención a clientes", "Gestiona aclaraciones y devoluciones"],
  ["R13", "Soporte técnico", "Mantiene equipos POS y red"],
  ["R14", "Limpieza", "Mantiene limpias las áreas de venta"],
  ["R15", "Subgerente", "Apoya al gerente en la operación diaria"]
].map(([_id, nombre, descripcion]) => ({ _id, nombre, descripcion })));

// ---------- empleados ----------
db.empleados.insertMany([
  [101, "Carlos", "Ramírez Torres", "RATC900110HJCLRM00", "RATC900110A0K", "2018-01-01", 28000.00, "08:00-16:00", "Activo", "R01"],
  [102, "María", "González López", "GOLM910211MJCLSN01", "GOLM91021111K", "2019-02-02", 9500.00, "14:00-22:00", "Activo", "R02"],
  [103, "José", "Hernández Ruiz", "HERJ920312HJCLTP02", "HERJ920312B2K", "2020-03-03", 9500.00, "07:00-15:00", "Activo", "R02"],
  [104, "Ana", "Martínez Díaz", "MADA930413MJCLML03", "MADA93041323K", "2021-04-04", 14000.00, "08:00-16:00", "Activo", "R04"],
  [105, "Luis", "Pérez Castillo", "PECL940514HJCLNG04", "PECL940514C4K", "2022-05-05", 10500.00, "14:00-22:00", "Activo", "R03"],
  [106, "Laura", "Sánchez Vega", "SAVL950615MJCLPQ05", "SAVL95061535K", "2023-06-06", 9500.00, "07:00-15:00", "Activo", "R02"],
  [107, "Jorge", "Flores Morales", "FLMJ960716HJCLLR06", "FLMJ960716D6K", "2024-07-07", 16000.00, "08:00-16:00", "Activo", "R06"],
  [108, "Sofía", "Gómez Reyes", "GORS970817MJCLGS07", "GORS97081747K", "2018-08-08", 18000.00, "14:00-22:00", "Activo", "R07"],
  [109, "Miguel", "Cruz Ortiz", "CROM980918HJCLQT08", "CROM980918E8K", "2019-09-09", 12500.00, "07:00-15:00", "Activo", "R08"],
  [110, "Fernanda", "Jiménez Rojas", "JIRF901019MJCLRM09", "JIRF90101959K", "2020-10-10", 9500.00, "08:00-16:00", "Activo", "R02"],
  [111, "Ricardo", "Vargas Mendoza", "VAMR911120HJCLSN00", "VAMR911120F0K", "2021-11-11", 10000.00, "14:00-22:00", "Activo", "R10"],
  [112, "Daniela", "Castro Navarro", "CAND921221MJCLTP01", "CAND92122161K", "2022-12-12", 10500.00, "07:00-15:00", "Activo", "R12"],
  [113, "Alejandro", "Romero Silva", "ROSA930122HJCLML02", "ROSA930122G2K", "2023-01-13", 22000.00, "08:00-16:00", "Activo", "R15"],
  [114, "Valeria", "Herrera Guzmán", "HEGV940223MJCLNG03", "HEGV94022373K", "2024-02-14", 8800.00, "14:00-22:00", "Vacaciones", "R05"],
  [115, "Diego", "Medina Aguilar", "MEAD950324HJCLPQ04", "MEAD950324H4K", "2018-03-15", 11500.00, "07:00-15:00", "Activo", "R11"]
].map(([_id, nombre, apellidos, curp, rfc, fi, salario, horario, estatus, codigo_rol]) => ({
  _id, nombre, apellidos, curp, rfc, fecha_ingreso: dt(fi), salario: dec(salario), horario, estatus, codigo_rol
})));

// ---------- cajas ----------
db.cajas.insertMany([
  [1, 1730.00, "Abierta"], [2, 1960.00, "Abierta"], [3, 2190.00, "Abierta"],
  [4, 2420.00, "Abierta"], [5, 2650.00, "Abierta"], [6, 2880.00, "Abierta"],
  [7, 3110.00, "Abierta"], [8, 3340.00, "Abierta"], [9, 3570.00, "Abierta"],
  [10, 3800.00, "Abierta"], [11, 4030.00, "Cerrada"], [12, 4260.00, "Cerrada"],
  [13, 4490.00, "Cerrada"], [14, 4720.00, "Mantenimiento"], [15, 4950.00, "Mantenimiento"]
].map(([_id, saldo, estado]) => ({ _id, saldo_actual: dec(saldo), estado })));

// ---------- turnos (+ movimientos de caja embebidos) ----------
const movimientos = groupBy([
  [1, "Entrada", 250.00, "2026-10-01 11:30:00", "Fondo adicional de cambio", 1],
  [2, "Salida", 300.00, "2026-10-02 12:30:00", "Retiro parcial a caja fuerte", 2],
  [3, "Salida", 350.00, "2026-10-03 13:30:00", "Pago a proveedor de garrafones", 3],
  [4, "Entrada", 400.00, "2026-10-04 14:30:00", "Reposición de morralla", 4],
  [5, "Salida", 450.00, "2026-10-05 10:30:00", "Retiro por exceso de efectivo", 5],
  [6, "Entrada", 500.00, "2026-10-06 11:30:00", "Fondo adicional de cambio", 6],
  [7, "Salida", 550.00, "2026-10-07 12:30:00", "Retiro parcial a caja fuerte", 7],
  [8, "Salida", 600.00, "2026-10-08 13:30:00", "Pago a proveedor de garrafones", 8],
  [9, "Entrada", 650.00, "2026-10-09 14:30:00", "Reposición de morralla", 9],
  [10, "Salida", 700.00, "2026-10-10 10:30:00", "Retiro por exceso de efectivo", 10],
  [11, "Entrada", 750.00, "2026-10-11 11:30:00", "Fondo adicional de cambio", 11],
  [12, "Salida", 800.00, "2026-10-12 12:30:00", "Retiro parcial a caja fuerte", 12],
  [13, "Salida", 850.00, "2026-10-13 13:30:00", "Pago a proveedor de garrafones", 13],
  [14, "Entrada", 900.00, "2026-10-14 14:30:00", "Reposición de morralla", 14],
  [15, "Salida", 950.00, "2026-10-15 10:30:00", "Retiro por exceso de efectivo", 15]
].map(([folio_movimiento, tipo, monto, fh, motivo, numero_turno]) => ({
  folio_movimiento, tipo, monto: dec(monto), fecha_hora: dt(fh), motivo, numero_turno
})), "numero_turno");

db.turnos.insertMany([
  [1, "2026-10-01 08:00:00", "2026-10-01 16:00:00", 1000.00, 2925.50, "Cerrado", 1, 102],
  [2, "2026-10-02 08:00:00", "2026-10-02 16:00:00", 1000.00, 3050.50, "Cerrado", 2, 103],
  [3, "2026-10-03 08:00:00", "2026-10-03 16:00:00", 1000.00, 3175.50, "Cerrado", 3, 106],
  [4, "2026-10-04 08:00:00", "2026-10-04 16:00:00", 1000.00, 3300.50, "Cerrado", 4, 110],
  [5, "2026-10-05 08:00:00", "2026-10-05 16:00:00", 1000.00, 3425.50, "Cerrado", 5, 115],
  [6, "2026-10-06 08:00:00", "2026-10-06 16:00:00", 1000.00, 3550.50, "Cerrado", 6, 102],
  [7, "2026-10-07 08:00:00", "2026-10-07 16:00:00", 1000.00, 3675.50, "Cerrado", 7, 103],
  [8, "2026-10-08 08:00:00", "2026-10-08 16:00:00", 1000.00, 3800.50, "Cerrado", 8, 106],
  [9, "2026-10-09 08:00:00", "2026-10-09 16:00:00", 1000.00, 3925.50, "Cerrado", 9, 110],
  [10, "2026-10-10 08:00:00", "2026-10-10 16:00:00", 1000.00, 4050.50, "Cerrado", 10, 115],
  [11, "2026-10-11 08:00:00", "2026-10-11 16:00:00", 1000.00, 4175.50, "Cerrado", 11, 102],
  [12, "2026-10-12 08:00:00", "2026-10-12 16:00:00", 1000.00, 4300.50, "Cerrado", 12, 103],
  [13, "2026-10-13 08:00:00", null, 1000.00, null, "Abierto", 13, 106],
  [14, "2026-10-14 08:00:00", null, 1000.00, null, "Abierto", 14, 110],
  [15, "2026-10-15 08:00:00", null, 1000.00, null, "Abierto", 15, 115]
].map(([_id, ap, ci, si, sf, estado, numero_caja, numero_empleado]) => ({
  _id, fecha_apertura: dt(ap), fecha_cierre: dt(ci), saldo_inicial: dec(si), saldo_final: dec(sf),
  estado, numero_caja, numero_empleado,
  movimientos: (movimientos[_id] || []).map(({ numero_turno, ...m }) => m)
})));

// ---------- clientes ----------
db.clientes.insertMany([
  [1001, "Público en General", "XAXX010101000", null],
  [1002, "Roberto Aguirre Lara", "AULR850312H21", "roberto.aguirre@gmail.com"],
  [1003, "Patricia Núñez Soto", "NUSP900517KJ8", "patricia.nunez@hotmail.com"],
  [1004, "Abarrotes La Esperanza SA de CV", "AES1503104T7", "compras@laesperanza.mx"],
  [1005, "Héctor Salinas Peña", "SAPH780922L56", "hector.salinas@yahoo.com"],
  [1006, "Gabriela Ochoa Ríos", "OARG920204MN3", "gaby.ochoa@gmail.com"],
  [1007, "Tlapalería El Martillo", "TEM120815QW2", "ventas@elmartillo.mx"],
  [1008, "Andrés Campos Beltrán", "CABA880611BR4", "andres.campos@outlook.com"],
  [1009, "Mónica Zamora Ibarra", "ZAIM950728CV1", "monica.zamora@gmail.com"],
  [1010, "Papelería Lupita", "PLU101119HG5", "papeleria.lupita@gmail.com"],
  [1011, "Raúl Estrada Fuentes", "EAFR830405TP9", "raul.estrada@hotmail.com"],
  [1012, "Claudia Paredes León", "PALC910130DS6", "claudia.paredes@gmail.com"],
  [1013, "Óscar Valdez Mora", "VAMO870819JK2", "oscar.valdez@outlook.com"],
  [1014, "Isabel Cárdenas Luna", "CALI940223FG7", "isabel.cardenas@gmail.com"],
  [1015, "Comercializadora Tapatía SA de CV", "CTA180607ZX3", "contacto@comtapatia.mx"]
].map(([_id, nombre, rfc, correo]) => ({ _id, nombre, rfc, correo })));

// ---------- categorias ----------
db.categorias.insertMany([
  ["C01", "Abarrotes", "Productos básicos de despensa"],
  ["C02", "Bebidas", "Refrescos, jugos y agua"],
  ["C03", "Lácteos", "Leche, quesos y yogures"],
  ["C04", "Limpieza", "Productos de limpieza del hogar"],
  ["C05", "Higiene personal", "Cuidado personal e higiene"],
  ["C06", "Botanas", "Frituras y snacks"],
  ["C07", "Dulcería", "Dulces y chocolates"],
  ["C08", "Panadería", "Pan empacado y galletas"],
  ["C09", "Enlatados", "Conservas y alimentos enlatados"],
  ["C10", "Cereales", "Cereales y avenas"],
  ["C11", "Congelados", "Productos congelados"],
  ["C12", "Mascotas", "Alimento y accesorios para mascotas"],
  ["C13", "Papelería", "Artículos escolares y de oficina"],
  ["C14", "Ferretería", "Herramientas y artículos básicos"],
  ["C15", "Electrónica", "Pilas, cables y accesorios"]
].map(([_id, nombre, descripcion]) => ({ _id, nombre, descripcion })));

// ---------- articulos ----------
db.articulos.insertMany([
  ["A001", "7501001000000", "Arroz Morelos 1 kg", "Arroz grano largo", 32.50, "Activo", "C01"],
  ["A002", "7501002007919", "Refresco de cola 2 L", "Bebida gaseosa sabor cola", 38.00, "Activo", "C02"],
  ["A003", "7501003015838", "Leche entera 1 L", "Leche ultrapasteurizada", 27.90, "Activo", "C03"],
  ["A004", "7501004023757", "Detergente en polvo 1 kg", "Detergente multiusos", 45.50, "Activo", "C04"],
  ["A005", "7501005031676", "Shampoo 750 ml", "Shampoo para cabello normal", 69.00, "Activo", "C05"],
  ["A006", "7501006039595", "Papas fritas 170 g", "Papas sabor natural", 42.00, "Activo", "C06"],
  ["A007", "7501007047514", "Chocolate de leche 100 g", "Tableta de chocolate", 25.00, "Activo", "C07"],
  ["A008", "7501008055433", "Pan blanco grande", "Pan de caja 680 g", 54.00, "Activo", "C08"],
  ["A009", "7501009063352", "Atún en agua 140 g", "Atún aleta amarilla", 23.50, "Activo", "C09"],
  ["A010", "7501010071271", "Hojuelas de maíz 500 g", "Cereal de maíz tostado", 58.00, "Activo", "C10"],
  ["A011", "7501011079190", "Verduras mixtas 500 g", "Mezcla de verduras congeladas", 36.00, "Descontinuado", "C11"],
  ["A012", "7501012087109", "Croquetas perro adulto 2 kg", "Alimento seco para perro", 115.00, "Activo", "C12"],
  ["A013", "7501013095028", "Cuaderno profesional 100 h", "Cuaderno de raya", 48.00, "Activo", "C13"],
  ["A014", "7501014102947", "Cinta aislante 18 m", "Cinta de PVC negra", 19.50, "Activo", "C14"],
  ["A015", "7501015110866", "Pilas AA paquete 4", "Pilas alcalinas", 72.00, "Activo", "C15"]
].map(([_id, codigo_barras, nombre, descripcion, precio, estado, codigo_categoria]) => ({
  _id, codigo_barras, nombre, descripcion, precio: dec(precio), estado, codigo_categoria
})));

// ---------- ventas (+ detalles, pagos y comprobante embebidos) ----------
const detallesVenta = groupBy([
  [1, 2, 32.50, 0.00, 65.00, 1, "A001"],
  [2, 3, 38.00, 0.00, 114.00, 2, "A002"],
  [3, 4, 27.90, 5.00, 106.60, 3, "A003"],
  [4, 1, 45.50, 0.00, 45.50, 4, "A004"],
  [5, 2, 69.00, 0.00, 138.00, 5, "A005"],
  [6, 3, 42.00, 5.00, 121.00, 6, "A006"],
  [7, 4, 25.00, 0.00, 100.00, 7, "A007"],
  [8, 1, 54.00, 0.00, 54.00, 8, "A008"],
  [9, 2, 23.50, 5.00, 42.00, 9, "A009"],
  [10, 3, 58.00, 0.00, 174.00, 10, "A010"],
  [11, 4, 36.00, 0.00, 144.00, 11, "A011"],
  [12, 1, 115.00, 5.00, 110.00, 12, "A012"],
  [13, 2, 48.00, 0.00, 96.00, 13, "A013"],
  [14, 3, 19.50, 0.00, 58.50, 14, "A014"],
  [15, 4, 72.00, 5.00, 283.00, 15, "A015"]
].map(([folio_detalle_venta, cantidad, pu, desc, importe, folio_venta, codigo_articulo]) => ({
  folio_detalle_venta, cantidad, precio_unitario: dec(pu), descuento: dec(desc), importe: dec(importe),
  codigo_articulo, folio_venta
})), "folio_venta");

const pagos = groupBy([
  [1, "Efectivo", 65.00, "2026-10-01 10:07:00", 1],
  [2, "Tarjeta de débito", 114.00, "2026-10-02 11:14:00", 2],
  [3, "Tarjeta de crédito", 106.60, "2026-10-03 12:21:00", 3],
  [4, "Transferencia", 45.50, "2026-10-04 13:28:00", 4],
  [5, "Vales de despensa", 138.00, "2026-10-05 14:35:00", 5],
  [6, "Efectivo", 121.00, "2026-10-06 15:42:00", 6],
  [7, "Tarjeta de débito", 100.00, "2026-10-07 09:49:00", 7],
  [8, "Tarjeta de crédito", 54.00, "2026-10-08 10:56:00", 8],
  [9, "Transferencia", 42.00, "2026-10-09 11:03:00", 9],
  [10, "Vales de despensa", 174.00, "2026-10-10 12:10:00", 10],
  [11, "Efectivo", 144.00, "2026-10-11 13:17:00", 11],
  [12, "Tarjeta de débito", 110.00, "2026-10-12 14:24:00", 12],
  [13, "Tarjeta de crédito", 96.00, "2026-10-13 15:31:00", 13],
  [14, "Transferencia", 58.50, "2026-10-14 09:38:00", 14],
  [15, "Vales de despensa", 283.00, "2026-10-15 10:45:00", 15]
].map(([folio_pago, metodo_pago, monto, fecha, folio_venta]) => ({
  folio_pago, metodo_pago, monto: dec(monto), fecha: dt(fecha), folio_venta
})), "folio_venta");

const comprobantes = groupBy([
  [1, "Ticket", "T-2026-00001", "2026-10-01 10:07:00", 1],
  [2, "Factura", "F-2026-00002", "2026-10-02 11:14:00", 2],
  [3, "Ticket", "T-2026-00003", "2026-10-03 12:21:00", 3],
  [4, "Factura", "F-2026-00004", "2026-10-04 13:28:00", 4],
  [5, "Ticket", "T-2026-00005", "2026-10-05 14:35:00", 5],
  [6, "Factura", "F-2026-00006", "2026-10-06 15:42:00", 6],
  [7, "Ticket", "T-2026-00007", "2026-10-07 09:49:00", 7],
  [8, "Factura", "F-2026-00008", "2026-10-08 10:56:00", 8],
  [9, "Ticket", "T-2026-00009", "2026-10-09 11:03:00", 9],
  [10, "Factura", "F-2026-00010", "2026-10-10 12:10:00", 10],
  [11, "Ticket", "T-2026-00011", "2026-10-11 13:17:00", 11],
  [12, "Factura", "F-2026-00012", "2026-10-12 14:24:00", 12],
  [13, "Ticket", "T-2026-00013", "2026-10-13 15:31:00", 13],
  [14, "Factura", "F-2026-00014", "2026-10-14 09:38:00", 14],
  [15, "Ticket", "T-2026-00015", "2026-10-15 10:45:00", 15]
].map(([folio_comprobante, tipo, folio, fe, folio_venta]) => ({
  folio_comprobante, tipo, folio, fecha_emision: dt(fe), folio_venta
})), "folio_venta");

const sinFolioVenta = ({ folio_venta, ...rest }) => rest;

db.ventas.insertMany([
  [1, "2026-10-01", "10:07:00", "Pagada", 65.00, 0.00, 65.00, 1, 1001],
  [2, "2026-10-02", "11:14:00", "Pagada", 114.00, 0.00, 114.00, 2, 1002],
  [3, "2026-10-03", "12:21:00", "Pagada", 111.60, 5.00, 106.60, 3, 1003],
  [4, "2026-10-04", "13:28:00", "Devuelta", 45.50, 0.00, 45.50, 4, 1004],
  [5, "2026-10-05", "14:35:00", "Pagada", 138.00, 0.00, 138.00, 5, 1005],
  [6, "2026-10-06", "15:42:00", "Pagada", 126.00, 5.00, 121.00, 6, 1006],
  [7, "2026-10-07", "09:49:00", "Pagada", 100.00, 0.00, 100.00, 7, 1007],
  [8, "2026-10-08", "10:56:00", "Pagada", 54.00, 0.00, 54.00, 8, 1008],
  [9, "2026-10-09", "11:03:00", "Devuelta", 47.00, 5.00, 42.00, 9, 1009],
  [10, "2026-10-10", "12:10:00", "Pagada", 174.00, 0.00, 174.00, 10, 1010],
  [11, "2026-10-11", "13:17:00", "Pagada", 144.00, 0.00, 144.00, 11, 1011],
  [12, "2026-10-12", "14:24:00", "Pagada", 115.00, 5.00, 110.00, 12, 1012],
  [13, "2026-10-13", "15:31:00", "Pagada", 96.00, 0.00, 96.00, 13, 1013],
  [14, "2026-10-14", "09:38:00", "Pagada", 58.50, 0.00, 58.50, 14, 1014],
  [15, "2026-10-15", "10:45:00", "Pagada", 288.00, 5.00, 283.00, 15, 1015]
].map(([_id, fecha, hora, estado, subtotal, descuento, total, numero_turno, numero_socio]) => ({
  _id,
  fecha: dt(`${fecha} ${hora}`),          // DATE + TIME se unen en un solo Date
  estado,
  subtotal: dec(subtotal), descuento: dec(descuento), total: dec(total),
  numero_turno, numero_socio,
  detalles: (detallesVenta[_id] || []).map(sinFolioVenta),
  pagos: (pagos[_id] || []).map(sinFolioVenta),
  comprobante: comprobantes[_id] ? sinFolioVenta(comprobantes[_id][0]) : null   // relación 1:1
})));

// ---------- devoluciones (+ detalles embebidos) ----------
const detallesDev = groupBy([
  [1, 1, 32.50, 1, "A001"], [2, 1, 38.00, 2, "A002"], [3, 1, 27.90, 3, "A003"],
  [4, 1, 45.50, 4, "A004"], [5, 1, 69.00, 5, "A005"], [6, 1, 42.00, 6, "A006"],
  [7, 1, 25.00, 7, "A007"], [8, 1, 54.00, 8, "A008"], [9, 1, 23.50, 9, "A009"],
  [10, 1, 58.00, 10, "A010"], [11, 1, 36.00, 11, "A011"], [12, 1, 115.00, 12, "A012"],
  [13, 1, 48.00, 13, "A013"], [14, 1, 19.50, 14, "A014"], [15, 1, 72.00, 15, "A015"]
].map(([folio_detalle_devolucion, cantidad, importe, folio_devolucion, codigo_articulo]) => ({
  folio_detalle_devolucion, cantidad, importe: dec(importe), codigo_articulo, folio_devolucion
})), "folio_devolucion");

db.devoluciones.insertMany([
  [1, "Producto caducado", "2026-10-01", 32.50, "Aprobada", 1, 101],
  [2, "Empaque dañado", "2026-10-02", 38.00, "Aprobada", 2, 104],
  [3, "Producto defectuoso", "2026-10-03", 27.90, "Aprobada", 3, 112],
  [4, "Cliente cambió de opinión", "2026-10-04", 45.50, "Rechazada", 4, 101],
  [5, "Error en el cobro", "2026-10-05", 69.00, "Aprobada", 5, 104],
  [6, "Producto caducado", "2026-10-06", 42.00, "Aprobada", 6, 112],
  [7, "Empaque dañado", "2026-10-07", 25.00, "Aprobada", 7, 101],
  [8, "Producto defectuoso", "2026-10-08", 54.00, "Rechazada", 8, 104],
  [9, "Cliente cambió de opinión", "2026-10-09", 23.50, "Aprobada", 9, 112],
  [10, "Error en el cobro", "2026-10-10", 58.00, "Aprobada", 10, 101],
  [11, "Producto caducado", "2026-10-11", 36.00, "Aprobada", 11, 104],
  [12, "Empaque dañado", "2026-10-12", 115.00, "Rechazada", 12, 112],
  [13, "Producto defectuoso", "2026-10-13", 48.00, "Aprobada", 13, 101],
  [14, "Cliente cambió de opinión", "2026-10-14", 19.50, "Aprobada", 14, 104],
  [15, "Error en el cobro", "2026-10-15", 72.00, "Aprobada", 15, 112]
].map(([_id, motivo, fecha, monto, estado, folio_venta, numero_empleado]) => ({
  _id, motivo, fecha: dt(fecha), monto_devuelto: dec(monto), estado, folio_venta, numero_empleado,
  detalles: (detallesDev[_id] || []).map(({ folio_devolucion, ...d }) => d)
})));

// ---------- almacenes ----------
db.almacenes.insertMany([
  ["AL01", "Almacén Central", "Av. Vallarta 1520, Guadalajara, Jal.", 5000],
  ["AL02", "Bodega Norte", "Av. Federalismo 3200, Zapopan, Jal.", 3500],
  ["AL03", "Bodega Sur", "Av. López Mateos Sur 4100, Tlaquepaque, Jal.", 3000],
  ["AL04", "Bodega Oriente", "Calz. Independencia 890, Guadalajara, Jal.", 2500],
  ["AL05", "Cuarto Frío", "Av. Vallarta 1520 Int. B, Guadalajara, Jal.", 800],
  ["AL06", "Bodega Tonalá", "Av. Tonaltecas 220, Tonalá, Jal.", 2000],
  ["AL07", "Bodega Tlajomulco", "Carr. a Chapala 1500, Tlajomulco, Jal.", 4000],
  ["AL08", "Piso de Venta 1", "Av. Vallarta 1520, Guadalajara, Jal.", 600],
  ["AL09", "Piso de Venta 2", "Av. Patria 1200, Zapopan, Jal.", 600],
  ["AL10", "Bodega Mascotas", "Av. Mariano Otero 3300, Zapopan, Jal.", 900],
  ["AL11", "Bodega Papelería", "Av. Juárez 450, Guadalajara, Jal.", 700],
  ["AL12", "Bodega Ferretería", "Av. Revolución 2100, Guadalajara, Jal.", 1200],
  ["AL13", "Bodega Electrónica", "Av. Américas 1800, Guadalajara, Jal.", 500],
  ["AL14", "Bodega Temporal", "Periférico Norte 1500, Zapopan, Jal.", 1500],
  ["AL15", "Bodega de Devoluciones", "Av. Vallarta 1520 Int. C, Guadalajara, Jal.", 400]
].map(([_id, nombre, ubicacion, capacidad]) => ({ _id, nombre, ubicacion, capacidad })));

// ---------- inventario ----------
db.inventario.insertMany([
  [1, 53, 20, 210, "2026-10-01 18:00:00", "A001", "AL01"],
  [2, 66, 20, 220, "2026-10-02 18:00:00", "A002", "AL02"],
  [3, 79, 20, 230, "2026-10-03 18:00:00", "A003", "AL05"],
  [4, 92, 20, 240, "2026-10-04 18:00:00", "A004", "AL03"],
  [5, 105, 20, 250, "2026-10-05 18:00:00", "A005", "AL04"],
  [6, 118, 20, 260, "2026-10-06 18:00:00", "A006", "AL06"],
  [7, 131, 20, 270, "2026-10-07 18:00:00", "A007", "AL07"],
  [8, 144, 20, 280, "2026-10-08 18:00:00", "A008", "AL08"],
  [9, 157, 20, 290, "2026-10-09 18:00:00", "A009", "AL01"],
  [10, 170, 20, 300, "2026-10-10 18:00:00", "A010", "AL09"],
  [11, 183, 20, 310, "2026-10-11 18:00:00", "A011", "AL05"],
  [12, 196, 20, 320, "2026-10-12 18:00:00", "A012", "AL10"],
  [13, 209, 20, 330, "2026-10-13 18:00:00", "A013", "AL11"],
  [14, 222, 20, 340, "2026-10-14 18:00:00", "A014", "AL12"],
  [15, 235, 20, 350, "2026-10-15 18:00:00", "A015", "AL13"]
].map(([_id, cantidad_disponible, stock_minimo, stock_maximo, fa, codigo_articulo, codigo_almacen]) => ({
  _id, cantidad_disponible, stock_minimo, stock_maximo, fecha_actualizacion: dt(fa), codigo_articulo, codigo_almacen
})));

// ---------- mermas ----------
db.mermas.insertMany([
  [1, "2026-10-01", 2, "Caducidad", "A005", 105],
  [2, "2026-10-02", 3, "Rotura en anaquel", "A009", 109],
  [3, "2026-10-03", 4, "Robo hormiga", "A013", 111],
  [4, "2026-10-04", 5, "Daño en transporte", "A002", 105],
  [5, "2026-10-05", 1, "Falla de refrigeración", "A006", 109],
  [6, "2026-10-06", 2, "Caducidad", "A010", 111],
  [7, "2026-10-07", 3, "Rotura en anaquel", "A014", 105],
  [8, "2026-10-08", 4, "Robo hormiga", "A003", 109],
  [9, "2026-10-09", 5, "Daño en transporte", "A007", 111],
  [10, "2026-10-10", 1, "Falla de refrigeración", "A011", 105],
  [11, "2026-10-11", 2, "Caducidad", "A015", 109],
  [12, "2026-10-12", 3, "Rotura en anaquel", "A004", 111],
  [13, "2026-10-13", 4, "Robo hormiga", "A008", 105],
  [14, "2026-10-14", 5, "Daño en transporte", "A012", 109],
  [15, "2026-10-15", 1, "Falla de refrigeración", "A001", 111]
].map(([_id, fecha, cantidad, motivo, codigo_articulo, numero_empleado]) => ({
  _id, fecha: dt(fecha), cantidad, motivo, codigo_articulo, numero_empleado
})));

// ---------- proveedores ----------
db.proveedores.insertMany([
  ["P01", "Distribuidora de Granos del Bajío SA de CV", "DGB1203157H2", "3312345601", "ventas@granosbajio.mx"],
  ["P02", "Embotelladora de Occidente SA de CV", "EOC0905226K9", "3312345602", "pedidos@embotelladoraoc.mx"],
  ["P03", "Lácteos de Los Altos SA de CV", "LAL1107183P1", "3787123403", "contacto@lacteosaltos.mx"],
  ["P04", "Químicos y Limpieza Jalisco SA de CV", "QLJ1402119R5", "3312345604", "ventas@qlj.mx"],
  ["P05", "Cuidado Personal del Pacífico SA de CV", "CPP1510064T3", "3312345605", "pedidos@cpp.mx"],
  ["P06", "Botanas Tapatías SA de CV", "BTA1306302M8", "3312345606", "ventas@botanastapatias.mx"],
  ["P07", "Confitería Mexicana SA de CV", "CME0812129N4", "5512345607", "ventas@confimex.mx"],
  ["P08", "Panificadora Guadalajara SA de CV", "PGU1001154J7", "3312345608", "pedidos@panigdl.mx"],
  ["P09", "Conservas del Golfo SA de CV", "CGO1109227L2", "2291234509", "ventas@conservasgolfo.mx"],
  ["P10", "Cereales Nacionales SA de CV", "CNA1204188X6", "5512345610", "contacto@cerealesnac.mx"],
  ["P11", "Congelados del Norte SA de CV", "CNO1508089B3", "8112345611", "ventas@congeladosnorte.mx"],
  ["P12", "Nutrición Animal de Occidente SA de CV", "NAO1605173C9", "3312345612", "pedidos@naoccidente.mx"],
  ["P13", "Papelera Escolar de Jalisco SA de CV", "PEJ1703246D1", "3312345613", "ventas@papeleraej.mx"],
  ["P14", "Ferretera Industrial GDL SA de CV", "FIG1802075E8", "3312345614", "ventas@ferreteragdl.mx"],
  ["P15", "Electrónicos y Energía SA de CV", "EEN1909138F5", "5512345615", "pedidos@electroenergia.mx"]
].map(([_id, razon_social, rfc, telefono, correo]) => ({ _id, razon_social, rfc, telefono, correo })));

// ---------- pedidos (+ detalles, factura y entregas embebidos) ----------
const detallesPedido = groupBy([
  [1, 60, 22.75, 1365.00, 1, "A001"],
  [2, 70, 26.60, 1862.00, 2, "A002"],
  [3, 80, 19.53, 1562.40, 3, "A003"],
  [4, 90, 31.85, 2866.50, 4, "A004"],
  [5, 100, 48.30, 4830.00, 5, "A005"],
  [6, 110, 29.40, 3234.00, 6, "A006"],
  [7, 120, 17.50, 2100.00, 7, "A007"],
  [8, 130, 37.80, 4914.00, 8, "A008"],
  [9, 140, 16.45, 2303.00, 9, "A009"],
  [10, 150, 40.60, 6090.00, 10, "A010"],
  [11, 160, 25.20, 4032.00, 11, "A011"],
  [12, 170, 80.50, 13685.00, 12, "A012"],
  [13, 180, 33.60, 6048.00, 13, "A013"],
  [14, 190, 13.65, 2593.50, 14, "A014"],
  [15, 200, 50.40, 10080.00, 15, "A015"]
].map(([num_detalle_pedido, cantidad, cu, importe, folio_pedido, codigo_articulo]) => ({
  num_detalle_pedido, cantidad, costo_unitario: dec(cu), importe: dec(importe), codigo_articulo, folio_pedido
})), "folio_pedido");

const facturas = groupBy([
  [1, "6513270E-269E-0D37-F2A7-4DE452E6B438", "2026-09-12", 1365.00, 218.40, 1583.40, 1],
  [2, "D23F0824-128B-2F33-0C5C-7FD0A6A3A450", "2026-09-13", 1862.00, 297.92, 2159.92, 2],
  [3, "9531985D-5D9D-C9F8-1818-E811892F902B", "2026-09-14", 1562.40, 249.98, 1812.38, 3],
  [4, "36F675CC-81E7-4EF5-E8E2-5D940ED90475", "2026-09-15", 2866.50, 458.64, 3325.14, 4],
  [5, "6B0D549B-6F03-675A-1600-A35A099950D8", "2026-09-16", 4830.00, 772.80, 5602.80, 5],
  [6, "8D116ECE-1738-F7D9-3D9C-172411E20B8F", "2026-09-17", 3234.00, 517.44, 3751.44, 6],
  [7, "90C192CF-D3AC-94AF-0F21-DDB66CAD4A26", "2026-09-18", 2100.00, 336.00, 2436.00, 7],
  [8, "A170B338-3926-3059-F28C-105D1FB17C23", "2026-09-19", 4914.00, 786.24, 5700.24, 8],
  [9, "0FD630F1-F29D-0DA9-953F-48F1A09F76B5", "2026-09-20", 2303.00, 368.48, 2671.48, 9],
  [10, "0CB1E29C-658C-DA14-95E6-0AF593BD04CF", "2026-09-21", 6090.00, 974.40, 7064.40, 10],
  [11, "8E81973E-0BEC-D7B0-3898-D190F9EBDACC", "2026-09-22", 4032.00, 645.12, 4677.12, 11],
  [12, "6B4CB242-4A23-D596-2217-BEADDBC496CB", "2026-09-23", 13685.00, 2189.60, 15874.60, 12],
  [13, "92276658-1E27-A1C0-8A6A-63EC24EDE6A4", "2026-09-24", 6048.00, 967.68, 7015.68, 13],
  [14, "AE97BA94-D0ED-A82F-8F6D-05584EF8AA38", "2026-09-25", 2593.50, 414.96, 3008.46, 14],
  [15, "923A7369-94E3-BF91-1A61-DBE22E44158B", "2026-09-26", 10080.00, 1612.80, 11692.80, 15]
].map(([folio_factura, folio_fiscal, fe, subtotal, impuestos, total, folio_pedido]) => ({
  folio_factura, folio_fiscal, fecha_emision: dt(fe),
  subtotal: dec(subtotal), impuestos: dec(impuestos), total: dec(total), folio_pedido
})), "folio_pedido");

const entregas = groupBy([
  [1, "2026-09-14", "Completa", 1, "AL01"],
  [2, "2026-09-15", "Completa", 2, "AL02"],
  [3, "2026-09-16", "Completa", 3, "AL05"],
  [4, "2026-09-17", "Completa", 4, "AL03"],
  [5, "2026-09-18", "Completa", 5, "AL04"],
  [6, "2026-09-19", "Completa", 6, "AL06"],
  [7, "2026-09-20", "Completa", 7, "AL07"],
  [8, "2026-09-21", "Completa", 8, "AL08"],
  [9, "2026-09-22", "Completa", 9, "AL01"],
  [10, "2026-09-23", "Completa", 10, "AL09"],
  [11, "2026-09-24", "Completa", 11, "AL05"],
  [12, "2026-09-25", "Completa", 12, "AL10"],
  [13, "2026-09-26", "Parcial", 13, "AL11"],
  [14, "2026-09-27", "Parcial", 14, "AL12"],
  [15, "2026-09-28", "Programada", 15, "AL13"]
].map(([folio_entrega, fr, estatus, folio_pedido, codigo_almacen]) => ({
  folio_entrega, fecha_recepcion: dt(fr), estatus, codigo_almacen, folio_pedido
})), "folio_pedido");

const sinFolioPedido = ({ folio_pedido, ...rest }) => rest;

db.pedidos.insertMany([
  [1, "2026-09-11", "Recibido", 1365.00, "P01"],
  [2, "2026-09-12", "Recibido", 1862.00, "P02"],
  [3, "2026-09-13", "Recibido", 1562.40, "P03"],
  [4, "2026-09-14", "Recibido", 2866.50, "P04"],
  [5, "2026-09-15", "Recibido", 4830.00, "P05"],
  [6, "2026-09-16", "Recibido", 3234.00, "P06"],
  [7, "2026-09-17", "Recibido", 2100.00, "P07"],
  [8, "2026-09-18", "Recibido", 4914.00, "P08"],
  [9, "2026-09-19", "Recibido", 2303.00, "P09"],
  [10, "2026-09-20", "Recibido", 6090.00, "P10"],
  [11, "2026-09-21", "Recibido", 4032.00, "P11"],
  [12, "2026-09-22", "Recibido", 13685.00, "P12"],
  [13, "2026-09-23", "En tránsito", 6048.00, "P13"],
  [14, "2026-09-24", "En tránsito", 2593.50, "P14"],
  [15, "2026-09-25", "Pendiente", 10080.00, "P15"]
].map(([_id, fecha, estado, total, codigo_proveedor]) => ({
  _id, fecha: dt(fecha), estado, total: dec(total), codigo_proveedor,
  detalles: (detallesPedido[_id] || []).map(sinFolioPedido),
  factura: facturas[_id] ? sinFolioPedido(facturas[_id][0]) : null,    // relación 1:1
  entregas: (entregas[_id] || []).map(sinFolioPedido)
})));

// =====================================================================
//  ÍNDICES  (UNIQUE del modelo relacional + índices para "llaves foráneas")
// =====================================================================
db.empleados.createIndex({ curp: 1 }, { unique: true });
db.empleados.createIndex({ rfc: 1 }, { unique: true });
db.empleados.createIndex({ codigo_rol: 1 });

db.turnos.createIndex({ numero_caja: 1 });
db.turnos.createIndex({ numero_empleado: 1 });
db.turnos.createIndex({ "movimientos.folio_movimiento": 1 }, { unique: true, sparse: true });

db.ventas.createIndex({ "comprobante.folio": 1 }, { unique: true, partialFilterExpression: { "comprobante.folio": { $exists: true } } });
db.ventas.createIndex({ "comprobante.folio_comprobante": 1 }, { unique: true, partialFilterExpression: { "comprobante.folio_comprobante": { $exists: true } } });
db.ventas.createIndex({ numero_turno: 1 });
db.ventas.createIndex({ numero_socio: 1 });
db.ventas.createIndex({ fecha: 1 });
db.ventas.createIndex({ "detalles.codigo_articulo": 1 });

db.devoluciones.createIndex({ folio_venta: 1 });
db.devoluciones.createIndex({ numero_empleado: 1 });

db.articulos.createIndex({ codigo_barras: 1 }, { unique: true });
db.articulos.createIndex({ codigo_categoria: 1 });

db.inventario.createIndex({ codigo_articulo: 1, codigo_almacen: 1 }, { unique: true });
db.inventario.createIndex({ codigo_almacen: 1 });

db.mermas.createIndex({ codigo_articulo: 1 });
db.mermas.createIndex({ numero_empleado: 1 });

db.proveedores.createIndex({ rfc: 1 }, { unique: true });

db.pedidos.createIndex({ codigo_proveedor: 1 });
db.pedidos.createIndex({ "factura.folio_fiscal": 1 }, { unique: true, partialFilterExpression: { "factura.folio_fiscal": { $exists: true } } });
db.pedidos.createIndex({ "factura.folio_factura": 1 }, { unique: true, partialFilterExpression: { "factura.folio_factura": { $exists: true } } });

// =====================================================================
//  RESUMEN
// =====================================================================
print("\nBase de datos 'pos_minorista' creada. Documentos por colección:");
db.getCollectionNames().sort().forEach(c => print(`  ${c.padEnd(14)} ${db[c].countDocuments()}`));

// =====================================================================
//  CONSULTAS DE EJEMPLO (equivalentes a JOINs)
// =====================================================================

// 1) Venta con nombre del cliente, cajero y nombre de cada artículo
printjson(db.ventas.aggregate([
  { $match: { _id: 3 } },
  { $lookup: { from: "clientes", localField: "numero_socio", foreignField: "_id", as: "cliente" } },
  { $lookup: { from: "turnos", localField: "numero_turno", foreignField: "_id", as: "turno" } },
  { $lookup: { from: "empleados", localField: "turno.numero_empleado", foreignField: "_id", as: "cajero" } },
  { $lookup: { from: "articulos", localField: "detalles.codigo_articulo", foreignField: "_id", as: "articulos" } },
  { $project: {
      fecha: 1, total: 1,
      cliente: { $first: "$cliente.nombre" },
      cajero: { $first: "$cajero.nombre" },
      articulos: "$articulos.nombre",
      comprobante: "$comprobante.folio"
  }}
]).toArray());

// 2) Artículos por debajo de 1.5x su stock mínimo (alerta de reabasto)
// db.inventario.find({ $expr: { $lt: ["$cantidad_disponible", { $multiply: ["$stock_minimo", 1.5] }] } });

// 3) Total vendido por método de pago
// db.ventas.aggregate([
//   { $unwind: "$pagos" },
//   { $group: { _id: "$pagos.metodo_pago", total: { $sum: "$pagos.monto" }, ventas: { $sum: 1 } } },
//   { $sort: { total: -1 } }
// ]);
