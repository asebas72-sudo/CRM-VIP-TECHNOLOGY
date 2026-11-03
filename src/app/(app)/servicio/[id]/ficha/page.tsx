import Link from "next/link";
import { notFound } from "next/navigation";
import { CodigoQR } from "@/components/codigo-qr";
import { fechaCorta, fechaHora } from "@/lib/servicio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { empresasServicio, urlsFirmadas } from "../../datos";
import { ImprimirAlAbrir } from "./imprimir";

/** Ficha de ingreso imprimible (media carta): se entrega o se envía al cliente. */
export default async function FichaIngreso({ params, searchParams }: PageProps<"/servicio/[id]/ficha">) {
  const { id } = await params;
  const { imprimir } = await searchParams;
  const supabase = await crearClienteServidor();
  const [{ data: o }, empresas] = await Promise.all([
    supabase.from("ordenes_servicio").select("*").eq("id", id).maybeSingle(),
    empresasServicio(),
  ]);
  const e = empresas.find((x) => x.id === o?.empresa_id);
  if (!o || !e) notFound();
  const urls = await urlsFirmadas([o.firma_path]);
  const firma = o.firma_path ? urls.get(o.firma_path) : undefined;

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: letter; margin: 12mm } }`}</style>
      <ImprimirAlAbrir activo={imprimir === "1"} />
      <div className="flex gap-3 print:hidden">
        <Link href={`/servicio/${o.id}`} className="text-sm text-violet-700 hover:underline">
          ← Volver a la orden
        </Link>
      </div>

      <article className="mx-auto max-w-[190mm] space-y-4 bg-white p-8 text-sm text-black ring-1 ring-slate-200 print:p-0 print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <p className="text-xl font-bold">{e.nombre}</p>
            <p>Servicio técnico especializado</p>
            {e.nit && <p>NIT {e.nit}</p>}
            <p>{[e.direccion, e.ciudad, e.telefono].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase">Ficha de ingreso · Orden #{o.consecutivo}</p>
            <p className="font-mono text-lg font-bold">{o.codigo}</p>
            <div className="mt-1 inline-block">
              <CodigoQR valor={o.codigo} tamano={72} />
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Campo titulo="Cliente" valor={o.cliente_nombre} />
          <Campo titulo="Cédula / NIT" valor={o.cliente_documento} />
          <Campo titulo="Celular" valor={o.celular} />
          <Campo titulo="Correo" valor={o.correo ?? "—"} />
          <Campo titulo="Fecha de ingreso" valor={fechaHora(o.fecha_ingreso)} />
          <Campo titulo="Entrega estimada" valor={o.fecha_entrega_estimada ? fechaCorta(`${o.fecha_entrega_estimada}T12:00:00`) : "—"} />
        </section>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-300 pt-3">
          <Campo titulo="Equipo" valor={o.equipo} />
          <Campo titulo="Tipo / marca" valor={`${o.tipo_equipo} · ${o.marca}`} />
          <Campo titulo="Accesorios entregados" valor={(o.accesorios as string[]).join(", ") || "Ninguno"} />
          <Campo titulo="Estado físico" valor={o.observaciones ?? "—"} />
          <div className="col-span-2">
            <Campo titulo="Fallas reportadas" valor={o.fallas ?? "—"} />
          </div>
        </section>

        <section className="space-y-1 border-t border-slate-300 pt-3 text-xs">
          <p className="font-bold">Condiciones del servicio</p>
          <p>• Toda revisión cuesta ${e.valorRevision.toLocaleString("es-CO")} siempre y cuando el cliente no desee reparar el equipo.</p>
          <p>• Para reclamar el equipo debe presentar el código de esta ficha (enviado a su correo o WhatsApp).</p>
          <p>
            • El equipo debe reclamarse en un tiempo inferior a 30 días. Pasado este tiempo se cobrará $1.000 por día por concepto de
            bodegaje y {e.nombre} no responde por él.
          </p>
        </section>

        <footer className="grid grid-cols-2 gap-8 pt-6">
          <div className="text-center">
            {firma ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
              <img src={firma} alt="Firma del cliente" className="mx-auto h-20" />
            ) : (
              <div className="h-20" />
            )}
            <p className="border-t border-black pt-1">Firma del cliente</p>
          </div>
          <div className="text-center">
            <div className="h-20" />
            <p className="border-t border-black pt-1">Recibido por {e.nombre}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-wide text-slate-600 uppercase">{titulo}</p>
      <p>{valor}</p>
    </div>
  );
}
