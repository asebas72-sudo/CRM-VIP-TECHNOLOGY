"use server";

import { revalidatePath } from "next/cache";
import { sesionActual } from "@/lib/empresa";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Credenciales = { nombre: string; correo: string; clave: string; celular: string };
export type EstadoAgregar = { error?: string; credenciales?: Credenciales };

const ROLES = ["admin", "bodega", "vendedor", "tecnico"];

async function exigirSuperadmin() {
  const { perfil } = await sesionActual();
  if (!perfil.acceso_total) throw new Error("Solo el superadmin puede gestionar usuarios.");
}

/** Contraseña temporal legible: 3 letras + 4 números + símbolo (ej. Vip-4821#) */
function claveTemporal(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const n = crypto.getRandomValues(new Uint32Array(6));
  return `${letras[n[0] % 24]}${letras[n[1] % 24].toLowerCase()}${letras[n[2] % 24].toLowerCase()}-${String(n[3] % 10000).padStart(4, "0")}${"#$%&"[n[4] % 4]}`;
}

/** El superadmin crea la cuenta con contraseña temporal y le da acceso a las empresas. */
export async function crearUsuario(_: EstadoAgregar, form: FormData): Promise<EstadoAgregar> {
  try {
    await exigirSuperadmin();
    const nombre = String(form.get("nombre") ?? "").trim();
    const correo = String(form.get("correo") ?? "").trim().toLowerCase();
    const celular = String(form.get("celular") ?? "").replace(/\D/g, "");
    const clave = String(form.get("clave") ?? "").trim() || claveTemporal();
    const superadmin = form.get("superadmin") === "on";
    const rol = String(form.get("rol") ?? "");
    const empresas = form.getAll("empresas").map(String).filter(Boolean);

    if (!nombre) return { error: "Escriba el nombre del usuario." };
    if (!/^\S+@\S+\.\S+$/.test(correo)) return { error: "Escriba un correo válido." };
    if (clave.length < 8) return { error: "La contraseña temporal debe tener al menos 8 caracteres." };
    if (!superadmin) {
      if (!ROLES.includes(rol)) return { error: "Seleccione un rol." };
      if (empresas.length === 0) return { error: "Seleccione al menos una empresa." };
    }

    const admin = crearClienteAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email: correo,
      password: clave,
      email_confirm: true, // sin correo de confirmación: lo crea el superadmin
      user_metadata: { nombre },
    });
    if (error) {
      return {
        error: /already|registered|exists/i.test(error.message)
          ? `Ya existe un usuario con el correo ${correo}. Búsquelo en la tabla para darle acceso.`
          : `No se pudo crear el usuario: ${error.message}`,
      };
    }

    // Perfil (lo crea un disparador en la base de datos): celular, superadmin y cambio de clave obligatorio
    await admin
      .from("perfiles")
      .update({ nombre, celular: celular || null, acceso_total: superadmin, debe_cambiar_clave: true })
      .eq("usuario_id", data.user.id);

    if (!superadmin) {
      const supabase = await crearClienteServidor();
      for (const empresa of empresas) {
        const r = await supabase.rpc("asignar_usuario", { p_correo: correo, p_empresa: empresa, p_rol: rol });
        if (r.error) return { error: `Usuario creado, pero no se pudo asignar la empresa: ${r.error.message}` };
      }
    }

    revalidatePath("/usuarios");
    revalidatePath("/servicio/configuracion/usuarios");
    return { credenciales: { nombre, correo, clave, celular } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el usuario." };
  }
}

/** Nueva contraseña temporal para un usuario que olvidó la suya. */
export async function restablecerClave(usuarioId: string): Promise<{ error?: string; credenciales?: Credenciales }> {
  try {
    await exigirSuperadmin();
    const admin = crearClienteAdmin();
    const clave = claveTemporal();
    const { data, error } = await admin.auth.admin.updateUserById(usuarioId, { password: clave });
    if (error) return { error: error.message };
    const { data: p } = await admin
      .from("perfiles")
      .update({ debe_cambiar_clave: true })
      .eq("usuario_id", usuarioId)
      .select("nombre, correo, celular")
      .single();
    return {
      credenciales: { nombre: p?.nombre ?? "", correo: p?.correo ?? data.user.email ?? "", clave, celular: p?.celular ?? "" },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo restablecer la contraseña." };
  }
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
  revalidatePath("/servicio/configuracion/usuarios");
}

export async function cambiarAccesoTotal(form: FormData) {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("definir_acceso_total", {
    p_usuario: String(form.get("usuario_id")),
    p_valor: form.get("valor") === "true",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/usuarios");
  revalidatePath("/servicio/configuracion/usuarios");
}

export async function cambiarActivo(form: FormData) {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("definir_usuario_activo", {
    p_usuario: String(form.get("usuario_id")),
    p_valor: form.get("valor") === "true",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/usuarios");
  revalidatePath("/servicio/configuracion/usuarios");
}

export async function cambiarCelular(usuarioId: string, celular: string): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("definir_celular", { p_usuario: usuarioId, p_celular: celular });
  if (error) return { error: error.message };
  revalidatePath("/usuarios");
  revalidatePath("/servicio/configuracion/usuarios");
  return {};
}

export async function eliminarUsuario(usuarioId: string): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("eliminar_usuario", { p_usuario: usuarioId });
  if (error) return { error: error.message };
  revalidatePath("/usuarios");
  revalidatePath("/servicio/configuracion/usuarios");
  return {};
}
