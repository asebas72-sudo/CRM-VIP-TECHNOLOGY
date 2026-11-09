"use server";

import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

const BUCKET = "portafolio";
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

async function subirImagen(supabase: Cliente, empresaId: string, nombre: string, archivo: File): Promise<{ path?: string; error?: string }> {
  if (!TIPOS.includes(archivo.type)) return { error: "La imagen debe ser JPG, PNG o WEBP." };
  if (archivo.size > MAX_BYTES) return { error: "La imagen pesa más de 5 MB." };
  const extension = archivo.type.split("/")[1];
  const path = `${empresaId}/${nombre}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, { contentType: archivo.type });
  return error ? { error: error.message } : { path };
}

function normalizarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Datos generales del portafolio de la empresa activa. */
export async function guardarConfiguracion(form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const { activa } = await exigirRol("admin");
  const texto = (campo: string) => String(form.get(campo) ?? "").trim() || null;

  const slug = normalizarSlug(String(form.get("slug") ?? ""));
  if (!slug) return { error: "Escriba la dirección del portafolio." };
  const color = String(form.get("color") ?? "");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "El color no es válido." };
  const agotados = form.get("agotados") === "ocultar" ? "ocultar" : "por_pedido";

  const supabase = await crearClienteServidor();
  const datos: Record<string, unknown> = {
    empresa_id: activa.id,
    slug,
    color,
    agotados,
    activo: form.get("activo") === "on",
    mostrar_precios: form.get("mostrar_precios") === "on",
    titulo: texto("titulo"),
    mensaje: texto("mensaje"),
    whatsapp: texto("whatsapp"),
    correo: texto("correo"),
    direccion: texto("direccion"),
    facebook: texto("facebook"),
    instagram: texto("instagram"),
    actualizado_en: new Date().toISOString(),
  };

  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const r = await subirImagen(supabase, activa.id, "logo", logo);
    if (r.error) return { error: r.error };
    datos.logo_path = r.path;
  }

  const { error } = await supabase.from("portafolio_config").upsert(datos, { onConflict: "empresa_id" });
  if (error) {
    if (error.code === "23505") return { error: "Esa dirección ya la usa otra empresa. Escriba otra." };
    return { error: error.message };
  }
  revalidatePath("/portafolio");
  return { ok: true };
}

/** Publicar, etiqueta, descripción y foto de un producto o servicio. */
export async function guardarItem(form: FormData): Promise<{ error?: string; foto_path?: string | null }> {
  const { activa } = await exigirRol("admin");
  const id = String(form.get("id") ?? "");
  const etiqueta = String(form.get("etiqueta") ?? "");

  const supabase = await crearClienteServidor();
  const { data: actual, error: errorActual } = await supabase
    .from("productos")
    .select("foto_path")
    .eq("empresa_id", activa.id)
    .eq("id", id)
    .maybeSingle();
  if (errorActual) return { error: errorActual.message };
  if (!actual) return { error: "No se encontró el producto en esta empresa." };

  const cambios: Record<string, unknown> = {
    publicar_portafolio: form.get("publicar") === "true",
    descripcion_comercial: String(form.get("descripcion") ?? "").trim() || null,
    etiqueta_portafolio: etiqueta === "oferta" || etiqueta === "nuevo" ? etiqueta : null,
    actualizado_en: new Date().toISOString(),
  };

  let foto_path = actual.foto_path as string | null;
  const foto = form.get("foto");
  if (foto instanceof File && foto.size > 0) {
    const r = await subirImagen(supabase, activa.id, id, foto);
    if (r.error) return { error: r.error };
    cambios.foto_path = foto_path = r.path!;
  } else if (form.get("quitar_foto") === "true") {
    cambios.foto_path = foto_path = null;
  }

  const { error } = await supabase.from("productos").update(cambios).eq("empresa_id", activa.id).eq("id", id);
  if (error) return { error: error.message };

  // La foto anterior ya no se usa
  if (actual.foto_path && actual.foto_path !== foto_path) {
    await supabase.storage.from(BUCKET).remove([actual.foto_path]);
  }
  revalidatePath("/portafolio");
  return { foto_path };
}
