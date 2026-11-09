import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { GeneradorEtiquetas, type ProductoEtiqueta } from "./generador";

export default async function PaginaEtiquetas({ searchParams }: PageProps<"/etiquetas">) {
  const { activa } = await exigirRol("admin", "bodega");
  const { compra } = await searchParams;
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase
    .from("productos")
    .select("id, codigo, nombre, precio_venta, stock")
    .eq("es_servicio", false)
    .eq("empresa_id", activa.id)
    .eq("activo", true)
    .order("nombre")
    .limit(2000);
  if (error) throw new Error(error.message);

  // Desde una compra: preselecciona sus productos con la cantidad comprada
  const preseleccion: Record<string, number> = {};
  let titulo: string | null = null;
  if (typeof compra === "string") {
    const { data: c } = await supabase
      .from("compras")
      .select("numero_factura, compra_items (producto_id, cantidad)")
      .eq("empresa_id", activa.id)
      .eq("id", compra)
      .maybeSingle();
    if (c) {
      titulo = c.numero_factura;
      for (const item of c.compra_items as { producto_id: string; cantidad: number }[]) {
        preseleccion[item.producto_id] = (preseleccion[item.producto_id] ?? 0) + Number(item.cantidad);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Etiquetas QR</h1>
        <p className="text-sm text-slate-500">
          {titulo
            ? `Productos de la factura ${titulo} preseleccionados con la cantidad comprada.`
            : "Elija los productos y cuántas etiquetas imprimir de cada uno. El QR lleva el código del producto."}
        </p>
      </div>
      <GeneradorEtiquetas productos={(data ?? []) as ProductoEtiqueta[]} preseleccion={preseleccion} />
    </div>
  );
}
