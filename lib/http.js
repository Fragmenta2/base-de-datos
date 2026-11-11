import { NextResponse } from 'next/server';

export function handleError(err) {
  if (err.status === 400) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  // 121 = DocumentValidationFailure: el documento no cumple el $jsonSchema de la colección
  if (err.code === 121) {
    return NextResponse.json(
      { error: 'El documento no cumple las reglas de validación de la colección', detalle: err.errInfo },
      { status: 400 }
    );
  }
  if (err.code === 11000) {
    const campos = Object.entries(err.keyValue ?? {}).map(([k, v]) => `${k} = ${v}`).join(', ');
    return NextResponse.json({ error: `Ya existe un documento con ${campos || 'ese valor único'}` }, { status: 409 });
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
