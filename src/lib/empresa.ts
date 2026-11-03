import { cookies } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/server";

export const COOKIE_EMPRESA = "empresa_activa";

export type Rol = "admin" | "bodega" | "vendedor";

export type EmpresaDelUsuario = {
  id: string;
  nombre: string;
  nit: string | null;
  rol: Rol;
};

/** Empresas a las que pertenece el usuario actual, con su rol en cada una. */
export async function misEmpresas(): Promise<EmpresaDelUsuario[]> {
  const supabase = await crearClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const usuarioId = claims?.claims.sub;
  if (!usuarioId) return [];

  const { data, error } = await supabase
    .from("miembros_empresa")
    .select("rol, empresas (id, nombre, nit)")
    .eq("usuario_id", usuarioId)
    .order("creado_en");

  if (error) throw new Error(`No se pudieron cargar las empresas: ${error.message}`);

  return (data ?? []).flatMap((fila) => {
    const empresa = Array.isArray(fila.empresas) ? fila.empresas[0] : fila.empresas;
    return empresa ? [{ ...empresa, rol: fila.rol as Rol }] : [];
  });
}

/** Empresa con la que está trabajando el usuario (guardada en cookie). */
export async function empresaActiva(): Promise<{
  activa: EmpresaDelUsuario | null;
  todas: EmpresaDelUsuario[];
}> {
  const todas = await misEmpresas();
  const elegida = (await cookies()).get(COOKIE_EMPRESA)?.value;
  const activa = todas.find((e) => e.id === elegida) ?? todas[0] ?? null;
  return { activa, todas };
}
