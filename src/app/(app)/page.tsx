import Link from "next/link";
import { redirect } from "next/navigation";
import { MODULOS_POR_ROL, NOMBRE_ROL, sesionActual, type Modulo } from "@/lib/empresa";
import { cerrarSesion } from "../login/acciones";
import { CrearEmpresa } from "./crear-empresa";

const TARJETAS: Record<Modulo, { href: string; titulo: string; texto: string; icono: string; color: string }> = {
  ventas: {
    href: "/tablero",
    titulo: "Ventas e inventario",
    texto: "Vender, cartera y abonos, productos y precios, compras, etiquetas QR e informes.",
    icono: "🛒",
    color: "from-blue-600 to-blue-800",
  },
  servicio: {
    href: "/servicio",
    titulo: "Reparaciones y asesorías",
    texto: "Ingreso de equipos, ficha técnica, seguimiento a clientes y visitas de asesoría.",
    icono: "🛠️",
    color: "from-violet-600 to-violet-800",
  },
};

/** Barra mínima de esta pantalla (no tiene menú): usuario y cerrar sesión. */
function Encabezado({ nombre }: { nombre: string }) {
  return (
    <div className="mx-auto flex max-w-4xl items-center justify-between text-sm">
      <span className="text-lg font-bold text-slate-900">CRM VIP</span>
      <form action={cerrarSesion} className="flex items-center gap-3">
        <span className="text-slate-600">{nombre}</span>
        <button className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

/** Primera pantalla: ¿qué vas a hacer hoy? */
export default async function SelectorModulo() {
  const { perfil, activa } = await sesionActual();
  const nombreCompleto = perfil.nombre ?? perfil.correo;

  if (!activa) {
    if (perfil.acceso_total) {
      return (
        <>
          <Encabezado nombre={nombreCompleto} />
          <CrearEmpresa />
        </>
      );
    }
    return (
      <>
        <Encabezado nombre={nombreCompleto} />
        <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Su cuenta aún no tiene acceso</h2>
          <p className="mt-2 text-sm text-slate-500">
            {perfil.activo
              ? `Pida a un administrador que le asigne una empresa usando su correo ${perfil.correo}.`
              : "Su usuario está desactivado. Comuníquese con un administrador."}
          </p>
        </div>
      </>
    );
  }

  const modulos = MODULOS_POR_ROL[activa.rol];
  // Con un solo módulo no hay nada que elegir
  if (modulos.length === 1) redirect(TARJETAS[modulos[0]].href);

  const nombre = nombreCompleto.split(" ")[0];

  return (
    <>
      <Encabezado nombre={nombreCompleto} />
      <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col justify-center py-6">
        <p className="text-sm text-slate-500">
          Hola, {nombre} · {activa.nombre} · {perfil.acceso_total ? "★ Superadmin" : NOMBRE_ROL[activa.rol]}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">¿Qué vas a hacer?</h1>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {modulos.map((m) => {
            const t = TARJETAS[m];
            return (
              <Link
                key={m}
                href={t.href}
                className="group overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl focus-visible:ring-4 focus-visible:ring-blue-600/40 focus-visible:outline-none"
              >
                <div
                  className={`flex h-36 items-center justify-center bg-gradient-to-br ${t.color} text-6xl`}
                  aria-hidden
                >
                  {t.icono}
                </div>
                <div className="p-6">
                  <h2 className="text-xl font-bold text-slate-900">{t.titulo}</h2>
                  <p className="mt-2 text-sm text-slate-600">{t.texto}</p>
                  <p className="mt-4 text-sm font-semibold text-blue-700 group-hover:underline">Entrar →</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
