"use server";

import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/empresa";
import { construirCodigo, ESTADOS_ASESORIA, ESTADOS_ORDEN, fechaCorta, MAX_FOTOS } from "@/lib/servicio";
import { crearClienteServidor } from "@/lib/supabase/server";

const exigirServicio = () => exigirRol("admin", "vendedor", "tecnico");

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
const digitos = (v: string) => v.replace(/\D/g, "");

export type ClienteServicio = { id: string; nombre: string; telefono: string | null; correo: string | null };

/** Busca un cliente de la empresa por cédula para autocompletar el formulario. */
export async function buscarClientePorCedula(cedula: string): Promise<ClienteServicio | null> {
  const { activa } = await exigirServicio();
  const doc = digitos(cedula);
  if (doc.length < 5) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, correo")
    .eq("empresa_id", activa.id)
    .eq("documento", doc)
    .maybeSingle();
  return data;
}

async function guardarCliente(empresaId: string, documento: string, nombre: string, celular: string, correo: string | null) {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("clientes")
    .upsert(
      { empresa_id: empresaId, documento, nombre, telefono: celular, correo },
      { onConflict: "empresa_id,documento" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo guardar el cliente: ${error.message}`);
  return data.id as string;
}

/** Sube un archivo al bucket privado "servicio" y devuelve su ruta. */
async function subir(ruta: string, archivo: Blob, tipo: string): Promise<string | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from("servicio").upload(ruta, archivo, { contentType: tipo, upsert: true });
  return error ? null : data.path;
}

function dataUrlABlob(dataUrl: string): Blob | null {
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return new Blob([Buffer.from(m[2], "base64")], { type: m[1] });
}

async function siguienteNumero(empresaId: string, tipo: "orden" | "asesoria"): Promise<number> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("reservar_consecutivo", { p_empresa: empresaId, p_tipo: tipo });
  if (error) throw new Error(error.message);
  return data as number;
}

// ---------------------------------------------------------------------
// Órdenes de servicio
// ---------------------------------------------------------------------

export type ResultadoIngreso =
  | {
      ok: true;
      id: string;
      codigo: string;
      consecutivo: number;
      nombre: string;
      celular: string;
      equipo: string;
      fechaIngreso: string;
      fechaEntrega: string;
    }
  | { ok: false; error: string };

export async function crearOrden(form: FormData): Promise<ResultadoIngreso> {
  try {
    const { activa } = await exigirServicio();
    const nombre = texto(form, "nombre");
    const cedula = digitos(texto(form, "cedula"));
    const celular = digitos(texto(form, "celular"));
    const correo = texto(form, "correo") || null;
    const equipo = texto(form, "equipo");
    const tipo = texto(form, "tipo");
    const marca = texto(form, "marca");
    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
    if (!cedula) return { ok: false, error: "La cédula es obligatoria y debe ser numérica." };
    if (!celular) return { ok: false, error: "El celular es obligatorio y debe ser numérico." };
    if (!equipo) return { ok: false, error: "Describa el equipo." };
    if (!tipo) return { ok: false, error: "Seleccione el tipo de equipo." };
    if (!marca) return { ok: false, error: "Seleccione la marca." };

    const supabase = await crearClienteServidor();
    const { data: empresa } = await supabase.from("empresas").select("dias_entrega_servicio").eq("id", activa.id).single();
    const hoy = new Date();
    const entrega = new Date(hoy.getTime() + (empresa?.dias_entrega_servicio ?? 8) * 86_400_000);

    // Marca nueva escrita a mano: queda en la lista para la próxima vez
    await supabase.from("marcas").upsert({ nombre: marca }, { onConflict: "nombre", ignoreDuplicates: true });

    const clienteId = await guardarCliente(activa.id, cedula, nombre, celular, correo);
    const consecutivo = await siguienteNumero(activa.id, "orden");
    const codigo = construirCodigo(cedula, nombre, marca, hoy);

    const { data: orden, error } = await supabase
      .from("ordenes_servicio")
      .insert({
        empresa_id: activa.id,
        consecutivo,
        codigo,
        cliente_id: clienteId,
        cliente_nombre: nombre,
        cliente_documento: cedula,
        celular,
        correo,
        equipo,
        tipo_equipo: tipo,
        marca,
        accesorios: form.getAll("accesorios").map(String).filter(Boolean),
        fallas: texto(form, "fallas") || null,
        observaciones: texto(form, "observaciones") || null,
        fecha_ingreso: hoy.toISOString(),
        fecha_entrega_estimada: entrega.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    // Foto del equipo y firma del cliente
    const rutas: { foto_ingreso_path?: string; firma_path?: string } = {};
    const foto = form.get("foto");
    if (foto instanceof File && foto.size > 0) {
      const ruta = await subir(`${activa.id}/ordenes/${orden.id}/ingreso.jpg`, foto, foto.type || "image/jpeg");
      if (ruta) rutas.foto_ingreso_path = ruta;
    }
    const firma = dataUrlABlob(texto(form, "firma"));
    if (firma) {
      const ruta = await subir(`${activa.id}/ordenes/${orden.id}/firma.png`, firma, "image/png");
      if (ruta) rutas.firma_path = ruta;
    }
    if (rutas.foto_ingreso_path || rutas.firma_path) {
      await supabase.from("ordenes_servicio").update(rutas).eq("id", orden.id);
    }

    revalidatePath("/servicio");
    return {
      ok: true,
      id: orden.id,
      codigo,
      consecutivo,
      nombre,
      celular,
      equipo,
      fechaIngreso: fechaCorta(hoy),
      fechaEntrega: fechaCorta(entrega),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar el ingreso." };
  }
}

/** Guarda la ficha técnica (técnico, estado, costo, bitácora, fotos e informe). */
export async function actualizarOrden(form: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const { activa } = await exigirServicio();
    const id = texto(form, "id");
    const estado = texto(form, "estado");
    if (!(ESTADOS_ORDEN as readonly string[]).includes(estado)) return { ok: false, error: "Estado inválido." };

    const tecnico = texto(form, "tecnico_id") || null;
    if (activa.rol === "tecnico" && tecnico && tecnico !== (await usuarioActual())) {
      return { ok: false, error: "Como técnico solo puede asignarse órdenes a usted mismo." };
    }

    const costoTexto = digitos(texto(form, "costo"));
    const existentes = (JSON.parse(texto(form, "fotos_existentes") || "[]") as string[]).filter((r) =>
      r.startsWith(`${activa.id}/ordenes/${id}/`),
    );
    const nuevas = form.getAll("fotos_nuevas").filter((f): f is File => f instanceof File && f.size > 0);
    const fotos = [...existentes];
    for (const [i, f] of nuevas.slice(0, Math.max(0, MAX_FOTOS - existentes.length)).entries()) {
      const ruta = await subir(`${activa.id}/ordenes/${id}/foto-${Date.now()}-${i}.jpg`, f, f.type || "image/jpeg");
      if (ruta) fotos.push(ruta);
    }

    const supabase = await crearClienteServidor();
    const { data: anterior } = await supabase.from("ordenes_servicio").select("fotos, entregado_en").eq("id", id).single();

    const { error, count } = await supabase
      .from("ordenes_servicio")
      .update(
        {
          tecnico_id: tecnico,
          estado,
          costo: costoTexto ? Number(costoTexto) : null,
          fecha_reparacion: texto(form, "fecha_reparacion") || null,
          comentario1: texto(form, "comentario1") || null,
          comentario2: texto(form, "comentario2") || null,
          observacion_final: texto(form, "observacion_final") || null,
          fotos,
          entregado_en: estado === "ENTREGADO" ? (anterior?.entregado_en ?? new Date().toISOString()) : null,
          actualizado_en: new Date().toISOString(),
        },
        { count: "exact" },
      )
      .eq("empresa_id", activa.id)
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    if (!count) return { ok: false, error: "No tiene permiso para editar esta orden (está asignada a otro técnico)." };

    // Fotos quitadas por el técnico: se borran del almacenamiento
    const quitadas = ((anterior?.fotos as string[] | undefined) ?? []).filter((r) => !fotos.includes(r));
    if (quitadas.length) await supabase.storage.from("servicio").remove(quitadas);

    revalidatePath("/servicio");
    revalidatePath(`/servicio/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar la ficha." };
  }
}

export async function entregarOrden(id: string): Promise<{ ok: boolean; error?: string }> {
  const { activa } = await exigirServicio();
  const supabase = await crearClienteServidor();
  const { error, count } = await supabase
    .from("ordenes_servicio")
    .update({ estado: "ENTREGADO", entregado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }, { count: "exact" })
    .eq("empresa_id", activa.id)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "No tiene permiso para entregar esta orden." };
  revalidatePath("/servicio");
  revalidatePath(`/servicio/${id}`);
  return { ok: true };
}

