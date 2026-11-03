"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_EMPRESA } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoEmpresa = { error?: string };

export async function crearEmpresa(_: EstadoEmpresa, form: FormData): Promise<EstadoEmpresa> {
  const nombre = String(form.get("nombre") ?? "").trim();
  const nit = String(form.get("nit") ?? "").trim() || null;
  if (!nombre) return { error: "El nombre de la empresa es obligatorio." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("crear_empresa", { p_nombre: nombre, p_nit: nit });
  if (error) return { error: `No se pudo crear la empresa: ${error.message}` };

  (await cookies()).set(COOKIE_EMPRESA, data as string, { path: "/", sameSite: "lax" });
  redirect("/");
}

export async function actualizarEmpresa(form: FormData) {
  const id = String(form.get("id") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim();
  const nit = String(form.get("nit") ?? "").trim() || null;
  if (!nombre) throw new Error("El nombre de la empresa es obligatorio.");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("empresas").update({ nombre, nit }).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar la empresa: ${error.message}`);
  revalidatePath("/", "layout");
}

export async function cambiarEmpresa(form: FormData) {
  const id = String(form.get("empresa_id") ?? "");
  (await cookies()).set(COOKIE_EMPRESA, id, { path: "/", sameSite: "lax" });
  redirect("/");
}
