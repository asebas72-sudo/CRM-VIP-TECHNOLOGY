import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PORTAFOLIO_ACTIVO } from "@/lib/funciones";

/** El catálogo público es parte del portafolio: apagado por ahora. */
export default function LayoutCatalogo({ children }: { children: ReactNode }) {
  if (!PORTAFOLIO_ACTIVO) notFound();
  return children;
}
