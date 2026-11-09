/** Dirección pública de una imagen del portafolio. */
export function urlImagenPortafolio(path: string | null | undefined): string | null {
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portafolio/${path}` : null;
}

export type ItemPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  foto_path: string | null;
  etiqueta: "oferta" | "nuevo" | null;
  categoria: string | null;
  es_servicio: boolean;
  precio: number | null;
  disponibilidad: "disponible" | "pocas" | "por_pedido";
};

export type PortafolioPublico = {
  empresa: string;
  titulo: string | null;
  mensaje: string | null;
  whatsapp: string | null;
  correo: string | null;
  direccion: string | null;
  facebook: string | null;
  instagram: string | null;
  color: string;
  logo_path: string | null;
  items: ItemPublico[];
};
