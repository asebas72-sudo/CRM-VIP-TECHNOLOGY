import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { PuntoDeVenta } from "./pos";

export default async function PaginaVender() {
  const { activa } = await exigirRol("admin", "vendedor");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vender</h1>
          <p className="text-sm text-slate-500">
            {activa.nombre} · escanee el QR o escriba el nombre del producto
          </p>
        </div>
        <Link href="/ventas/historial" className="text-sm font-medium text-blue-700 hover:underline">
          Historial de ventas →
        </Link>
      </div>
      <PuntoDeVenta />
    </div>
  );
}
