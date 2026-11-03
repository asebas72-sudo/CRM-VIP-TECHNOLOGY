import Link from "next/link";
import { redirect } from "next/navigation";
import { empresasServicio } from "../../datos";
import { FormularioAsesoria } from "./formulario";

export default async function NuevaAsesoria() {
  const empresas = await empresasServicio();
  if (empresas.length === 0) redirect("/");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/servicio/asesorias" className="text-sm text-violet-700 hover:underline">
          ← Asesorías
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nueva asesoría</h1>
        <p className="text-sm text-slate-500">
          Registre la solicitud del cliente. La fecha de visita y el técnico se asignan después.
        </p>
      </div>
      <FormularioAsesoria
        empresas={empresas.map((e) => ({ id: e.id, nombre: e.nombre, plantilla: e.plantillas.ASESORIA_PENDIENTE }))}
      />
    </div>
  );
}
