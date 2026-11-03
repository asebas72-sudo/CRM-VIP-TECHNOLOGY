const pesosCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** $ 1.234.567 */
export function pesos(valor: number | string | null | undefined): string {
  return pesosCOP.format(Number(valor ?? 0));
}

/** 31/10/2026 */
export function fecha(valor: string | Date): string {
  const d = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function cantidad(valor: number | string): string {
  return Number(valor).toLocaleString("es-CO", { maximumFractionDigits: 2 });
}
