import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { mejorarFoto, sugerirTextosAnuncio } from "../acciones";
import { cargarDatosRedes } from "../datos";
import { MejorarConIA } from "./mejorar";

/** Mejora con IA la foto de un trabajo y arma la pieza para redes. Solo administradores. */
export default async function PaginaMejorarConIA() {
  const { activa } = await exigirRol("admin");
  const datos = await cargarDatosRedes(activa);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portafolio/redes" className="text-sm text-blue-700 hover:underline">
          ← Imágenes para redes
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Mejorar foto con IA</h1>
        <p className="text-sm text-slate-500">
          Suba la foto de un trabajo, elija qué mejorar y revise el resultado antes de publicarlo.
        </p>
      </div>
      {datos ? (
        <MejorarConIA {...datos} generar={mejorarFoto} sugerir={sugerirTextosAnuncio} />
      ) : (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          Primero llene y guarde los datos en Portafolio.
        </p>
      )}
    </div>
  );
}
