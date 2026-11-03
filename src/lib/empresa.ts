import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export const COOKIE_EMPRESA = "empresa_activa";

export type Rol = "admin" | "bodega" | "vendedor";

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: "Administrador",
  bodega: "Bodega",
  vendedor: "Vendedor",
};

export type EmpresaDelUsuario = {
  id: string;
  nombre: string;
  nit: string | null;
  rol: Rol;
};

export type Perfil = {
  usuario_id: string;
  nombre: string | null;
  correo: string;
  acceso_total: boolean;
  activo: boolean;
};

export type Sesion = {
  perfil: Perfil;
  activa: EmpresaDelUsuario | null;
  todas: EmpresaDelUsuario[];
};

/**
 * Usuario actual, empresas a las que tiene acceso y la empresa activa
 * (guardada en cookie). Con acceso total ve todas como administrador.
 */
export async function sesionActual(): Promise<Sesion> {
  const supabase = await crearClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const usuarioId = claims?.claims.sub;
  if (!usuarioId) redirect("/login");

  const [perfilRes, empresasRes, miembrosRes] = await Promise.all([
    supabase.from("perfiles").select("usuario_id, nombre, correo, acceso_total, activo").eq("usuario_id", usuarioId).single(),
    supabase.from("empresas").select("id, nombre, nit").order("nombre"),
    supabase.from("miembros_empresa").select("empresa_id, rol").eq("usuario_id", usuarioId),
  ]);

  if (perfilRes.error) throw new Error(`No se pudo cargar el perfil: ${perfilRes.error.message}`);
  if (empresasRes.error) throw new Error(`No se pudieron cargar las empresas: ${empresasRes.error.message}`);

  const perfil = perfilRes.data as Perfil;
  const roles = new Map((miembrosRes.data ?? []).map((m) => [m.empresa_id as string, m.rol as Rol]));

  const todas: EmpresaDelUsuario[] = perfil.activo
    ? (empresasRes.data ?? []).flatMap((e) => {
        const rol = perfil.acceso_total ? "admin" : roles.get(e.id);
        return rol ? [{ ...e, rol }] : [];
      })
    : [];

  const elegida = (await cookies()).get(COOKIE_EMPRESA)?.value;
  const activa = todas.find((e) => e.id === elegida) ?? todas[0] ?? null;
  return { perfil, activa, todas };
}

/** Exige uno de los roles indicados en la empresa activa; si no, vuelve al inicio. */
export async function exigirRol(...permitidos: Rol[]): Promise<Sesion & { activa: EmpresaDelUsuario }> {
  const sesion = await sesionActual();
  if (!sesion.activa || !permitidos.includes(sesion.activa.rol)) redirect("/");
  return sesion as Sesion & { activa: EmpresaDelUsuario };
}
