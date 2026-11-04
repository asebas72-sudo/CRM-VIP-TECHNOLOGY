import { Lora } from "next/font/google";
import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { PanelBuzon, type FacturaCorreo, type PagoCorreo } from "./panel";

const lora = Lora({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-lora" });

/** Procesar facturas de compra: facturas y pagos que llegan al correo. Solo superadmin. */
export default async function PaginaFacturasCompra() {
  const { perfil, todas } = await sesionActual();
  if (!perfil.acceso_total) redirect("/");

  const supabase = await crearClienteServidor();
  const [facturasRes, pagosRes, configRes] = await Promise.all([
    supabase
      .from("facturas_correo")
      .select(
        "id, cufe, numero, fecha_documento, proveedor_nombre, proveedor_nit, cliente_nombre, cliente_nit, monto, empresa_id, asunto, remitente, archivo, compra_id, cuenti, sin_empresa, creado_en",
      )
      .order("fecha_documento", { ascending: false, nullsFirst: false })
      .order("creado_en", { ascending: false })
      .limit(3000),
    supabase
      .from("pagos_correo")
      .select(
        "id, fecha_pago, fecha_pago_texto, empresa_pagadora, cuenta, banco, valor_total, nro_factura, nro_factura_proveedor, valor_pagado, retefte, asunto, cuenti, creado_en",
      )
      .order("fecha_pago", { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase.from("buzon_config").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (facturasRes.error) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        Falta ejecutar la migración <strong>0012_buzon_correo.sql</strong> en Supabase ({facturasRes.error.message}).
      </p>
    );
  }

  // Facturas que ya existen en Compras (subidas a mano o desde aquí), por CUFE
  const facturas = (facturasRes.data ?? []) as FacturaCorreo[];
  const cufes = facturas.filter((f) => !f.compra_id).map((f) => f.cufe);
  const enCompras = new Map<string, { id: string; empresa_id: string }>();
  for (let i = 0; i < cufes.length; i += 200) {
    const { data } = await supabase.from("compras").select("id, cufe, empresa_id").in("cufe", cufes.slice(i, i + 200));
    for (const c of data ?? []) if (c.cufe) enCompras.set(c.cufe, { id: c.id, empresa_id: c.empresa_id });
  }
  for (const f of facturas) {
    const c = enCompras.get(f.cufe);
    if (!f.compra_id && c) f.compra_id = c.id;
  }

  return (
    <div className={lora.variable}>
      <PanelBuzon
        facturas={facturas}
        pagos={(pagosRes.data ?? []) as PagoCorreo[]}
        empresas={todas.map((e) => ({ id: e.id, nombre: e.nombre }))}
        config={
          configRes.data
            ? {
                remitentes: configRes.data.remitentes,
                asunto_pagos: configRes.data.asunto_pagos,
                prefijo_factura_pago: configRes.data.prefijo_factura_pago,
                fecha_inicio: configRes.data.fecha_inicio,
              }
            : null
        }
        ultimaRevision={configRes.data?.ultima_revision ?? null}
        ultimoResultado={configRes.data?.ultimo_resultado ?? null}
      />
    </div>
  );
}
