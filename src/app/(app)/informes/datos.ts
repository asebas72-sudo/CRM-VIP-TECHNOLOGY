import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

const ZONA = "America/Bogota";

/** AAAA-MM-DD en hora de Colombia */
export function diaColombia(fecha: Date | string): string {
  return new Date(fecha).toLocaleDateString("en-CA", { timeZone: ZONA });
}

function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000) + 1;
}

export type Periodo = { clave: string; desde: string; hasta: string; texto: string };

export const PRESETS: { clave: string; texto: string }[] = [
  { clave: "hoy", texto: "Hoy" },
  { clave: "7d", texto: "Últimos 7 días" },
  { clave: "30d", texto: "Últimos 30 días" },
  { clave: "mes", texto: "Este mes" },
  { clave: "mes-anterior", texto: "Mes anterior" },
  { clave: "90d", texto: "Últimos 90 días" },
  { clave: "anio", texto: "Este año" },
];

export function resolverPeriodo(clave: string | undefined, desde?: string, hasta?: string): Periodo {
  const hoy = diaColombia(new Date());
  const valido = (d?: string) => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (clave === "rango" && valido(desde) && valido(hasta) && desde! <= hasta!) {
    return { clave, desde: desde!, hasta: hasta!, texto: `${desde} a ${hasta}` };
  }
  const texto = (c: string) => PRESETS.find((p) => p.clave === c)!.texto;
  switch (clave) {
    case "hoy":
      return { clave, desde: hoy, hasta: hoy, texto: texto(clave) };
    case "7d":
      return { clave, desde: sumarDias(hoy, -6), hasta: hoy, texto: texto(clave) };
    case "mes":
      return { clave, desde: `${hoy.slice(0, 7)}-01`, hasta: hoy, texto: texto(clave) };
    case "mes-anterior": {
      const finAnterior = sumarDias(`${hoy.slice(0, 7)}-01`, -1);
      return { clave, desde: `${finAnterior.slice(0, 7)}-01`, hasta: finAnterior, texto: texto(clave) };
    }
    case "90d":
      return { clave, desde: sumarDias(hoy, -89), hasta: hoy, texto: texto(clave) };
    case "anio":
      return { clave, desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, texto: texto(clave) };
    default:
      return { clave: "30d", desde: sumarDias(hoy, -29), hasta: hoy, texto: texto("30d") };
  }
}

const inicio = (dia: string) => `${dia}T00:00:00-05:00`;
const fin = (dia: string) => `${dia}T23:59:59.999-05:00`;

type Venta = {
  id: string;
  empresa_id: string;
  fecha: string;
  tipo: string;
  forma_pago: string;
  subtotal: number;
  total: number;
  vendedor_id: string | null;
  venta_items: { producto_id: string; descripcion: string; cantidad: number; total: number; iva_porcentaje: number; costo_unitario: number }[];
};

export type Fila = { etiqueta: string; valor: number; detalle?: string; enlace?: string };

export type Informe = {
  periodo: Periodo;
  dias: { dia: string; ventas: number; utilidad: number; numero: number }[];
  kpi: {
    ventas: number;
    ventasAnterior: number;
    utilidad: number;
    margen: number | null;
    numeroVentas: number;
    ticket: number;
    unidades: number;
    recaudo: number;
    compras: number;
    numeroCompras: number;
    inventarioCosto: number;
    inventarioVenta: number;
    unidadesStock: number;
    cartera: number;
    carteraVencida: number;
    agotados: number;
    bajoMinimo: number;
  };
  porTipo: Fila[];
  porFormaPago: Fila[];
  topProductos: Fila[];
  porEmpresa: Fila[];
  porVendedor: Fila[];
  porCategoria: Fila[];
  porProveedor: Fila[];
  sinMovimiento: Fila[];
  reponer: Fila[];
  margenBajo: Fila[];
  carteraVencida: Fila[];
};

const TIPO: Record<string, string> = { contado: "Contado", credito: "Crédito", separado: "Separado" };
const FORMA: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mixto: "Mixto",
};

