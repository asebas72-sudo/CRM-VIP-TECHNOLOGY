import "server-only";
import { redirect } from "next/navigation";
import { MODULOS_POR_ROL, sesionActual, type Rol } from "@/lib/empresa";
import { plantillasDe, type Plantillas } from "@/lib/servicio";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Tecnico = { usuario_id: string; nombre: string; celular: string | null };

export type EmpresaServicio = {
  id: string;
  nombre: string;
  rol: Rol;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  ciudad: string | null;
  valorRevision: number;
  diasEntrega: number;
  plantillas: Plantillas;
};

/**
 * Empresas en las que el usuario trabaja en reparaciones (admin, vendedor o
 * técnico), con su configuración y sus mensajes de WhatsApp.
 * La primera es la empresa activa si aplica.
 */
export async function empresasServicio(): Promise<EmpresaServicio[]> {
  const { activa, todas } = await sesionActual();
  const propias = todas.filter((e) => MODULOS_POR_ROL[e.rol].includes("servicio"));
  if (propias.length === 0) return [];

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("empresas")
    .select("id, nombre, nit, direccion, telefono, ciudad, valor_revision, dias_entrega_servicio, mensajes_servicio")
    .in("id", propias.map((e) => e.id));
  const porId = new Map((data ?? []).map((e) => [e.id, e]));

  return propias
    .map((e) => {
      const d = porId.get(e.id);
      return {
        id: e.id,
        nombre: e.nombre,
        rol: e.rol,
        nit: d?.nit ?? null,
        direccion: d?.direccion ?? null,
        telefono: d?.telefono ?? null,
        ciudad: d?.ciudad ?? null,
        valorRevision: Number(d?.valor_revision ?? 20000),
        diasEntrega: Number(d?.dias_entrega_servicio ?? 8),
        plantillas: plantillasDe(d?.mensajes_servicio),
      };
    })
    .sort((a, b) => (a.id === activa?.id ? -1 : b.id === activa?.id ? 1 : a.nombre.localeCompare(b.nombre)));
}

export async function tecnicosEmpresa(empresaId: string): Promise<Tecnico[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("tecnicos_empresa", { p_empresa: empresaId });
  return (data ?? []) as Tecnico[];
}

/** Técnicos de varias empresas (para listados consolidados). */
export async function tecnicosDe(empresas: { id: string }[]): Promise<Map<string, Tecnico>> {
  const listas = await Promise.all(empresas.map((e) => tecnicosEmpresa(e.id)));
  return new Map(listas.flat().map((t) => [t.usuario_id, t]));
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

/** Empresas que el usuario administra, con sus ajustes de servicio técnico (pantallas de configuración). */
export async function empresasConfigurables() {
  const empresas = (await empresasServicio()).filter((e) => e.rol === "admin");
  if (empresas.length === 0) redirect("/servicio");
  return empresas.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    valorRevision: e.valorRevision,
    diasEntrega: e.diasEntrega,
    plantillas: e.plantillas,
  }));
}
