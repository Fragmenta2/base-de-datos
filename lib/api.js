// Llamadas del navegador a la API. Los errores siempre llegan como Error con un mensaje legible.
async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

const url = (col, id) =>
  `/api/colecciones/${encodeURIComponent(col)}${id === undefined ? '' : `/${encodeURIComponent(id)}`}`;

export const createDoc = (col, data) => request(url(col), { method: 'POST', body: JSON.stringify(data) });
export const updateDoc = (col, id, data) =>
  request(url(col, id), { method: 'PUT', body: JSON.stringify(data) });
export const deleteDoc = (col, id) => request(url(col, id), { method: 'DELETE' });

export const registrarVenta = (venta) => request('/api/ventas', { method: 'POST', body: JSON.stringify(venta) });
export const cambiarEstatus = (id, estatus) =>
  request(`/api/empleados/${id}`, { method: 'PATCH', body: JSON.stringify({ estatus }) });
