import Link from "next/link";
import { Marco } from "@/components/marco";
import { MenuLateral } from "@/components/menu-lateral";
import { SelectorEmpresa } from "@/components/selector-empresa";
import { MODULOS_POR_ROL, NOMBRE_ROL, sesionActual } from "@/lib/empresa";
import { cerrarSesion } from "../login/acciones";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { perfil, activa, todas } = await sesionActual();

  const menu = (
    <aside className="flex flex-col gap-4 bg-slate-900 p-4 text-slate-100 md:w-60 print:hidden">
      <Link href="/" className="text-lg font-bold">
        CRM VIP
      </Link>

      {activa && <MenuLateral rol={activa.rol} modulos={MODULOS_POR_ROL[activa.rol]} accesoTotal={perfil.acceso_total} />}

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
  );

  const barra = activa ? (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur md:px-8 print:hidden">
      <SelectorEmpresa empresas={todas.map((e) => ({ id: e.id, nombre: e.nombre }))} activa={activa.id} />
      <span className="hidden text-xs text-slate-500 sm:block">{NOMBRE_ROL[activa.rol]} en esta empresa</span>
    </header>
  ) : null;

  return (
    <Marco menu={menu} barra={barra}>
      {children}
    </Marco>
  );
}
