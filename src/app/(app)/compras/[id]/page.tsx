import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirRol } from "@/lib/empresa";
import { cantidad, fecha, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ValorCopiable } from "@/components/copiar";
import { EliminarCompra } from "./eliminar";

type Item = {
  id: string;
  descripcion: string;
  codigo_proveedor: string | null;
  cantidad: number;
  costo_unitario: number;
  iva_porcentaje: number;
  total: number;
  productos: { codigo: string; nombre: string } | null;
  seriales: { serial: string; estado: string }[];
};

export default async function DetalleCompra({ params }: PageProps<"/compras/[id]">) {
  const { id } = await params;
  const { activa } = await exigirRol("admin", "bodega");
  const supabase = await crearClienteServidor();

  const { data: compra } = await supabase
    .from("compras")
    .select(
      "id, numero_factura, cufe, fecha, subtotal, iva, total, xml_path, pdf_path, soporte_path, origen, creado_en, proveedores (nombre, nit)," +
        " compra_items (id, descripcion, codigo_proveedor, cantidad, costo_unitario, iva_porcentaje, total," +
        " productos (codigo, nombre), seriales (serial, estado))",
    )
    .eq("empresa_id", activa.id)
    .eq("id", id)
    .maybeSingle();
  if (!compra) notFound();

  const c = compra as unknown as {
    numero_factura: string;
    cufe: string | null;
    fecha: string;
    subtotal: number;
    iva: number;
    total: number;
    xml_path: string | null;
    pdf_path: string | null;
    soporte_path: string | null;
    proveedores: { nombre: string; nit: string };
    compra_items: Item[];
  };

  const archivos = await Promise.all(
    [
      { ruta: c.xml_path, texto: "Descargar XML" },
      { ruta: c.pdf_path, texto: "Ver PDF" },
      { ruta: c.soporte_path, texto: "Ver soporte (foto/PDF)" },
    ]
      .filter((a) => a.ruta)
      .map(async (a) => {
        const { data } = await supabase.storage.from("compras").createSignedUrl(a.ruta!, 300);
        return { ...a, url: data?.signedUrl };
      }),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/compras" className="text-sm text-blue-700 hover:underline">
          ← Compras
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Factura {c.numero_factura}</h1>
            <p className="text-sm text-slate-500">
              {c.proveedores.nombre} · NIT {c.proveedores.nit} · {fecha(c.fecha)}
            </p>
            <p className="text-sm text-slate-500">
              Cargada a <strong className="text-slate-700">{activa.nombre}</strong>
            </p>
          </div>
          {activa.rol === "admin" && <EliminarCompra compraId={id} numero={c.numero_factura} empresa={activa.nombre} />}
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href={`/etiquetas?compra=${id}`} className="text-sm font-medium text-blue-700 hover:underline">
            Imprimir etiquetas QR de esta compra
          </Link>
          {archivos.map(
            (a) =>
              a.url && (
                <a key={a.texto} href={a.url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline">
                  {a.texto}
                </a>
              ),
          )}
        </div>
        {c.cufe && (
          <div className="mt-3 max-w-3xl">
            <ValorCopiable etiqueta="CUFE" valor={c.cufe} />
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 text-right font-medium">Cant.</th>
              <th className="px-4 py-3 text-right font-medium">Costo u.</th>
              <th className="px-4 py-3 text-right font-medium">IVA</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {c.compra_items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.productos?.nombre ?? item.descripcion}</p>
                  <p className="text-xs text-slate-500">
                    Código {item.productos?.codigo} · Cód. proveedor {item.codigo_proveedor ?? "—"}
                  </p>
                  {item.seriales.length > 0 && (
                    <details className="mt-1 text-xs text-slate-600">
                      <summary className="cursor-pointer text-blue-700">{item.seriales.length} serial(es)</summary>
                      <ul className="mt-1 font-mono">
                        {item.seriales.map((s) => (
                          <li key={s.serial}>
                            {s.serial} <span className="text-slate-400">({s.estado})</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{cantidad(item.cantidad)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{pesos(item.costo_unitario)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{item.iva_porcentaje}%</td>
                <td className="px-4 py-3 text-right tabular-nums">{pesos(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 text-slate-900">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-500">Subtotal</td>
              <td className="px-4 py-2 text-right tabular-nums">{pesos(c.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-500">IVA</td>
              <td className="px-4 py-2 text-right tabular-nums">{pesos(c.iva)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right font-semibold">Total</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{pesos(c.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
