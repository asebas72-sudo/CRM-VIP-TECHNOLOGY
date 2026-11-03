import { MensajesServicio } from "../editor";
import { empresasConfigurables } from "../../datos";

export default async function ConfiguracionMensajes() {
  const empresas = await empresasConfigurables();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Configuración</p>
        <h1 className="text-2xl font-bold text-slate-900">Mensajes de WhatsApp</h1>
        <p className="text-sm text-slate-500">
          Abra cada grupo y cada mensaje para editarlo. La vista previa muestra cómo le llega al cliente o al técnico.
        </p>
      </div>
      <MensajesServicio empresas={empresas} />
    </div>
  );
}
