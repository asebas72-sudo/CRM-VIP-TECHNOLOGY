import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FilaFactura } from "./fila";

type Factura = {
  id: string;
  cufe: string;
  numero: string | null;
  fecha_documento: string | null;
  proveedor_nombre: string | null;
  proveedor_nit: string | null;
  monto: number | null;
  compra_id: string | null;
};

/**
 * Compras > Consultar compras: facturas de proveedores que llegaron al correo
 * asignadas a la empresa activa, para cargarlas al inventario.
 */
export default async function ConsultarCompras({ searchParams }: PageProps<"/compras/consultar">) {
  const { activa } = await exigirRol("admin", "bodega");
  const { ver } = await searchParams;
  const verTodas = ver === "todas";
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase
    .from("facturas_correo")
    .select("id, cufe, numero, fecha_documento, proveedor_nombre, proveedor_nit, monto, compra_id")
    .eq("empresa_id", activa.id)
    .order("fecha_documento", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        No se pudieron consultar las facturas del correo ({error.message}). Verifique que estén ejecutadas las migraciones 0012 y
        0013.
      </p>
    );
  }

  // También cuentan como cargadas las que se subieron a mano (mismo CUFE en Compras)
  const facturas = (data ?? []) as Factura[];
  const cufes = facturas.filter((f) => !f.compra_id).map((f) => f.cufe);
  const enCompras = new Map<string, string>();
  for (let i = 0; i < cufes.length; i += 200) {
    const { data: c } = await supabase
      .from("compras")
      .select("id, cufe")
      .eq("empresa_id", activa.id)
      .in("cufe", cufes.slice(i, i + 200));
    for (const x of c ?? []) if (x.cufe) enCompras.set(x.cufe, x.id);
  }
  for (const f of facturas) if (!f.compra_id && enCompras.has(f.cufe)) f.compra_id = enCompras.get(f.cufe)!;

  const pendientes = facturas.filter((f) => !f.compra_id);
  const lista = verTodas ? facturas : pendientes;
  const totalPendiente = pendientes.reduce((s, f) => s + Number(f.monto ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/compras" className="text-sm text-blue-700 hover:underline">
            ← Compras
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Consultar compras</h1>
          <p className="text-sm text-slate-500">
            Facturas de proveedores que llegaron al correo para <strong>{activa.nombre}</strong>. Haga clic en una para ver lo
            comprado antes de cargarla al inventario.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-white p-1 text-sm ring-1 ring-slate-200">
          <Link
            href="/compras/consultar"
            className={`rounded-md px-3 py-1.5 font-medium ${!verTodas ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Pendientes ({pendientes.length})
          </Link>
          <Link
            href="/compras/consultar?ver=todas"
            className={`rounded-md px-3 py-1.5 font-medium ${verTodas ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Todas ({facturas.length})
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tarjeta titulo="Pendientes de cargar" valor={String(pendientes.length)} />
        <Tarjeta titulo="Valor pendiente" valor={pesos(totalPendiente)} />
        <Tarjeta titulo="Ya cargadas al inventario" valor={String(facturas.length - pendientes.length)} />
      </div>

      {lista.length === 0 ? (
        <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">
          {verTodas
            ? "No han llegado facturas al correo para esta empresa."
            : "No hay facturas pendientes: todas las del correo ya están en Compras."}
        </p>
      ) : (
        <div className="space-y-2">
          {lista.map((f) => (
            <FilaFactura key={f.id} f={f} empresa={{ nombre: activa.nombre, nit: activa.nit }} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{valor}</p>
    </div>
  );
}
