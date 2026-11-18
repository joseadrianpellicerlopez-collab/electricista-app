import { validarPresupuesto } from './presupuestos';

export function validarFactura(draft) {
  if (!String(draft.numero || '').trim()) return 'Escribe el número de factura.';
  if (draft.numero.length > 28) return 'El número de factura debe tener como máximo 28 caracteres.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.fecha || '') || Number.isNaN(Date.parse(draft.fecha))) return 'Selecciona la fecha de factura.';
  const fallo = validarPresupuesto(draft);
  if (fallo) return fallo;
  if (draft.contacto && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contacto)) return 'Revisa el correo electrónico del cliente.';
  if (!draft.nif.trim() || !draft.direccion.trim()) return 'Completa el NIF/CIF y la dirección del cliente para la factura.';
  if (!draft.emisorFactura?.nombre?.trim() || !draft.emisorFactura?.nif?.trim() || !draft.emisorFactura?.direccion?.trim()) return 'Completa el nombre fiscal, NIF y dirección del emisor.';
  return '';
}

export function prepararFactura(draft, datos) {
  return {
    ...draft, numero: datos.numero.trim(), fecha: datos.fecha,
    cliente: datos.cliente.trim(), contacto: (datos.correo || '').trim(), telefonoCliente: (datos.telefono || '').trim(),
    nif: datos.nif.trim(), direccion: datos.direccion.trim(), direccion2: (datos.direccion2 || '').trim(),
    emisorFactura: Object.fromEntries(Object.entries(datos.emisor).map(([key, value]) => [key, value.trim()])),
  };
}
