import Link from "next/link";
import { MenuLateral } from "@/components/menu-lateral";
import { SelectorEmpresa } from "@/components/selector-empresa";
import { MODULOS_POR_ROL, NOMBRE_ROL, sesionActual } from "@/lib/empresa";
import { cerrarSesion } from "../login/acciones";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { perfil, activa, todas } = await sesionActual();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row print:block print:bg-white">
      <aside className="flex flex-col gap-4 bg-slate-900 p-4 text-slate-100 md:w-60 print:hidden">
        <Link href="/" className="text-lg font-bold">
          CRM VIP
        </Link>

        {activa && (
          <MenuLateral rol={activa.rol} modulos={MODULOS_POR_ROL[activa.rol]} accesoTotal={perfil.acceso_total} />
        )}

        <div className="text-sm md:mt-auto">
          <p className="truncate text-slate-300">{perfil.nombre ?? perfil.correo}</p>
          <p className="text-xs text-slate-500">
            {perfil.acceso_total ? "Acceso total" : activa ? NOMBRE_ROL[activa.rol] : "Sin acceso"}
          </p>
          <form action={cerrarSesion} className="mt-2">
            <button className="text-slate-400 hover:text-white">Cerrar sesión</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {activa && (
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur md:px-8 print:hidden">
            <SelectorEmpresa empresas={todas.map((e) => ({ id: e.id, nombre: e.nombre }))} activa={activa.id} />
            <span className="hidden text-xs text-slate-500 sm:block">
              {NOMBRE_ROL[activa.rol]} en esta empresa
            </span>
          </header>
        )}
        <main className="p-4 md:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
