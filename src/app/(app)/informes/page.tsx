import Link from "next/link";
import type { ReactNode } from "react";
import { exigirRol } from "@/lib/empresa";
import { cantidad, pesos } from "@/lib/formato";
import { construirInforme, PRESETS, resolverPeriodo } from "./datos";
import { BarrasHorizontales, TablaDias, VentasPorDia } from "./graficos";

export default async function PaginaInformes({ searchParams }: PageProps<"/informes">) {
  const { activa, todas } = await exigirRol("admin");
  const p = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  const periodo = resolverPeriodo(texto(p.p), texto(p.desde), texto(p.hasta));
  const administradas = todas.filter((e) => e.rol === "admin");
  const todasLasEmpresas = texto(p.alcance) === "todas" && administradas.length > 1;
  const empresas = todasLasEmpresas
    ? administradas.map((e) => ({ id: e.id, nombre: e.nombre }))
    : [{ id: activa.id, nombre: activa.nombre }];

  const informe = await construirInforme(empresas, periodo);
  const k = informe.kpi;

  const enlace = (cambios: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const base = { p: periodo.clave, desde: periodo.clave === "rango" ? periodo.desde : undefined, hasta: periodo.clave === "rango" ? periodo.hasta : undefined, alcance: todasLasEmpresas ? "todas" : undefined };
    for (const [c, v] of Object.entries({ ...base, ...cambios })) if (v) q.set(c, v);
    return `/informes?${q.toString()}`;
  };

  const variacion = k.ventasAnterior > 0 ? ((k.ventas - k.ventasAnterior) / k.ventasAnterior) * 100 : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Informes</h1>
        <p className="text-sm text-slate-500">
          {todasLasEmpresas ? `Consolidado de ${empresas.length} empresas` : activa.nombre} · {periodo.texto} ({periodo.desde} a{" "}
          {periodo.hasta})
        </p>
      </div>

      {/* Filtros: una sola fila, arriba de todo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
          {PRESETS.map((pr) => (
            <Link
              key={pr.clave}
              href={enlace({ p: pr.clave, desde: undefined, hasta: undefined })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                periodo.clave === pr.clave ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {pr.texto}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-1 rounded-lg bg-white p-1 text-sm ring-1 ring-slate-200">
          <input type="hidden" name="p" value="rango" />
          {todasLasEmpresas && <input type="hidden" name="alcance" value="todas" />}
          <input type="date" name="desde" defaultValue={periodo.desde} aria-label="Desde" className="rounded-md px-2 py-1" />
          <span className="text-slate-400">a</span>
          <input type="date" name="hasta" defaultValue={periodo.hasta} aria-label="Hasta" className="rounded-md px-2 py-1" />
          <button className={`rounded-md px-3 py-1.5 font-medium ${periodo.clave === "rango" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
            Aplicar
          </button>
        </form>
        {administradas.length > 1 && (
          <div className="flex gap-1 rounded-lg bg-white p-1 text-sm ring-1 ring-slate-200">
            <Link
              href={enlace({ alcance: undefined })}
              className={`rounded-md px-3 py-1.5 font-medium ${!todasLasEmpresas ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {activa.nombre}
            </Link>
            <Link
              href={enlace({ alcance: "todas" })}
              className={`rounded-md px-3 py-1.5 font-medium ${todasLasEmpresas ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Todas mis empresas
            </Link>
          </div>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Ventas"
          valor={pesos(k.ventas)}
          detalle={
            variacion === null ? (
              "Sin ventas en el periodo anterior"
            ) : (
              <span>
                <strong className={variacion >= 0 ? "text-green-700" : "text-red-700"}>
                  {variacion >= 0 ? "▲ Sube" : "▼ Baja"} {Math.abs(variacion).toFixed(1)}%
                </strong>{" "}
                vs. periodo anterior ({pesos(k.ventasAnterior)})
              </span>
            )
          }
        />
        <Indicador
          titulo="Utilidad bruta"
          valor={pesos(k.utilidad)}
          detalle={k.margen === null ? "—" : `Margen ${k.margen.toFixed(1)}% sobre ventas sin IVA`}
        />
        <Indicador titulo="Número de ventas" valor={cantidad(k.numeroVentas)} detalle={`Ticket promedio ${pesos(k.ticket)} · ${cantidad(k.unidades)} und.`} />
        <Indicador titulo="Dinero recibido" valor={pesos(k.recaudo)} detalle="Pagos de contado y abonos del periodo" />
        <Indicador titulo="Compras" valor={pesos(k.compras)} detalle={`${k.numeroCompras} factura(s) de proveedores`} />
        <Indicador
          titulo="Inventario al costo"
          valor={pesos(k.inventarioCosto)}
          detalle={`${cantidad(k.unidadesStock)} und. · a precio de venta ${pesos(k.inventarioVenta)}`}
        />
        <Indicador
          titulo="Cartera por cobrar"
          valor={pesos(k.cartera)}
          detalle={
            k.carteraVencida > 0 ? (
              <span className="font-semibold text-red-700">⚠ Vencido {pesos(k.carteraVencida)}</span>
            ) : (
              "Nada vencido"
            )
          }
          enlace="/cartera"
        />
        <Indicador
          titulo="Alertas de inventario"
          valor={`${k.agotados + k.bajoMinimo}`}
          detalle={`${k.agotados} agotado(s) · ${k.bajoMinimo} bajo mínimo`}
          enlace="/productos?filtro=bajo-minimo"
        />
      </div>

      <Tarjeta titulo="Ventas por día" subtitulo="Pase el mouse sobre una barra para ver el detalle del día">
        <VentasPorDia dias={informe.dias} />
        <TablaDias dias={informe.dias} />
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Productos más vendidos" subtitulo="Top 10 por valor vendido">
          <BarrasHorizontales filas={informe.topProductos} />
        </Tarjeta>
        <div className="space-y-6">
          <Tarjeta titulo="Ventas por tipo" subtitulo="Contado, crédito y separado">
            <BarrasHorizontales filas={informe.porTipo} />
          </Tarjeta>
          <Tarjeta titulo="Contado por forma de pago">
            <BarrasHorizontales filas={informe.porFormaPago} />
          </Tarjeta>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {todasLasEmpresas && (
          <Tarjeta titulo="Ventas por empresa">
            <BarrasHorizontales filas={informe.porEmpresa} />
          </Tarjeta>
        )}
        <Tarjeta titulo="Ventas por vendedor">
          <BarrasHorizontales filas={informe.porVendedor} />
        </Tarjeta>
        <Tarjeta titulo="Compras por proveedor" subtitulo="Top 10 del periodo">
          <BarrasHorizontales filas={informe.porProveedor} vacio="No hay compras en el periodo." />
        </Tarjeta>
      </div>

      <h2 className="pt-2 text-lg font-bold text-slate-900">Inventario</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Dinero invertido por categoría" subtitulo="Stock actual al costo promedio">
          <BarrasHorizontales filas={informe.porCategoria} vacio="No hay inventario." />
        </Tarjeta>
        <Tarjeta titulo="Capital quieto" subtitulo="Productos con stock que no se vendieron en el periodo (al costo)">
          <BarrasHorizontales filas={informe.sinMovimiento} vacio="Todo lo que hay en stock tuvo ventas en el periodo." />
        </Tarjeta>
      </div>

      <h2 className="pt-2 text-lg font-bold text-slate-900">Qué falta y qué revisar</h2>
      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta titulo="⚠ Reponer" subtitulo="Agotados o bajo mínimo, ordenados por unidades vendidas en el periodo" alerta>
          <BarrasHorizontales filas={informe.reponer} formato="cantidad" vacio="Nada por reponer." />
        </Tarjeta>
        <Tarjeta titulo="⚠ Precios por revisar" subtitulo="Margen menor al 10% o sin precio de venta" alerta>
          <BarrasHorizontales filas={informe.margenBajo} formato="porcentaje" vacio="Todos los precios tienen buen margen." />
        </Tarjeta>
        <Tarjeta titulo="⚠ Cartera vencida" subtitulo="Saldo vencido por cliente" alerta>
          <BarrasHorizontales filas={informe.carteraVencida} vacio="No hay cartera vencida." />
        </Tarjeta>
      </div>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalle,
  enlace,
}: {
  titulo: string;
  valor: string;
  detalle?: ReactNode;
  enlace?: string;
}) {
  const contenido = (
    <>
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </>
  );
  const clase = "block rounded-2xl bg-white p-5 ring-1 ring-slate-200";
  return enlace ? (
    <Link href={enlace} className={`${clase} transition hover:shadow-md hover:ring-blue-300`}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

function Tarjeta({
  titulo,
  subtitulo,
  alerta,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  alerta?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl bg-white p-5 ring-1 ${alerta ? "ring-amber-200" : "ring-slate-200"}`}>
      <h3 className="font-semibold text-slate-900">{titulo}</h3>
      {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