function agrupar<T>(lista: T[], clave: (x: T) => string, valor: (x: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of lista) m.set(clave(x), (m.get(clave(x)) ?? 0) + valor(x));
  return m;
}

const ordenar = (filas: Fila[]) => filas.sort((a, b) => b.valor - a.valor);

export async function construirInforme(
  empresas: { id: string; nombre: string }[],
  periodo: Periodo,
): Promise<Informe> {
  const supabase = await crearClienteServidor();
  const ids = empresas.map((e) => e.id);
  const nombreEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));
  const hoy = diaColombia(new Date());
  const largo = diasEntre(periodo.desde, periodo.hasta);
  const anteriorHasta = sumarDias(periodo.desde, -1);
  const anteriorDesde = sumarDias(anteriorHasta, -(largo - 1));

  const [ventasRes, anteriorRes, pagosRes, comprasRes, productosRes, carteraRes] = await Promise.all([
    supabase
      .from("ventas")
      .select(
        "id, empresa_id, fecha, tipo, forma_pago, subtotal, total, vendedor_id," +
          " venta_items (producto_id, descripcion, cantidad, total, iva_porcentaje, costo_unitario)",
      )
      .in("empresa_id", ids)
      .eq("estado", "pagada")
      .gte("fecha", inicio(periodo.desde))
      .lte("fecha", fin(periodo.hasta))
      .limit(10000),
    supabase
      .from("ventas")
      .select("total")
      .in("empresa_id", ids)
      .eq("estado", "pagada")
      .gte("fecha", inicio(anteriorDesde))
      .lte("fecha", fin(anteriorHasta))
      .limit(10000),
    supabase
      .from("pagos")
      .select("valor, ventas!inner (estado)")
      .in("empresa_id", ids)
      .eq("ventas.estado", "pagada")
      .gte("fecha", inicio(periodo.desde))
      .lte("fecha", fin(periodo.hasta))
      .limit(20000),
    supabase
      .from("compras")
      .select("total, proveedores (nombre)")
      .in("empresa_id", ids)
      .gte("fecha", periodo.desde)
      .lte("fecha", periodo.hasta)
      .limit(5000),
    supabase
      .from("productos")
      .select("id, empresa_id, codigo, nombre, stock, stock_minimo, costo_promedio, precio_venta, iva_porcentaje, categorias (nombre)")
      .in("empresa_id", ids)
      .eq("activo", true)
      .limit(20000),
    supabase
      .from("ventas")
      .select("id, consecutivo, saldo, fecha_vencimiento, clientes (nombre)")
      .in("empresa_id", ids)
      .eq("estado", "pagada")
      .gt("saldo", 0)
      .limit(5000),
  ]);

  for (const r of [ventasRes, anteriorRes, pagosRes, comprasRes, productosRes, carteraRes]) {
    if (r.error) throw new Error(`No se pudo construir el informe: ${r.error.message}`);
  }

  const ventas = (ventasRes.data ?? []) as unknown as Venta[];
  const items = ventas.flatMap((v) => v.venta_items.map((i) => ({ ...i, empresa_id: v.empresa_id })));
  const costoDe = (v: Venta) => v.venta_items.reduce((s, i) => s + Number(i.cantidad) * Number(i.costo_unitario), 0);

  // --- Indicadores de ventas ---
  const totalVentas = ventas.reduce((s, v) => s + Number(v.total), 0);
  const totalSinIva = ventas.reduce((s, v) => s + Number(v.subtotal), 0);
  const utilidad = totalSinIva - ventas.reduce((s, v) => s + costoDe(v), 0);

  // --- Serie diaria (todos los días del periodo, también los de $0) ---
  const porDia = new Map<string, { ventas: number; utilidad: number; numero: number }>();
  for (let d = periodo.desde; d <= periodo.hasta; d = sumarDias(d, 1)) porDia.set(d, { ventas: 0, utilidad: 0, numero: 0 });
  for (const v of ventas) {
    const dia = porDia.get(diaColombia(v.fecha));
    if (!dia) continue;
    dia.ventas += Number(v.total);
    dia.utilidad += Number(v.subtotal) - costoDe(v);
    dia.numero += 1;
  }

  // --- Productos ---
  type Producto = {
    id: string;
    empresa_id: string;
    codigo: string;
    nombre: string;
    stock: number;
    stock_minimo: number;
    costo_promedio: number;
    precio_venta: number;
    iva_porcentaje: number;
    categorias: { nombre: string } | null;
  };
  const productos = (productosRes.data ?? []) as unknown as Producto[];
  const vendidoPorProducto = agrupar(items, (i) => i.producto_id, (i) => Number(i.cantidad));
  const valorPorProducto = agrupar(items, (i) => i.producto_id, (i) => Number(i.total));
  const sufijoEmpresa = (empresaId: string) => (empresas.length > 1 ? ` · ${nombreEmpresa.get(empresaId)}` : "");

  const productoPorId = new Map(productos.map((p) => [p.id, p]));
  const topProductos = ordenar(
    [...valorPorProducto].map(([id, valor]) => {
      const p = productoPorId.get(id);
      const item = items.find((i) => i.producto_id === id);
      return {
        etiqueta: p?.nombre ?? item?.descripcion ?? "Producto",
        valor,
        detalle: `${vendidoPorProducto.get(id) ?? 0} und.${p ? ` · stock ${p.stock}` : ""}`,
        enlace: p ? `/productos/${p.id}` : undefined,
      };
    }),
  ).slice(0, 10);

  const conStock = productos.filter((p) => Number(p.stock) > 0);
  const inventarioCosto = conStock.reduce((s, p) => s + Number(p.stock) * Number(p.costo_promedio), 0);
  const inventarioVenta = conStock.reduce((s, p) => s + Number(p.stock) * Number(p.precio_venta), 0);

  const porCategoria = ordenar(
    [...agrupar(conStock, (p) => p.categorias?.nombre ?? "Sin categoría", (p) => Number(p.stock) * Number(p.costo_promedio))].map(
      ([etiqueta, valor]) => ({ etiqueta, valor }),
    ),
  );

  // Capital quieto: stock al costo de productos que no se vendieron en el periodo
  const sinMovimiento = ordenar(
    conStock
      .filter((p) => !vendidoPorProducto.has(p.id))
      .map((p) => ({
        etiqueta: p.nombre + sufijoEmpresa(p.empresa_id),
        valor: Number(p.stock) * Number(p.costo_promedio),
        detalle: `${p.stock} und. sin ventas en el periodo`,
        enlace: `/productos/${p.id}`,
      })),
  ).slice(0, 10);

  // Qué reponer: lo que se vende y está agotado o bajo el mínimo
  const reponer = ordenar(
    productos
      .filter((p) => Number(p.stock) <= 0 || (Number(p.stock_minimo) > 0 && Number(p.stock) <= Number(p.stock_minimo)))
      .map((p) => ({
        etiqueta: p.nombre + sufijoEmpresa(p.empresa_id),
        valor: vendidoPorProducto.get(p.id) ?? 0,
        detalle: `stock ${p.stock}${Number(p.stock_minimo) > 0 ? ` · mín. ${p.stock_minimo}` : ""} · vendidas en el periodo`,
        enlace: `/productos/${p.id}`,
      })),
  ).slice(0, 10);

  const margenBajo = productos
    .filter((p) => Number(p.costo_promedio) > 0)
    .map((p) => {
      const base = Number(p.precio_venta) / (1 + Number(p.iva_porcentaje) / 100);
      return { p, m: ((base - Number(p.costo_promedio)) / Number(p.costo_promedio)) * 100 };
    })
    .filter(({ m }) => m < 10)
    .sort((a, b) => a.m - b.m)
    .slice(0, 10)
    .map(({ p, m }) => ({
      etiqueta: p.nombre + sufijoEmpresa(p.empresa_id),
      valor: m,
      detalle: Number(p.precio_venta) <= 0 ? "sin precio de venta" : "margen sobre el costo",
      enlace: `/productos/${p.id}`,
    }));

  // --- Cartera ---
  type Cartera = { id: string; consecutivo: number; saldo: number; fecha_vencimiento: string | null; clientes: { nombre: string } | null };
  const cartera = (carteraRes.data ?? []) as unknown as Cartera[];
  const vencidas = cartera.filter((c) => c.fecha_vencimiento && c.fecha_vencimiento < hoy);
  const carteraVencida = ordenar(
    [...agrupar(vencidas, (c) => c.clientes?.nombre ?? "Sin cliente", (c) => Number(c.saldo))].map(([etiqueta, valor]) => ({
      etiqueta,
      valor,
      enlace: "/cartera",
    })),
  ).slice(0, 10);

  // --- Compras ---
  type Compra = { total: number; proveedores: { nombre: string } | null };
  const compras = (comprasRes.data ?? []) as unknown as Compra[];
  const porProveedor = ordenar(
    [...agrupar(compras, (c) => c.proveedores?.nombre ?? "Sin proveedor", (c) => Number(c.total))].map(([etiqueta, valor]) => ({
      etiqueta,
      valor,
    })),
  ).slice(0, 10);

  // --- Vendedores ---
  const idsVendedores = [...new Set(ventas.map((v) => v.vendedor_id).filter(Boolean))] as string[];
  const { data: perfiles } = idsVendedores.length
    ? await supabase.from("perfiles").select("usuario_id, nombre, correo").in("usuario_id", idsVendedores)
    : { data: [] };
  const nombreVendedor = new Map((perfiles ?? []).map((p) => [p.usuario_id, p.nombre ?? p.correo]));

  const filas = (m: Map<string, number>, nombre: (k: string) => string) =>
    ordenar([...m].map(([k, valor]) => ({ etiqueta: nombre(k), valor })));

  return {
    periodo,
    dias: [...porDia].map(([dia, d]) => ({ dia, ...d })),
    kpi: {
      ventas: totalVentas,
      ventasAnterior: (anteriorRes.data ?? []).reduce((s, v) => s + Number(v.total), 0),
      utilidad,
      margen: totalSinIva > 0 ? (utilidad / totalSinIva) * 100 : null,
      numeroVentas: ventas.length,
      ticket: ventas.length ? totalVentas / ventas.length : 0,
      unidades: items.reduce((s, i) => s + Number(i.cantidad), 0),
      recaudo: (pagosRes.data ?? []).reduce((s, p) => s + Number(p.valor), 0),
      compras: compras.reduce((s, c) => s + Number(c.total), 0),
      numeroCompras: compras.length,
      inventarioCosto,
      inventarioVenta,
      unidadesStock: conStock.reduce((s, p) => s + Number(p.stock), 0),
      cartera: cartera.reduce((s, c) => s + Number(c.saldo), 0),
      carteraVencida: vencidas.reduce((s, c) => s + Number(c.saldo), 0),
      agotados: productos.filter((p) => Number(p.stock) <= 0).length,
      bajoMinimo: productos.filter((p) => Number(p.stock) > 0 && Number(p.stock_minimo) > 0 && Number(p.stock) <= Number(p.stock_minimo)).length,
    },
    porTipo: filas(agrupar(ventas, (v) => v.tipo, (v) => Number(v.total)), (k) => TIPO[k] ?? k),
    porFormaPago: filas(
      agrupar(ventas.filter((v) => v.tipo === "contado"), (v) => v.forma_pago, (v) => Number(v.total)),
      (k) => FORMA[k] ?? k,
    ),
    topProductos,
    porEmpresa: filas(agrupar(ventas, (v) => v.empresa_id, (v) => Number(v.total)), (k) => nombreEmpresa.get(k) ?? k),
    porVendedor: filas(agrupar(ventas, (v) => v.vendedor_id ?? "", (v) => Number(v.total)), (k) => nombreVendedor.get(k) ?? "Sin vendedor"),
    porCategoria,
    porProveedor,
    sinMovimiento,
    reponer,
    margenBajo,
    carteraVencida,
  };
}
