import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { datosEmpresa } from "../datos";
import { FormularioIngreso } from "./formulario";

export default async function PaginaIngreso() {
  const { activa } = await exigirRol("admin", "vendedor", "tecnico");
  const supabase = await crearClienteServidor();
  const [{ data: marcas }, empresa] = await Promise.all([
    supabase.from("marcas").select("nombre").order("nombre"),
    datosEmpresa(activa.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/servicio" className="text-sm text-violet-700 hover:underline">
          ← Órdenes de servicio
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nuevo ingreso de equipo</h1>
        <p className="text-sm text-slate-500">
          Registre el equipo que deja el cliente en <strong>{activa.nombre}</strong>. Entrega estimada en{" "}
          {empresa.dias_entrega_servicio} días.
        </p>
      </div>
      <FormularioIngreso
        marcas={(marcas ?? []).map((m) => m.nombre)}
        empresa={empresa.nombre}
        valorRevision={Number(empresa.valor_revision)}
      />
    </div>
  );
}
