import Link from "next/link";
import { notFound } from "next/navigation";
import { enlaceWhatsapp, ESTILO_ESTADO_ASESORIA, fechaHora, type EstadoAsesoria } from "@/lib/servicio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { empresasServicio, tecnicosEmpresa, urlsFirmadas } from "../../datos";
import { EditorAsesoria } from "./editor";

/** Fecha en hora de Colombia con el formato de <input type="datetime-local"> */
function paraInput(iso: string | null): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour") === "24" ? "00" : v("hour")}:${v("minute")}`;
}

export default async function DetalleAsesoria({ params }: PageProps<"/servicio/asesorias/[id]">) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const [{ data: a }, empresas, { data: yo }] = await Promise.all([
    supabase.from("asesorias").select("*").eq("id", id).maybeSingle(),
    empresasServicio(),
    supabase.auth.getClaims(),
  ]);
  const empresa = empresas.find((e) => e.id === a?.empresa_id);
  if (!a || !empresa) notFound();
  const tecnicos = await tecnicosEmpresa(empresa.id);
  const urls = await urlsFirmadas([a.imagen_path]);
  const imagen = a.imagen_path ? urls.get(a.imagen_path) : undefined;
  const estado = ESTILO_ESTADO_ASESORIA[a.estado as EstadoAsesoria];
  const wa = enlaceWhatsapp(a.celular);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/servicio/asesorias" className="text-sm text-violet-700 hover:underline">
          ← Asesorías
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Asesoría #{a.consecutivo}
          {empresas.length > 1 && <span className="ml-2 text-base font-semibold text-slate-500">{empresa.nombre}</span>}
        </h1>
        <span className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${estado.clase}`}>
          {estado.icono} {estado.texto}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="space-y-3 self-start rounded-2xl bg-white p-5 text-sm ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Solicitud</h2>
          <p>
            <strong>{a.cliente_nombre}</strong> · C.C. {a.cliente_documento}
          </p>
          <p>
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">
                📱 {a.celular}
              </a>
            ) : (
              a.celular
            )}
            {a.correo && <span className="block text-slate-600">{a.correo}</span>}
          </p>
          <p className="rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900">{a.solicitud}</p>
          {a.fallas && <p className="whitespace-pre-line">{a.fallas}</p>}
          {a.observaciones && <p className="whitespace-pre-line text-slate-600">{a.observaciones}</p>}
          <p className="text-xs text-slate-500">Solicitada el {fechaHora(a.fecha)}</p>
          {imagen && (
            <a href={imagen} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
              <img src={imagen} alt="Foto de referencia" className="max-h-56 w-full rounded-lg object-contain ring-1 ring-slate-200" />
            </a>
          )}
        </section>

        <EditorAsesoria
          asesoria={{
            id: a.id,
            consecutivo: a.consecutivo,
            cliente: a.cliente_nombre,
            celular: a.celular,
            solicitud: a.solicitud,
            fallas: a.fallas,
            estado: a.estado,
            tecnico_id: a.tecnico_id,
            fecha_visita: paraInput(a.fecha_visita),
            costo: a.costo,
            observacion_final: a.observacion_final,
          }}
          tecnicos={tecnicos}
          rol={empresa.rol}
          usuarioId={yo?.claims.sub ?? ""}
          empresa={empresa.nombre}
          plantillas={empresa.plantillas}
        />
      </div>
    </div>
  );
}
