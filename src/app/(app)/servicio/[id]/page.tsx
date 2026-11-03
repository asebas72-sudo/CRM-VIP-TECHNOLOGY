import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirRol } from "@/lib/empresa";
import { enlaceWhatsapp, ESTILO_ESTADO_ORDEN, fechaCorta, fechaHora, type EstadoOrden } from "@/lib/servicio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { tecnicosEmpresa, urlsFirmadas } from "../datos";
import { FichaTecnica, type OrdenEditable } from "./ficha-tecnica";

export default async function DetalleOrden({ params }: PageProps<"/servicio/[id]">) {
  const { id } = await params;
  const { activa } = await exigirRol("admin", "vendedor", "tecnico");
  const supabase = await crearClienteServidor();

  const [{ data: o }, tecnicos, { data: yo }] = await Promise.all([
    supabase.from("ordenes_servicio").select("*").eq("empresa_id", activa.id).eq("id", id).maybeSingle(),
    tecnicosEmpresa(activa.id),
    supabase.auth.getClaims(),
  ]);
  if (!o) notFound();

  const urls = await urlsFirmadas([o.foto_ingreso_path, o.firma_path, ...(o.fotos as string[])]);
  const estado = ESTILO_ESTADO_ORDEN[o.estado as EstadoOrden];
  const wa = enlaceWhatsapp(o.celular);

  const editable: OrdenEditable = {
    id: o.id,
    codigo: o.codigo,
    cliente: o.cliente_nombre,
    celular: o.celular,
    correo: o.correo,
    equipo: o.equipo,
    estado: o.estado,
    tecnico_id: o.tecnico_id,
    costo: o.costo,
    fecha_reparacion: o.fecha_reparacion,
    comentario1: o.comentario1,
    comentario2: o.comentario2,
    observacion_final: o.observacion_final,
    fotos: (o.fotos as string[]).map((ruta) => ({ ruta, url: urls.get(ruta) ?? "" })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/servicio" className="text-sm text-violet-700 hover:underline">
          ← Órdenes de servicio
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Orden #{o.consecutivo}</p>
            <h1 className="font-mono text-2xl font-bold text-violet-800">{o.codigo}</h1>
            <span className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${estado.clase}`}>
              {estado.icono} {estado.texto}
            </span>
          </div>
          <Link
            href={`/servicio/${o.id}/ficha?imprimir=1`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            🖨 Imprimir ficha de ingreso
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        {/* Datos del ingreso (no editables) */}
        <section className="space-y-4 self-start rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Datos del ingreso</h2>
          <Dato titulo="Cliente" valor={`${o.cliente_nombre} · C.C. ${o.cliente_documento}`} />
          <Dato
            titulo="Contacto"
            valor={
              <>
                {wa ? (
                  <a href={wa} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">
                    📱 {o.celular}
                  </a>
                ) : (
                  o.celular
                )}
                {o.correo && <span className="block text-slate-600">{o.correo}</span>}
              </>
            }
          />
          <Dato titulo="Equipo" valor={`${o.equipo} · ${o.tipo_equipo} · ${o.marca}`} />
          <Dato titulo="Accesorios" valor={(o.accesorios as string[]).join(", ") || "Ninguno"} />
          <Dato titulo="Fallas reportadas" valor={o.fallas ?? "—"} />
          <Dato titulo="Observaciones" valor={o.observaciones ?? "—"} />
          <Dato
            titulo="Fechas"
            valor={`Ingreso ${fechaHora(o.fecha_ingreso)}${o.fecha_entrega_estimada ? ` · entrega estimada ${fechaCorta(`${o.fecha_entrega_estimada}T12:00:00`)}` : ""}${o.entregado_en ? ` · entregado ${fechaHora(o.entregado_en)}` : ""}`}
          />
          {o.foto_ingreso_path && urls.get(o.foto_ingreso_path) && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Foto de recepción</p>
              <a href={urls.get(o.foto_ingreso_path)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
                <img src={urls.get(o.foto_ingreso_path)} alt="Equipo al ingresar" className="mt-1 max-h-48 w-full rounded-lg object-contain ring-1 ring-slate-200" />
              </a>
            </div>
          )}
          {o.firma_path && urls.get(o.firma_path) && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Firma del cliente</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
              <img src={urls.get(o.firma_path)} alt="Firma del cliente" className="mt-1 h-24 rounded-lg bg-white ring-1 ring-slate-200" />
            </div>
          )}
        </section>

        <FichaTecnica orden={editable} tecnicos={tecnicos} rol={activa.rol} usuarioId={yo?.claims.sub ?? ""} empresa={activa.nombre} />
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{titulo}</p>
      <div className="text-sm text-slate-900">{valor}</div>
    </div>
  );
}
