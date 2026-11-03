import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { empresasServicio } from "../datos";
import { FormularioIngreso } from "./formulario";

export default async function PaginaIngreso() {
  const empresas = await empresasServicio();
  if (empresas.length === 0) redirect("/");
  const supabase = await crearClienteServidor();
  const { data: marcas } = await supabase.from("marcas").select("nombre").order("nombre");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/servicio" className="text-sm text-violet-700 hover:underline">
          ← Órdenes de servicio
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nuevo ingreso de equipo</h1>
        <p className="text-sm text-slate-500">Registre el equipo que deja el cliente.</p>
      </div>
      <FormularioIngreso
        marcas={(marcas ?? []).map((m) => m.nombre)}
        empresas={empresas.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          valorRevision: e.valorRevision,
          diasEntrega: e.diasEntrega,
          plantilla: e.plantillas.ORDEN_INGRESADO,
        }))}
      />
    </div>
  );
}
