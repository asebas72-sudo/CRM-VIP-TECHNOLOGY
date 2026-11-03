import Link from "next/link";
import { empresaActiva } from "@/lib/empresa";
import { cerrarSesion } from "../login/acciones";
import { cambiarEmpresa } from "./acciones";

const MENU = [
  { href: "/", texto: "Inicio" },
  { href: "/ventas", texto: "Vender" },
  { href: "/productos", texto: "Productos" },
  { href: "/compras", texto: "Compras" },
  { href: "/etiquetas", texto: "Etiquetas QR" },
  { href: "/configuracion", texto: "Configuración" },
];

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { activa, todas } = await empresaActiva();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row">
      <aside className="flex flex-col gap-4 bg-slate-900 p-4 text-slate-100 md:w-60">
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
            {MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-slate-800"
              >
                {item.texto}
              </Link>
            ))}
          </nav>
        )}

        <form action={cerrarSesion} className="md:mt-auto">
          <button className="text-sm text-slate-400 hover:text-white">Cerrar sesión</button>
        </form>
      </aside>

      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
