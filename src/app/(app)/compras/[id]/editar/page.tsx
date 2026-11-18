import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { EditorCompra, type LineaEditable } from "./editor";

type Item = {
  id: string;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  iva_porcentaje: number;
  productos: { codigo: string; nombre: string } | null;
  seriales: { id: string }[];
};

export default async function EditarCompra({ params }: PageProps<"/compras/[id]/editar">) {
  const { id } = await params;
  const { activa, perfil } = await exigirRol("admin");
  if (!perfil.acceso_total) redirect(`/compras/${id}`);
  const supabase = await crearClienteServidor();

  const [compraRes, proveedoresRes] = await Promise.all([
    supabase
      .from("compras")
      .select(
        "id, proveedor_id, numero_factura, fecha, compra_items (id, descripcion, cantidad, costo_unitario, iva_porcentaje, productos (codigo, nombre), seriales (id))",
      )
      .eq("empresa_id", activa.id)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("proveedores").select("id, nombre, nit").eq("empresa_id", activa.id).order("nombre"),
  ]);
  if (!compraRes.data) notFound();

  const c = compraRes.data as unknown as {
    proveedor_id: string;
    numero_factura: string;
    fecha: string;
    compra_items: Item[];
  };

  const lineas: LineaEditable[] = c.compra_items.map((i) => ({
    id: i.id,
    nombre: i.productos?.nombre ?? i.descripcion,
    codigo: i.productos?.codigo ?? "",
    cantidad: Number(i.cantidad),
    costo_unitario: Number(i.costo_unitario),
    iva_porcentaje: Number(i.iva_porcentaje),
    tieneSeriales: i.seriales.length > 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/compras/${id}`} className="text-sm text-blue-700 hover:underline">
          ← Volver a la compra
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Editar factura {c.numero_factura}</h1>
        <p className="text-sm text-slate-500">
          Solo superadmin · cargada a <strong className="text-slate-700">{activa.nombre}</strong>
        </p>
      </div>
      <EditorCompra
        compraId={id}
        proveedores={proveedoresRes.data ?? []}
        cabecera={{ proveedor_id: c.proveedor_id, numero_factura: c.numero_factura, fecha: c.fecha }}
        lineas={lineas}
      />
    </div>
  );
}
