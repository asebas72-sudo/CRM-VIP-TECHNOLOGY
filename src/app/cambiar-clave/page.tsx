import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cerrarSesion } from "../login/acciones";
import { FormularioClave } from "./formulario";

export default async function PaginaCambiarClave() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("usuario_id", data.claims.sub)
    .maybeSingle();
  const obligatorio = Boolean(perfil?.debe_cambiar_clave);
  const nombre = (perfil?.nombre ?? perfil?.correo ?? "").split(" ")[0];

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-center text-2xl font-bold text-slate-900">
          {obligatorio ? `¡Bienvenido${nombre ? `, ${nombre}` : ""}!` : "Cambiar contraseña"}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {obligatorio
            ? "Está entrando con una contraseña temporal. Cree su propia contraseña para continuar."
            : "Escriba su nueva contraseña."}
        </p>
        <FormularioClave />
        <div className="mt-4 flex justify-between text-sm">
          {obligatorio ? <span /> : <Link href="/" className="text-blue-700 hover:underline">← Volver</Link>}
          <form action={cerrarSesion}>
            <button className="text-slate-500 hover:text-slate-800">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </main>
  );
}
