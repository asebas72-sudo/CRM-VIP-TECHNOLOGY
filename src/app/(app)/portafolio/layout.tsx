import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PORTAFOLIO_ACTIVO } from "@/lib/funciones";

/** Portafolio, piezas para redes e imágenes con IA: apagados por ahora. */
export default function LayoutPortafolio({ children }: { children: ReactNode }) {
  if (!PORTAFOLIO_ACTIVO) redirect("/tablero");
  return children;
}
