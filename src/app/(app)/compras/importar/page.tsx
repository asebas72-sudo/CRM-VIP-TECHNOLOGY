import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { Importador } from "./importador";

export default async function PaginaImportar() {
  const { activa, todas } = await exigirRol("admin", "bodega");
  const empresas = todas
    .filter((e) => e.rol === "admin" || e.rol === "bodega")
    .map((e) => ({ id: e.id, nombre: e.nombre, nit: e.nit }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/compras" className="text-sm text-blue-700 hover:underline">
          ← Compras
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Importar factura de compra</h1>
        <p className="text-sm text-slate-500">
          Elija la empresa, cargue el XML de la factura electrónica del proveedor, revise los productos y
          confirme para sumarlos al inventario.
        </p>
      </div>
      <Importador empresas={empresas} empresaInicial={activa.id} />
    </div>
  );
}
