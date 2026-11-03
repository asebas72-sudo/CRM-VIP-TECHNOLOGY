import Link from "next/link";
import { notFound } from "next/navigation";
import { sesionActual } from "@/lib/empresa";
import { cantidad, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BotonAbonar, BotonEntregar } from "../abono";
import { AccionesVenta } from "./acciones-venta";

const TIPO: Record<string, string> = { contado: "Contado", credito: "Crédito", separado: "Separado" };

const FORMA: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mixto: "Mixto",
};

type Venta = {
  id: string;
  consecutivo: number;
  fecha: string;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  forma_pago: string;
  recibido: number | null;
  cambio: number | null;
  estado: "pagada" | "anulada";
  tipo: "contado" | "credito" | "separado";
  abonado: number;
  saldo: number;
  fecha_vencimiento: string | null;
  entregada: boolean;
  pagos: { id: string; valor: number; forma_pago: string; fecha: string; nota: string | null }[];
  notas: string | null;
  vendedor_id: string | null;
  clientes: { documento: string | null; nombre: string; telefono: string | null } | null;
  venta_items: {
    id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    descuento: number;
    total: number;
    productos: { codigo: string } | null;
    seriales: { serial: string }[];
  }[];
};

export default async function DetalleVenta({ params, searchParams }: PageProps<"/ventas/[id]">) {
  const { id } = await params;
  const { imprimir } = await searchParams;
  const { activa } = await sesionActual();
  if (!activa) notFound();
  const supabase = await crearClienteServidor();

  const [ventaRes, empresaRes] = await Promise.all([
    supabase
      .from("ventas")
      .select(
        "id, consecutivo, fecha, subtotal, descuento, iva, total, forma_pago, recibido, cambio, estado, notas, vendedor_id," +
          " tipo, abonado, saldo, fecha_vencimiento, entregada, pagos (id, valor, forma_pago, fecha, nota)," +
          " clientes (documento, nombre, telefono)," +
          " venta_items (id, descripcion, cantidad, precio_unitario, descuento, total, productos (codigo), seriales (serial))",
      )
      .eq("empresa_id", activa.id)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("empresas")
      .select("nombre, nit, direccion, telefono, ciudad, encabezado_tirilla, pie_tirilla, ancho_tirilla_mm")
      .eq("id", activa.id)
      .single(),
  ]);
  const v = ventaRes.data as unknown as Venta | null;
  if (!v) notFound();
  const e = empresaRes.data!;

  const { data: vendedor } = v.vendedor_id
    ? await supabase.from("perfiles").select("nombre").eq("usuario_id", v.vendedor_id).maybeSingle()
    : { data: null };

  const ancho = e.ancho_tirilla_mm === 58 ? 58 : 80;
  const pagos = [...v.pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const vigente = v.estado === "pagada";

  return (
    <div className="space-y-6">
      <style>{`@media print { @page { size: ${ancho}mm auto; margin: 0 } }`}</style>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/ventas/historial" className="text-sm text-blue-700 hover:underline">
            ← Historial de ventas
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Venta #{v.consecutivo}
            {v.estado === "anulada" && (
              <span className="ml-3 rounded-full bg-red-100 px-3 py-1 align-middle text-sm text-red-700">Anulada</span>
            )}
          </h1>
          <p className="text-sm text-slate-500">
            {TIPO[v.tipo]} · {new Date(v.fecha).toLocaleString("es-CO")}
            {v.clientes && ` · ${v.clientes.nombre}`}
          </p>
          {v.tipo !== "contado" && vigente && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="text-sm">
                Abonado <strong className="text-green-700">{pesos(v.abonado)}</strong> · Saldo{" "}
                <strong className={v.saldo > 0 ? "text-red-600" : "text-green-700"}>{pesos(v.saldo)}</strong>
                {v.fecha_vencimiento && ` · vence ${new Date(`${v.fecha_vencimiento}T12:00`).toLocaleDateString("es-CO")}`}
              </span>
              {v.saldo > 0 && (
                <BotonAbonar
                  ventaId={v.id}
                  consecutivo={v.consecutivo}
                  cliente={v.clientes?.nombre ?? ""}
                  saldo={Number(v.saldo)}
                />
              )}
              {v.saldo <= 0 && !v.entregada && <BotonEntregar ventaId={v.id} />}
              {v.tipo === "separado" && v.entregada && <span className="text-sm text-green-700">Entregado</span>}
            </div>
          )}
        </div>
        <AccionesVenta
          ventaId={v.id}
          consecutivo={v.consecutivo}
          puedeAnular={activa.rol === "admin" && v.estado === "pagada"}
          imprimirAlAbrir={imprimir === "1"}
        />
      </div>

      {/* Tirilla: en pantalla se ve como vista previa y al imprimir es lo único que sale */}
      <div
        className="mx-auto bg-white p-3 font-mono text-[11px] leading-snug text-black shadow-sm ring-1 ring-slate-200 print:m-0 print:p-[2mm] print:shadow-none print:ring-0"
        style={{ width: `${ancho}mm` }}
      >
        <div className="text-center">
          <p className="text-[13px] font-bold">{e.nombre}</p>
          {e.nit && <p>NIT {e.nit}</p>}
          {e.direccion && <p>{e.direccion}</p>}
          {(e.ciudad || e.telefono) && <p>{[e.ciudad, e.telefono].filter(Boolean).join(" · ")}</p>}
          {e.encabezado_tirilla && <p className="mt-1 whitespace-pre-line">{e.encabezado_tirilla}</p>}
        </div>
        <Separador />
        <p>
          Venta No. {v.consecutivo} · {TIPO[v.tipo]}
        </p>
        <p>{new Date(v.fecha).toLocaleString("es-CO")}</p>
        {vendedor?.nombre && <p>Atendió: {vendedor.nombre}</p>}
        {v.clientes && (
          <p>
            Cliente: {v.clientes.nombre}
            {v.clientes.documento && ` (${v.clientes.documento})`}
          </p>
        )}
        {v.estado === "anulada" && <p className="text-center font-bold">*** VENTA ANULADA ***</p>}
        <Separador />
        {v.venta_items.map((item) => (
          <div key={item.id} className="mb-1">
            <p>{item.descripcion}</p>
            <div className="flex justify-between">
              <span>
                {cantidad(item.cantidad)} x {pesos(item.precio_unitario)}
              </span>
              <span>{pesos(item.total)}</span>
            </div>
            {item.descuento > 0 && <p className="pl-2">Desc. -{pesos(item.descuento)}</p>}
            {item.seriales.map((s) => (
              <p key={s.serial} className="pl-2">
                S/N {s.serial}
              </p>
            ))}
          </div>
        ))}
        <Separador />
        <Fila texto="Subtotal" valor={pesos(v.subtotal)} />
        <Fila texto="IVA" valor={pesos(v.iva)} />
        {v.descuento > 0 && <Fila texto="Descuentos" valor={`-${pesos(v.descuento)}`} />}
        <div className="flex justify-between text-[14px] font-bold">
          <span>TOTAL</span>
          <span>{pesos(v.total)}</span>
        </div>
        <Separador />
        {v.tipo === "contado" ? (
          <Fila texto="Forma de pago" valor={FORMA[v.forma_pago] ?? v.forma_pago} />
        ) : (
          <>
            <p className="font-bold">Pagos</p>
            {pagos.length === 0 && <p>Sin abonos</p>}
            {pagos.map((pg) => (
              <Fila
                key={pg.id}
                texto={`${new Date(pg.fecha).toLocaleDateString("es-CO")} ${FORMA[pg.forma_pago] ?? pg.forma_pago}`}
                valor={pesos(pg.valor)}
              />
            ))}
            <Fila texto="Total abonado" valor={pesos(v.abonado)} />
            <div className="flex justify-between font-bold">
              <span>SALDO</span>
              <span>{pesos(v.saldo)}</span>
            </div>
            {v.fecha_vencimiento && v.saldo > 0 && (
              <p>Pagar antes de: {new Date(`${v.fecha_vencimiento}T12:00`).toLocaleDateString("es-CO")}</p>
            )}
            {v.tipo === "separado" && (
              <p>{v.entregada ? "Producto entregado" : "Producto separado: se entrega al completar el pago"}</p>
            )}
          </>
        )}
        {v.notas && <p className="mt-1">{v.notas}</p>}
        {e.pie_tirilla && (
          <>
            <Separador />
            <p className="text-center whitespace-pre-line">{e.pie_tirilla}</p>
          </>
        )}
        <p className="mt-2 text-center text-[9px]">Documento no válido como factura electrónica</p>
      </div>
    </div>
  );
}

function Separador() {
  return <p className="my-1 overflow-hidden whitespace-nowrap">{"-".repeat(60)}</p>;
}

function Fila({ texto, valor }: { texto: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span>{texto}</span>
      <span>{valor}</span>
    </div>
  );
}
