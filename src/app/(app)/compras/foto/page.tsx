import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { catalogoEmpresa } from "./acciones";
import { RegistroFoto } from "./registro";

export default async function PaginaCompraFoto() {
  const { activa, todas } = await exigirRol("admin", "bodega");
  const empresas = todas
    .filter((e) => e.rol === "admin" || e.rol === "bodega")
    .map((e) => ({ id: e.id, nombre: e.nombre }));
  const catalogo = await catalogoEmpresa(activa.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/compras" className="text-sm text-blue-700 hover:underline">
          ← Compras
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Compra desde foto o manual</h1>
        <p className="text-sm text-slate-500">
          Para recibos de caja, facturas de papel o cuentas de cobro: tome una foto (o suba el PDF) y el sistema
          lee los datos. Revíselos antes de guardar. También puede escribir la compra a mano.
        </p>
      </div>
      <RegistroFoto empresas={empresas} empresaInicial={activa.id} catalogoInicial={catalogo} />
    </div>
  );
}
