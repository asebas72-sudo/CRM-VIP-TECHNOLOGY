import { redirect } from "next/navigation";
import { empresasServicio } from "../datos";
import { EditorConfiguracion } from "./editor";

export default async function ConfiguracionServicio() {
  const empresas = (await empresasServicio()).filter((e) => e.rol === "admin");
  if (empresas.length === 0) redirect("/servicio");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración de reparaciones</h1>
        <p className="text-sm text-slate-500">
          Valores del servicio y textos de los mensajes de WhatsApp que se envían a clientes y técnicos.
        </p>
      </div>
      <EditorConfiguracion
        empresas={empresas.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          valorRevision: e.valorRevision,
          diasEntrega: e.diasEntrega,
          plantillas: e.plantillas,
        }))}
      />
    </div>
  );
}
