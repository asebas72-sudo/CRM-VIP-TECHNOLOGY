import "server-only";
import { unzipSync } from "fflate";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { leerFacturaDian } from "@/lib/facturas/dian";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { extraerDatosPago, extraerEmpresaDeAsunto } from "./pagos";

/**
 * Lee la cuenta de Gmail (IMAP con contraseña de aplicación) y guarda las
 * facturas (.zip con XML DIAN) y las notificaciones de pago. Lo llama la
 * tarea programada cada 15 minutos y el botón "Procesar ahora".
 */

// Bajo a propósito: Render gratis tiene poca memoria; lo que falte se lee en la siguiente revisión
const MAX_CORREOS_POR_EJECUCION = 20;

export type ResultadoRevision = {
  correosLeidos: number;
  facturasNuevas: number;
  pagosNuevos: number;
  errores: number;
  pendientes: number; // quedaron para la siguiente revisión
};

type Admin = ReturnType<typeof crearClienteAdmin>;

function decodificar(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("latin1").decode(bytes) : utf8;
}

/** XML de los adjuntos: dentro de .zip o sueltos. */
function xmlsDelCorreo(correo: ParsedMail): { archivo: string; xml: string }[] {
  const salida: { archivo: string; xml: string }[] = [];
  for (const adjunto of correo.attachments) {
    const nombre = (adjunto.filename ?? "").toLowerCase();
    if (nombre.endsWith(".zip")) {
      const archivos = unzipSync(new Uint8Array(adjunto.content));
      for (const [ruta, bytes] of Object.entries(archivos)) {
        if (ruta.toLowerCase().endsWith(".xml")) salida.push({ archivo: adjunto.filename ?? ruta, xml: decodificar(bytes) });
      }
    } else if (nombre.endsWith(".xml")) {
      salida.push({ archivo: adjunto.filename ?? "factura.xml", xml: decodificar(new Uint8Array(adjunto.content)) });
    }
  }
  return salida;
}

/** Datos básicos de la factura: primero con el lector DIAN completo y, si falla, por texto (como el Apps Script). */
function datosFactura(xml: string) {
  try {
    const f = leerFacturaDian(xml);
    if (f.cufe) {
      return {
        cufe: f.cufe,
        numero: f.numero || null,
        fecha: f.fecha || null,
        proveedorNombre: f.proveedor.nombre || null,
        proveedorNit: f.proveedor.nit || null,
        clienteNombre: f.cliente.nombre || null,
        clienteNit: f.cliente.nit || null,
        monto: f.total,
      };
    }
  } catch {
    // Formatos poco comunes: se intenta por texto
  }
  const cufe =
    xml.match(/<cbc:UUID[^>]*schemeName="[^"]*CUFE[^"]*"[^>]*>([^<]+)<\/cbc:UUID>/i)?.[1] ??
    xml.match(/<cbc:UUID[^>]*>([^<]{40,})<\/cbc:UUID>/i)?.[1];
  if (!cufe) return null;
  const bloqueProveedor = xml.match(/<cac:AccountingSupplierParty[\s\S]*?<\/cac:AccountingSupplierParty>/i)?.[0] ?? "";
  const monto =
    xml.match(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/i)?.[1] ??
    xml.match(/<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/i)?.[1];
  return {
    cufe: cufe.trim(),
    numero: null,
    fecha: xml.match(/<cbc:IssueDate[^>]*>([^<]+)<\/cbc:IssueDate>/i)?.[1].trim() ?? null,
    proveedorNombre:
      bloqueProveedor.match(/<cbc:RegistrationName[^>]*>([^<]+)<\/cbc:RegistrationName>/i)?.[1].trim() ??
      bloqueProveedor.match(/<cbc:Name>([^<]+)<\/cbc:Name>/i)?.[1].trim() ??
      null,
    proveedorNit: null,
    clienteNombre: null,
    clienteNit: null,
    monto: monto ? Number.parseFloat(monto) : null,
  };
}

/** Las facturas entran sin empresa: el superadmin la elige en "Facturas compras". */
async function guardarFacturas(admin: Admin, correo: ParsedMail, correoId: string) {
  let nuevas = 0;
  for (const { archivo, xml } of xmlsDelCorreo(correo)) {
    const d = datosFactura(xml);
    if (!d) continue;
    const { data } = await admin
      .from("facturas_correo")
      .upsert(
        {
          cufe: d.cufe,
          numero: d.numero,
          fecha_documento: d.fecha && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) ? d.fecha : null,
          proveedor_nombre: d.proveedorNombre,
          proveedor_nit: d.proveedorNit,
          cliente_nombre: d.clienteNombre,
          cliente_nit: d.clienteNit,
          monto: d.monto,
          empresa_id: null,
          asunto: correo.subject ?? null,
          remitente: correo.from?.text ?? null,
          archivo,
          correo_id: correoId,
          xml,
        },
        { onConflict: "cufe", ignoreDuplicates: true },
      )
      .select("id");
    nuevas += data?.length ?? 0;
  }
  return nuevas;
}

