import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioNuevoProducto } from "./formulario";

export default async function NuevoProducto() {
  const { activa } = await exigirRol("admin", "bodega");
  const supabase = await crearClienteServidor();
  const [categoriasRes, empresaRes] = await Promise.all([
    supabase.from("categorias").select("id, nombre").eq("empresa_id", activa.id).order("nombre"),
    supabase.from("empresas").select("margen_defecto").eq("id", activa.id).single(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/productos" className="text-sm text-blue-700 hover:underline">
          ← Productos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Nuevo producto en {activa.nombre}</h1>
        <p className="text-sm text-slate-500">
          Créelo a mano, sin factura de compra. La cantidad inicial queda en el kardex como «Inventario inicial».
        </p>
      </div>
      <FormularioNuevoProducto
        categorias={categoriasRes.data ?? []}
        margenDefecto={Number(empresaRes.data?.margen_defecto ?? 30)}
      />
    </div>
  );
}
