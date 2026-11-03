import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { FormularioAsesoria } from "./formulario";

export default async function NuevaAsesoria() {
  const { activa } = await exigirRol("admin", "vendedor", "tecnico");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/servicio/asesorias" className="text-sm text-violet-700 hover:underline">
          ← Asesorías
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nueva asesoría</h1>
        <p className="text-sm text-slate-500">
          Registre la solicitud del cliente en <strong>{activa.nombre}</strong>. La fecha de visita y el técnico se asignan después.
        </p>
      </div>
      <FormularioAsesoria empresa={activa.nombre} />
    </div>
  );
}