async function guardarPagos(admin: Admin, correo: ParsedMail, correoId: string, prefijo: string) {
  const datos = extraerDatosPago(correo.text ?? "");
  if (!datos.empresa) datos.empresa = extraerEmpresaDeAsunto(correo.subject ?? "");

  // Solo las líneas de facturas propias (prefijo VPFE); ajustes y reversiones se descartan
  const filas = datos.lineas
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => !prefijo || l.nroFacturaProveedor.toUpperCase().startsWith(prefijo.toUpperCase()))
    .map(({ l, i }) => ({
      id_linea: `${correoId}-${i}`,
      fecha_pago: datos.fechaPago,
      fecha_pago_texto: datos.fechaPagoTexto || null,
      empresa_pagadora: datos.empresa || null,
      cuenta: datos.cuenta || null,
      banco: datos.banco || null,
      valor_total: datos.valorTotal,
      nro_factura: l.nroFactura,
      nro_factura_proveedor: l.nroFacturaProveedor,
      valor_pagado: l.valorPagado,
      retefte: l.reteFte,
      asunto: correo.subject ?? null,
      remitente: correo.from?.text ?? null,
      correo_id: correoId,
    }));
  if (filas.length === 0) return 0;
  const { data } = await admin.from("pagos_correo").upsert(filas, { onConflict: "id_linea", ignoreDuplicates: true }).select("id");
  return data?.length ?? 0;
}

export async function revisarCorreo(): Promise<ResultadoRevision> {
  const usuario = process.env.GMAIL_USUARIO;
  const clave = process.env.GMAIL_CLAVE_APP;
  if (!usuario || !clave) {
    throw new Error("Falta configurar GMAIL_USUARIO y GMAIL_CLAVE_APP (contraseña de aplicación de Google) en el servidor.");
  }

  const admin = crearClienteAdmin();
  const { data: config, error: errorConfig } = await admin.from("buzon_config").select("*").eq("id", 1).single();
  if (errorConfig || !config) throw new Error("No se encontró la configuración del buzón (ejecute la migración 0012).");

  const resultado: ResultadoRevision = { correosLeidos: 0, facturasNuevas: 0, pagosNuevos: 0, errores: 0, pendientes: 0 };
  const cliente = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: usuario, pass: clave.replace(/\s/g, "") },
    logger: false,
  });

  await cliente.connect();
  try {
    // "Todos" en Gmail: incluye los correos archivados, no solo la bandeja de entrada
    const carpetas = await cliente.list();
    const todos = carpetas.find((c) => c.specialUse === "\\All")?.path ?? "INBOX";
    const bloqueo = await cliente.getMailboxLock(todos);
    try {
      const desde = String(config.fecha_inicio).replace(/-/g, "/");
      const remitentes = `from:(${(config.remitentes as string[]).join(" OR ")})`;
      const busquedas: { tipo: "factura" | "pago"; consulta: string }[] = [
        { tipo: "factura", consulta: `has:attachment filename:zip ${remitentes} after:${desde}` },
        { tipo: "pago", consulta: `${remitentes} subject:"${config.asunto_pagos}" after:${desde}` },
      ];

      // Mensajes encontrados que aún no se han procesado
      const porProcesar: { tipo: "factura" | "pago"; uid: number; id: string }[] = [];
      for (const b of busquedas) {
        const uids = (await cliente.search({ gmraw: b.consulta }, { uid: true })) || [];
        if (uids.length === 0) continue;
        const mensajes = await cliente.fetchAll(uids.join(","), { uid: true, emailId: true }, { uid: true });
        const ids = mensajes.map((m) => m.emailId ?? `uid-${m.uid}`);
        const { data: hechos } = await admin.from("correos_procesados").select("id").in("id", ids);
        const yaHechos = new Set((hechos ?? []).map((h) => h.id));
        for (const m of mensajes) {
          const id = m.emailId ?? `uid-${m.uid}`;
          if (!yaHechos.has(id) && !porProcesar.some((p) => p.id === id)) porProcesar.push({ tipo: b.tipo, uid: m.uid, id });
        }
      }

      resultado.pendientes = Math.max(0, porProcesar.length - MAX_CORREOS_POR_EJECUCION);
      for (const p of porProcesar.slice(0, MAX_CORREOS_POR_EJECUCION)) {
        const mensaje = await cliente.fetchOne(String(p.uid), { source: true }, { uid: true });
        if (!mensaje || !mensaje.source) continue;
        const correo = await simpleParser(mensaje.source);
        resultado.correosLeidos += 1;

        await admin.from("correos_procesados").upsert({
          id: p.id,
          tipo: p.tipo,
          estado: "ok",
          asunto: correo.subject ?? null,
          remitente: correo.from?.text ?? null,
          fecha_correo: correo.date?.toISOString() ?? null,
        });

        try {
          const nuevos =
            p.tipo === "factura"
              ? await guardarFacturas(admin, correo, p.id)
              : await guardarPagos(admin, correo, p.id, config.prefijo_factura_pago);
          if (p.tipo === "factura") resultado.facturasNuevas += nuevos;
          else resultado.pagosNuevos += nuevos;
          if (nuevos === 0) {
            await admin.from("correos_procesados").update({ estado: "sin_datos" }).eq("id", p.id);
          }
        } catch (e) {
          resultado.errores += 1;
          await admin
            .from("correos_procesados")
            .update({ estado: "error", detalle: e instanceof Error ? e.message : String(e) })
            .eq("id", p.id);
        }
      }
    } finally {
      bloqueo.release();
    }
  } finally {
    await cliente.logout().catch(() => undefined);
  }

  await admin
    .from("buzon_config")
    .update({
      ultima_revision: new Date().toISOString(),
      ultimo_resultado: `${resultado.correosLeidos} correo(s) · ${resultado.facturasNuevas} factura(s) · ${resultado.pagosNuevos} pago(s)${
        resultado.errores ? ` · ${resultado.errores} error(es)` : ""
      }${resultado.pendientes ? ` · quedan ${resultado.pendientes} por leer` : ""}`,
    })
    .eq("id", 1);

  return resultado;
}
