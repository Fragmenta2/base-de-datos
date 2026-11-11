import { NextResponse } from 'next/server';
import { fieldLabel } from './format';

export function handleError(err) {
  // Errores de la app con estado propio (400 datos inválidos, 409 en uso...)
  if (err.status && err.status < 500) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  // 121 = DocumentValidationFailure: el documento no cumple el $jsonSchema de la colección
  if (err.code === 121) {
    const problemas = explicarValidacion(err.errInfo);
    return NextResponse.json(
      {
        error: problemas.length
          ? `Revisa: ${problemas.join('; ')}`
          : 'El documento no cumple las reglas de validación de la colección',
        problemas,
      },
      { status: 400 }
    );
  }
  if (err.code === 11000) {
    const campos = Object.entries(err.keyValue ?? {}).map(([k, v]) => `${fieldLabel(k)} = ${v}`).join(', ');
    return NextResponse.json({ error: `Ya existe un registro con ${campos || 'ese valor único'}` }, { status: 409 });
  }
  if (/ServerSelectionError/.test(err.name)) {
    return NextResponse.json(
      { error: 'No se pudo conectar a MongoDB. ¿Está corriendo "npm run db"?' },
      { status: 503 }
    );
  }
  console.error(err);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}

// Traduce el detalle de un rechazo de $jsonSchema a frases como
// "Precio: debe ser mayor a 0" o "Detalles › renglón 1 › Cantidad: debe ser al menos 1"
function explicarValidacion(errInfo) {
  const problemas = [];
  const prefijo = (ruta) => (ruta.length ? `${ruta.join(' › ')}: ` : '');

  const recorrer = (regla, ruta) => {
    if (!regla) return;
    for (const c of regla.clausesNotSatisfied ?? []) recorrer(c.details, ruta); // $and (p. ej. inventario)
    for (const r of regla.schemaRulesNotSatisfied ?? []) recorrer(r, ruta);
    for (const p of regla.propertiesNotSatisfied ?? []) {
      for (const d of p.details ?? []) recorrer(d, [...ruta, fieldLabel(p.propertyName)]);
    }
    if (regla.missingProperties?.length) {
      problemas.push(`${prefijo(ruta)}faltan ${regla.missingProperties.map(fieldLabel).join(', ')}`);
    }
    if (regla.operatorName === 'items') {
      for (const d of regla.details ?? []) recorrer(d, [...ruta, `renglón ${regla.itemIndex + 1}`]);
      return;
    }
    const motivo = motivoDe(regla);
    if (motivo) problemas.push(`${prefijo(ruta)}${motivo}`);
  };

  recorrer(errInfo?.details, []);
  return [...new Set(problemas)];
}

function motivoDe(r) {
  const s = r.specifiedAs ?? {};
  switch (r.operatorName) {
    case 'minimum':
      return s.exclusiveMinimum ? `debe ser mayor a ${s.minimum}` : `debe ser al menos ${s.minimum}`;
    case 'maximum':
      return s.exclusiveMaximum ? `debe ser menor a ${s.maximum}` : `debe ser como máximo ${s.maximum}`;
    case 'maxLength':
      return `máximo ${s.maxLength} caracteres`;
    case 'minLength':
      return `mínimo ${s.minLength} caracteres`;
    case 'bsonType':
    case 'type':
      return 'tipo de dato incorrecto';
    case 'enum':
      return 'valor no permitido';
    case '$expr':
      return 'el stock máximo debe ser mayor o igual que el stock mínimo';
    default:
      return null;
  }
}
