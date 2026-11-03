import Link from "next/link";
import { NOMBRE_ROL, sesionActual, type Rol } from "@/lib/empresa";
import { cerrarSesion } from "../login/acciones";
import { cambiarEmpresa } from "./acciones";

const MENU: { href: string; texto: string; roles: Rol[] }[] = [
  { href: "/", texto: "Inicio", roles: ["admin", "bodega", "vendedor"] },
  { href: "/ventas", texto: "Vender", roles: ["admin", "vendedor"] },
  { href: "/productos", texto: "Productos", roles: ["admin", "bodega", "vendedor"] },
  { href: "/compras", texto: "Compras", roles: ["admin", "bodega"] },
  { href: "/etiquetas", texto: "Etiquetas QR", roles: ["admin", "bodega"] },
  { href: "/usuarios", texto: "Usuarios", roles: ["admin"] },
  { href: "/configuracion", texto: "Configuración", roles: ["admin"] },
];

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { perfil, activa, todas } = await sesionActual();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row print:block print:bg-white">
      <aside className="flex flex-col gap-4 bg-slate-900 p-4 text-slate-100 md:w-60 print:hidden">
        <div>
          <p className="text-lg font-bold">CRM VIP</p>
          {activa && todas.length > 1 ? (
            <form action={cambiarEmpresa} className="mt-2">
              <select
                name="empresa_id"
                defaultValue={activa.id}
                className="w-full rounded bg-slate-800 px-2 py-1 text-sm"
              >
                {todas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              <button className="mt-1 text-xs text-slate-400 hover:text-white">Cambiar empresa</button>
            </form>
          ) : (
            <p className="text-sm text-slate-400">{activa?.nombre ?? "Sin empresa"}</p>
          )}
        </div>

        {activa && (
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {MENU.filter((item) => item.roles.includes(activa.rol)).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-slate-800"
              >
                {item.texto}
              </Link>
            ))}
            {perfil.acceso_total && (
              <Link href="/empresas" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-slate-800">
                Empresas
              </Link>
            )}
          </nav>
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

      <main className="min-w-0 flex-1 p-4 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
