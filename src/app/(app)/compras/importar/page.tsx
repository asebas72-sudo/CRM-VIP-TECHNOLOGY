import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Importador } from "./importador";

export default async function PaginaImportar({ searchParams }: PageProps<"/compras/importar">) {
  const { activa, todas } = await exigirRol("admin", "bodega");
  const empresas = todas
    .filter((e) => e.rol === "admin" || e.rol === "bodega")
    .map((e) => ({ id: e.id, nombre: e.nombre, nit: e.nit }));

  // Factura que llegó por correo (Procesar facturas de compra)
  const { correo } = await searchParams;
  let desdeCorreo: { id: string; descripcion: string } | null = null;
  let empresaInicial = activa.id;
  if (typeof correo === "string") {
    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .from("facturas_correo")
      .select("id, numero, proveedor_nombre, archivo, empresa_id")
      .eq("id", correo)
      .maybeSingle();
    if (data) {
      desdeCorreo = {
        id: data.id,
        descripcion: `${data.proveedor_nombre ?? "Proveedor"} · factura ${data.numero ?? ""} (${data.archivo ?? "correo"})`,
      };
      if (data.empresa_id && empresas.some((e) => e.id === data.empresa_id)) empresaInicial = data.empresa_id;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={desdeCorreo ? "/facturas-compra" : "/compras"} className="text-sm text-blue-700 hover:underline">
          ← {desdeCorreo ? "Procesar facturas de compra" : "Compras"}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Importar factura de compra</h1>
        <p className="text-sm text-slate-500">
          {desdeCorreo
            ? "Factura recibida por correo: revise la empresa y los productos y confirme para sumarlos al inventario."
            : "Elija la empresa, cargue el XML de la factura electrónica del proveedor, revise los productos y confirme para sumarlos al inventario."}
        </p>
      </div>
      <Importador empresas={empresas} empresaInicial={empresaInicial} desdeCorreo={desdeCorreo} />
    </div>
  );
}
