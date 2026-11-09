import Link from "next/link";
import { botonPrimario } from "@/components/dialogo";
import { exigirRol } from "@/lib/empresa";
import { cargarDatosRedes } from "./datos";
import { GeneradorRedes } from "./generador";

/** Imágenes y textos listos para programar en Meta Business Suite. Solo administradores. */
export default async function PaginaRedes() {
  const { activa } = await exigirRol("admin");
  const datos = await cargarDatosRedes(activa);

  const volver = (
    <Link href="/portafolio" className="text-sm text-blue-700 hover:underline">
      ← Portafolio
    </Link>
  );

  if (!datos) {
    return (
      <div className="space-y-3">
        {volver}
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          Primero llene y guarde los datos en Portafolio para poder crear las imágenes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {volver}
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Imágenes para Facebook e Instagram</h1>
          <p className="text-sm text-slate-500">
            Elija un producto publicado, descargue sus imágenes y prográmelas en Meta Business Suite.
          </p>
        </div>
        <Link href="/portafolio/redes/ia" className={botonPrimario}>
          Mejorar foto con IA
        </Link>
      </div>
      <GeneradorRedes {...datos} />
    </div>
  );
}
