import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Tecnico = { usuario_id: string; nombre: string; celular: string | null };

export async function tecnicosEmpresa(empresaId: string): Promise<Tecnico[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("tecnicos_empresa", { p_empresa: empresaId });
  return (data ?? []) as Tecnico[];
}

export async function nombresUsuarios(empresaId: string): Promise<Map<string, string>> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("nombres_usuarios_empresa", { p_empresa: empresaId });
  return new Map(((data ?? []) as { usuario_id: string; nombre: string }[]).map((u) => [u.usuario_id, u.nombre]));
}

/** URLs firmadas (10 min) para mostrar fotos y firmas del bucket privado. */
export async function urlsFirmadas(rutas: (string | null | undefined)[]): Promise<Map<string, string>> {
  const validas = rutas.filter((r): r is string => Boolean(r));
  if (validas.length === 0) return new Map();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.storage.from("servicio").createSignedUrls(validas, 600);
  const pares: [string, string][] = [];
  for (const d of data ?? []) if (d.path && d.signedUrl) pares.push([d.path, d.signedUrl]);
  return new Map(pares);
}

export async function datosEmpresa(empresaId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("empresas")
    .select("nombre, nit, direccion, telefono, ciudad, valor_revision, dias_entrega_servicio")
    .eq("id", empresaId)
    .single();
  return data!;
}
