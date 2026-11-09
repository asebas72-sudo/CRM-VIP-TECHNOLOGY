"use client";

import { useState, useTransition } from "react";
import { CodigoQR } from "@/components/codigo-qr";
import { ValorCopiable } from "@/components/copiar";
import { botonPrimario } from "@/components/dialogo";
import { guardarConfiguracion } from "./acciones";

export type ConfigPortafolio = {
  slug: string;
  activo: boolean;
  titulo: string | null;
  mensaje: string | null;
  whatsapp: string | null;
  correo: string | null;
  direccion: string | null;
  facebook: string | null;
  instagram: string | null;
  color: string;
  logo_path: string | null;
  mostrar_precios: boolean;
  agotados: "por_pedido" | "ocultar";
};

const campo = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal";
const etiqueta = "block text-sm font-medium text-slate-700";

export function FormularioConfiguracion({
  config,
  slugSugerido,
  origen,
}: {
  config: ConfigPortafolio | null;
  slugSugerido: string;
  origen: string;
}) {
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string }>();
  const [guardando, iniciar] = useTransition();
  const enlace = config ? `${origen}/catalogo/${config.slug}` : null;

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setMensaje(undefined);
    iniciar(async () => {
      const r = await guardarConfiguracion(datos);
      setMensaje(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Portafolio guardado" });
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <form onSubmit={enviar} className="grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-2">
        <label className={etiqueta}>
          Dirección del portafolio *
          <input name="slug" required defaultValue={config?.slug ?? slugSugerido} className={campo} />
        </label>
        <label className={etiqueta}>
          WhatsApp para cotizar
          <input name="whatsapp" inputMode="tel" defaultValue={config?.whatsapp ?? ""} className={campo} />
        </label>
        <label className={etiqueta}>
          Título principal
          <input name="titulo" defaultValue={config?.titulo ?? ""} className={campo} />
        </label>
        <label className={etiqueta}>
          Correo de contacto
          <input name="correo" type="email" defaultValue={config?.correo ?? ""} className={campo} />
        </label>
        <label className={`${etiqueta} sm:col-span-2`}>
          Mensaje de presentación
          <textarea name="mensaje" rows={2} defaultValue={config?.mensaje ?? ""} className={campo} />
        </label>
        <label className={`${etiqueta} sm:col-span-2`}>
          Dirección del local
          <input name="direccion" defaultValue={config?.direccion ?? ""} className={campo} />
        </label>
        <label className={etiqueta}>
          Enlace de Facebook
          <input name="facebook" defaultValue={config?.facebook ?? ""} className={campo} />
        </label>
        <label className={etiqueta}>
          Enlace de Instagram
          <input name="instagram" defaultValue={config?.instagram ?? ""} className={campo} />
        </label>
        <label className={etiqueta}>
          Logo
          <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" className={`${campo} file:mr-3 file:border-0 file:bg-transparent`} />
        </label>
        <label className={etiqueta}>
          Color principal
          <input name="color" type="color" defaultValue={config?.color ?? "#1d4ed8"} className="mt-1 block h-10 w-20 rounded-lg border border-slate-300 bg-white p-1" />
        </label>
        <label className={etiqueta}>
          Productos sin existencias
          <select name="agotados" defaultValue={config?.agotados ?? "por_pedido"} className={campo}>
            <option value="por_pedido">Mostrar como «Por pedido»</option>
            <option value="ocultar">Ocultarlos</option>
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input name="mostrar_precios" type="checkbox" defaultChecked={config?.mostrar_precios ?? true} className="size-4" />
            Mostrar precios
          </label>
          <label className="flex items-center gap-2">
            <input name="activo" type="checkbox" defaultChecked={config?.activo ?? true} className="size-4" />
            Portafolio visible al público
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {mensaje && <span className={`text-sm ${mensaje.ok ? "text-green-700" : "text-red-700"}`}>{mensaje.texto}</span>}
          <button disabled={guardando} className={botonPrimario}>
            {guardando ? "Guardando..." : "Guardar portafolio"}
          </button>
        </div>
      </form>

      <div className="flex flex-col items-center gap-3 self-start rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200">
        {enlace ? (
          <>
            <CodigoQR valor={enlace} tamano={150} />
            <div className="w-full">
              <ValorCopiable etiqueta="Enlace" valor={enlace} />
            </div>
            <a href={enlace} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:underline">
              Abrir portafolio
            </a>
          </>
        ) : (
          <p className="text-sm text-slate-500">Guarde el portafolio para obtener su enlace y su código QR.</p>
        )}
      </div>
    </div>
  );
}
