import { empresasConfigurables } from "../datos";
import { AjustesServicio } from "./editor";

export default async function ConfiguracionServicio() {
  const empresas = await empresasConfigurables();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Configuración</p>
        <h1 className="text-2xl font-bold text-slate-900">Servicio técnico</h1>
        <p className="text-sm text-slate-500">Valor de la revisión y días estimados de entrega de cada empresa.</p>
      </div>
      <AjustesServicio empresas={empresas} />
    </div>
  );
}
