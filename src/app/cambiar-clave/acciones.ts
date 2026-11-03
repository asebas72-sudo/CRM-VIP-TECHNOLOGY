"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoClave = { error?: string };

export async function cambiarClave(_: EstadoClave, form: FormData): Promise<EstadoClave> {
  const clave = String(form.get("clave") ?? "");
  const confirmacion = String(form.get("confirmacion") ?? "");
  if (clave.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave)) return { error: "Use letras y números en la contraseña." };
  if (clave !== confirmacion) return { error: "Las dos contraseñas no coinciden." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) {
    return {
      error: /different|same/i.test(error.message)
        ? "La nueva contraseña debe ser diferente a la temporal."
        : `No se pudo cambiar la contraseña: ${error.message}`,
    };
  }
  await supabase.rpc("marcar_clave_cambiada");
  redirect("/");
}
