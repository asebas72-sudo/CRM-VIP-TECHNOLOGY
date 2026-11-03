import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { Importador } from "./importador";

export default async function PaginaImportar() {
  const { activa } = await exigirRol("admin", "bodega");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/compras" className="text-sm text-blue-700 hover:underline">
          ← Compras
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Importar factura de compra</h1>
        <p className="text-sm text-slate-500">
          Cargue el XML de la factura electrónica del proveedor. Revise los productos y confirme para
          sumarlos al inventario de <strong>{activa.nombre}</strong>.
        </p>
      </div>
      <Importador />
    </div>
  );
}
