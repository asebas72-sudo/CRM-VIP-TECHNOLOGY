"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoLogin = { error?: string; mensaje?: string };

export async function iniciarSesion(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const correo = String(form.get("correo") ?? "").trim();
  const clave = String(form.get("clave") ?? "");
  if (!correo || !clave) return { error: "Ingrese correo y contraseña." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect("/");
}

export async function registrarse(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const nombre = String(form.get("nombre") ?? "").trim();
  const correo = String(form.get("correo") ?? "").trim();
  const clave = String(form.get("clave") ?? "");
  if (!nombre || !correo || clave.length < 8) {
    return { error: "Complete nombre, correo y una contraseña de al menos 8 caracteres." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: clave,
    options: { data: { nombre } },
  });
  if (error) return { error: `No se pudo crear la cuenta: ${error.message}` };

  if (!data.session) {
    return { mensaje: "Cuenta creada. Revise su correo para confirmarla y luego inicie sesión." };
  }
  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