async function usuarioActual(): Promise<string | undefined> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub;
}

// ---------------------------------------------------------------------
// Asesorías
// ---------------------------------------------------------------------

export type ResultadoAsesoria =
  | { ok: true; id: string; consecutivo: number; nombre: string; celular: string; solicitud: string }
  | { ok: false; error: string };

export async function crearAsesoria(form: FormData): Promise<ResultadoAsesoria> {
  try {
    const { activa } = await exigirServicio();
    const nombre = texto(form, "nombre");
    const cedula = digitos(texto(form, "cedula"));
    const celular = digitos(texto(form, "celular"));
    const correo = texto(form, "correo") || null;
    const solicitud = texto(form, "solicitud");
    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
    if (!cedula) return { ok: false, error: "La cédula es obligatoria y debe ser numérica." };
    if (!celular) return { ok: false, error: "El celular es obligatorio y debe ser numérico." };
    if (!solicitud) return { ok: false, error: "Seleccione el tipo de asesoría." };

    const clienteId = await guardarCliente(activa.id, cedula, nombre, celular, correo);
    const consecutivo = await siguienteNumero(activa.id, "asesoria");

    const supabase = await crearClienteServidor();
    const { data, error } = await supabase
      .from("asesorias")
      .insert({
        empresa_id: activa.id,
        consecutivo,
        cliente_id: clienteId,
        cliente_nombre: nombre,
        cliente_documento: cedula,
        celular,
        correo,
        solicitud,
        fallas: texto(form, "fallas") || null,
        observaciones: texto(form, "observaciones") || null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    const imagen = form.get("imagen");
    if (imagen instanceof File && imagen.size > 0) {
      const ruta = await subir(`${activa.id}/asesorias/${data.id}/imagen.jpg`, imagen, imagen.type || "image/jpeg");
      if (ruta) await supabase.from("asesorias").update({ imagen_path: ruta }).eq("id", data.id);
    }

    revalidatePath("/servicio/asesorias");
    return { ok: true, id: data.id, consecutivo, nombre, celular, solicitud };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar la asesoría." };
  }
}

export async function actualizarAsesoria(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const { activa } = await exigirServicio();
  const id = texto(form, "id");
  const estado = texto(form, "estado");
  if (!(ESTADOS_ASESORIA as readonly string[]).includes(estado)) return { ok: false, error: "Estado inválido." };

  const tecnico = texto(form, "tecnico_id") || null;
  if (activa.rol === "tecnico" && tecnico && tecnico !== (await usuarioActual())) {
    return { ok: false, error: "Como técnico solo puede asignarse asesorías a usted mismo." };
  }
  const visita = texto(form, "fecha_visita"); // aaaa-mm-ddThh:mm en hora de Colombia
  const costo = digitos(texto(form, "costo"));

  const supabase = await crearClienteServidor();
  const { error, count } = await supabase
    .from("asesorias")
    .update(
      {
        estado,
        tecnico_id: tecnico,
        fecha_visita: visita ? `${visita}:00-05:00` : null,
        costo: costo ? Number(costo) : null,
        observacion_final: texto(form, "observacion_final") || null,
        actualizado_en: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("empresa_id", activa.id)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!count) {
    return { ok: false, error: "No se pudo guardar: la asesoría ya está REALIZADA o está asignada a otro técnico." };
  }

  revalidatePath("/servicio/asesorias");
  revalidatePath(`/servicio/asesorias/${id}`);
  return { ok: true };
}
