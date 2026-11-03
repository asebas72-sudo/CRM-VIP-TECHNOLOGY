"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoAgregar = { error?: string; mensaje?: string };

const ROLES = ["admin", "bodega", "vendedor"];

export async function agregarUsuario(_: EstadoAgregar, form: FormData): Promise<EstadoAgregar> {
  const correo = String(form.get("correo") ?? "").trim();
  const rol = String(form.get("rol") ?? "");
  const empresas = form.getAll("empresas").map(String).filter(Boolean);

  if (!correo) return { error: "Escriba el correo del usuario." };
  if (!ROLES.includes(rol)) return { error: "Seleccione un rol." };
  if (empresas.length === 0) return { error: "Seleccione al menos una empresa." };

  const supabase = await crearClienteServidor();
  for (const empresa of empresas) {
    const { error } = await supabase.rpc("asignar_usuario", {
      p_correo: correo,
      p_empresa: empresa,
      p_rol: rol,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/usuarios");
  return { mensaje: `Acceso asignado a ${correo} en ${empresas.length} empresa(s).` };
}

/** Cambia el rol de un usuario en una empresa; rol vacío = quitar acceso. */
export async function cambiarRol(form: FormData) {
  const usuario = String(form.get("usuario_id"));
  const correo = String(form.get("correo"));
  const empresa = String(form.get("empresa_id"));
  const rol = String(form.get("rol") ?? "");

  const supabase = await crearClienteServidor();
  const { error } = rol
    ? await supabase.rpc("asignar_usuario", { p_correo: correo, p_empresa: empresa, p_rol: rol })
    : await supabase.rpc("quitar_usuario", { p_usuario: usuario, p_empresa: empresa });
  if (error) throw new Error(error.message);

  revalidatePath("/usuarios");
}

export async function cambiarAccesoTotal(form: FormData) {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("definir_acceso_total", {
    p_usuario: String(form.get("usuario_id")),
    p_valor: form.get("valor") === "true",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/usuarios");
}

export async function cambiarActivo(form: FormData) {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("definir_usuario_activo", {
    p_usuario: String(form.get("usuario_id")),
    p_valor: form.get("valor") === "true",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/usuarios");
}
