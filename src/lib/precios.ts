/** Margen sobre el costo (%), calculado con el precio sin IVA. null si no hay costo. */
export function margen(precio: number, costo: number, iva: number): number | null {
  if (!costo) return null;
  const base = precio / (1 + iva / 100);
  return ((base - costo) / costo) * 100;
}

/** Precio con IVA para lograr un margen dado, redondeado hacia arriba a la centena. */
export function precioConMargen(costo: number, iva: number, margenPct: number): number {
  return Math.ceil((costo * (1 + iva / 100) * (1 + margenPct / 100)) / 100) * 100;
}
