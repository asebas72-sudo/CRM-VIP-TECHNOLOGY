import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientePublico } from "@/lib/supabase/publico";
import { urlImagenPortafolio, type PortafolioPublico } from "@/lib/portafolio";
import { VistaCatalogo } from "./vista";

// Siempre con precios y disponibilidad al día
export const dynamic = "force-dynamic";

async function cargar(slug: string): Promise<PortafolioPublico | null> {
  // Sin sesión: la función de la base solo entrega los datos públicos
  const supabase = clientePublico();
  const { data, error } = await supabase.rpc("portafolio_publico", { p_slug: slug });
  if (error) throw new Error(error.message);
  return (data as PortafolioPublico | null) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/catalogo/[slug]">): Promise<Metadata> {
  const p = await cargar((await params).slug);
  if (!p) return { title: "Portafolio no disponible" };
  const titulo = `${p.empresa} · Portafolio`;
  const descripcion = p.mensaje ?? p.titulo ?? `Productos y servicios de ${p.empresa}`;
  const logo = urlImagenPortafolio(p.logo_path);
  return { title: titulo, description: descripcion, openGraph: { title: titulo, description: descripcion, images: logo ? [logo] : undefined } };
}

/** Portafolio público de una empresa: no requiere iniciar sesión. */
export default async function PaginaCatalogo({ params }: PageProps<"/catalogo/[slug]">) {
  const portafolio = await cargar((await params).slug);
  if (!portafolio) notFound();
  return <VistaCatalogo p={portafolio} />;
}
