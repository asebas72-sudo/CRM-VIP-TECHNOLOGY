import Link from "next/link";
import type { ReactNode } from "react";
import { exigirRol } from "@/lib/empresa";
import { cantidad, pesos } from "@/lib/formato";
import { construirInforme, PRESETS, resolverPeriodo, type Informe, type Kpi } from "./datos";
import { BarrasHorizontales, TablaDias, VentasPorDia } from "./graficos";

export default async function PaginaInformes({ searchParams }: PageProps<"/informes">) {
  const { activa, todas } = await exigirRol("admin");
  const p = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  const periodo = resolverPeriodo(texto(p.p), texto(p.desde), texto(p.hasta));
  // Empresas que administra; por defecto el consolidado de todas, o una sola con el filtro
  const disponibles = todas.filter((e) => e.rol === "admin").map((e) => ({ id: e.id, nombre: e.nombre }));
  if (disponibles.length === 0) disponibles.push({ id: activa.id, nombre: activa.nombre });
  const elegida = disponibles.find((e) => e.id === texto(p.e));
  const empresas = elegida ? [elegida] : disponibles;
  const todasLasEmpresas = empresas.length > 1;

  const informe = await construirInforme(empresas, periodo);
  const k = informe.kpi;

  const enlace = (cambios: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const base = { e: elegida?.id, p: periodo.clave, desde: periodo.clave === "rango" ? periodo.desde : undefined, hasta: periodo.clave === "rango" ? periodo.hasta : undefined };
    for (const [c, v] of Object.entries({ ...base, ...cambios })) if (v) q.set(c, v);
    return `/informes?${q.toString()}`;
  };

  const variacion = k.ventasAnterior > 0 ? ((k.ventas - k.ventasAnterior) / k.ventasAnterior) * 100 : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Informes</h1>
        <p className="text-sm text-slate-500">
          {todasLasEmpresas ? `Consolidado de ${empresas.map((e) => e.nombre).join(" + ")}` : empresas[0].nombre} · {periodo.texto} ({periodo.desde} a{" "}
          {periodo.hasta})
        </p>
      </div>

      {/* Filtros: una sola fila, arriba de todo */}
      <div className="flex flex-wrap items-center gap-2">
        {disponibles.length > 1 && (
          <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200" aria-label="Empresa">
            {[{ id: undefined, nombre: "Todas las empresas" }, ...disponibles].map((em) => (
              <Link
                key={em.id ?? "todas"}
                href={enlace({ e: em.id })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  elegida?.id === em.id ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {em.nombre}
              </Link>
            ))}
          </div>
        )}
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
          {elegida && <input type="hidden" name="e" value={elegida.id} />}
          <input type="date" name="desde" defaultValue={periodo.desde} aria-label="Desde" className="rounded-md px-2 py-1" />
          <span className="text-slate-400">a</span>
          <input type="date" name="hasta" defaultValue={periodo.hasta} aria-label="Hasta" className="rounded-md px-2 py-1" />
          <button className={`rounded-md px-3 py-1.5 font-medium ${periodo.clave === "rango" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
            Aplicar
          </button>
        </form>
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
        <Indicador
          titulo="Utilidad neta"
          valor={pesos(k.utilidadNeta)}
          detalle={`Utilidad bruta − gastos ${pesos(k.gastos)} (las inversiones no restan)`}
          enlace="/gastos"
        />
        <Indicador titulo="Número de ventas" valor={cantidad(k.numeroVentas)} detalle={`Ticket promedio ${pesos(k.ticket)} · ${cantidad(k.unidades)} und.`} />
        <Indicador titulo="Dinero recibido" valor={pesos(k.recaudo)} detalle="Pagos de contado y abonos del periodo" />
        <Indicador
          titulo="Compras"
          valor={pesos(k.compras)}
          detalle={
            k.comprasInversion > 0
              ? `${k.numeroCompras} factura(s) · aparte, inversión inicial ${pesos(k.comprasInversion)} (${k.numeroComprasInversion})`
              : `${k.numeroCompras} factura(s) de proveedores`
          }
        />
        <Indicador titulo="Gastos e inversiones" valor={pesos(k.gastos + k.inversiones)} detalle={`Gastos ${pesos(k.gastos)} · inversiones ${pesos(k.inversiones)}`} enlace="/gastos" />
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

      <CuadreCaja informe={informe} cartera={k.cartera} />

      <VentasPorFormaPago filas={informe.recibidoPorForma} />

      {todasLasEmpresas && <ResumenPorEmpresa filas={informe.porEmpresaKpi} total={k} />}

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
        <Tarjeta titulo="Gastos e inversiones por categoría" subtitulo="Registrados en Gastos e inversiones">
          <BarrasHorizontales filas={informe.porCategoriaGasto} vacio="No hay gastos ni inversiones en el periodo." />
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

function variacionTexto(actual: number, anterior: number): ReactNode {
  if (anterior <= 0) return <span className="text-slate-400">—</span>;
  const v = ((actual - anterior) / anterior) * 100;
  return (
    <span className={v >= 0 ? "text-green-700" : "text-red-700"}>
      {v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(0)}%
    </span>
  );
}

/** Los indicadores principales de cada empresa y el total consolidado. */
function ResumenPorEmpresa({ filas, total }: { filas: (Kpi & { empresaId: string; nombre: string })[]; total: Kpi }) {
  const columnas: { titulo: string; valor: (k: Kpi) => ReactNode; ayuda?: string }[] = [
    { titulo: "Ventas", valor: (k) => pesos(k.ventas) },
    {
      titulo: "% del total",
      valor: (k) => (total.ventas > 0 ? `${((k.ventas / total.ventas) * 100).toFixed(1)}%` : "—"),
    },
    { titulo: "vs. anterior", valor: (k) => variacionTexto(k.ventas, k.ventasAnterior) },
    { titulo: "Utilidad", valor: (k) => pesos(k.utilidad) },
    { titulo: "Margen", valor: (k) => (k.margen === null ? "—" : `${k.margen.toFixed(1)}%`) },
    { titulo: "No. ventas", valor: (k) => cantidad(k.numeroVentas) },
    { titulo: "Ticket prom.", valor: (k) => pesos(k.ticket) },
    { titulo: "Recibido", valor: (k) => pesos(k.recaudo) },
    {
      titulo: "Compras",
      valor: (k) => (
        <>
          {pesos(k.compras)}
          {k.comprasInversion > 0 && <span className="block text-xs text-violet-700">+ inversión {pesos(k.comprasInversion)}</span>}
        </>
      ),
    },
    { titulo: "Gastos", valor: (k) => pesos(k.gastos) },
    { titulo: "Inversiones", valor: (k) => pesos(k.inversiones) },
    { titulo: "Utilidad neta", valor: (k) => pesos(k.utilidadNeta) },
    { titulo: "Inventario al costo", valor: (k) => pesos(k.inventarioCosto) },
    {
      titulo: "Cartera",
      valor: (k) => (
        <>
          {pesos(k.cartera)}
          {k.carteraVencida > 0 && <span className="block text-xs text-red-700">⚠ vencido {pesos(k.carteraVencida)}</span>}
        </>
      ),
    },
    { titulo: "Alertas", valor: (k) => `${k.agotados + k.bajoMinimo}` },
  ];

  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="px-5 pt-4">
        <h3 className="font-semibold text-slate-900">Resultados por empresa</h3>
        <p className="text-xs text-slate-500">Los mismos indicadores de arriba, empresa por empresa, con el total consolidado.</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1400px] text-right text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Empresa</th>
              {columnas.map((c) => (
                <th key={c.titulo} className="px-3 py-2 font-medium whitespace-nowrap">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {filas.map((f) => (
              <tr key={f.empresaId} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-left font-semibold text-slate-900">{f.nombre}</td>
                {columnas.map((c) => (
                  <td key={c.titulo} className="px-3 py-2 whitespace-nowrap">
                    {c.valor(f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900 tabular-nums">
            <tr>
              <td className="px-4 py-2 text-left">Total</td>
              {columnas.map((c) => (
                <td key={c.titulo} className="px-3 py-2 whitespace-nowrap">
                  {c.valor(total)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

const fechaCorta = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Cruce de caja: lo que entró por ventas contra lo que se gastó en compras. */
function CuadreCaja({ informe, cartera }: { informe: Informe; cartera: number }) {
  const recibido = informe.cuadre.reduce((s, d) => s + d.recibido, 0);
  const compras = informe.cuadre.reduce((s, d) => s + d.compras, 0);
  const gastos = informe.cuadre.reduce((s, d) => s + d.gastos, 0);
  const inversiones = informe.cuadre.reduce((s, d) => s + d.inversiones, 0);
  const inversionInicial = informe.cuadre.reduce((s, d) => s + d.inversionInicial, 0);
  const salio = (d: { compras: number; gastos: number; inversiones: number }) => d.compras + d.gastos + d.inversiones;
  const diferencia = recibido - compras - gastos - inversiones;
  const dias = informe.cuadre.filter((d) => d.recibido > 0 || salio(d) > 0 || d.inversionInicial > 0).reverse();

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h3 className="font-semibold text-slate-900">Cuadre: lo que entró contra lo que salió</h3>
      <p className="text-xs text-slate-500">
        Entró = dinero recibido por ventas de contado y abonos. Salió = compras de mercancía + gastos + inversiones del periodo.
        Las compras marcadas como inversión inicial van aparte. «Por cobrar» es lo que aún deben de las ventas a crédito y
        separados: no está en «Entró» hasta que lo paguen.
      </p>

      {inversionInicial > 0 && (
        <div className="mt-4 rounded-xl bg-violet-50 p-4 ring-1 ring-violet-200">
          <p className="text-sm text-violet-800">Inversión inicial en mercancía (capital de los socios)</p>
          <p className="text-2xl font-bold text-violet-900 tabular-nums">{pesos(inversionInicial)}</p>
          <p className="text-xs text-violet-700">No se resta de lo que entró por ventas: esa plata no salió de la caja del negocio.</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <div className="rounded-xl bg-green-50 p-4 ring-1 ring-green-200">
          <p className="text-sm text-green-800">Entró por ventas</p>
          <p className="text-2xl font-bold text-green-900 tabular-nums">{pesos(recibido)}</p>
        </div>
        <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
          <p className="text-sm text-red-800">Compras</p>
          <p className="text-2xl font-bold text-red-900 tabular-nums">{pesos(compras)}</p>
        </div>
        <div className="rounded-xl bg-orange-50 p-4 ring-1 ring-orange-200">
          <p className="text-sm text-orange-800">Gastos</p>
          <p className="text-2xl font-bold text-orange-900 tabular-nums">{pesos(gastos)}</p>
        </div>
        <div className="rounded-xl bg-violet-50 p-4 ring-1 ring-violet-200">
          <p className="text-sm text-violet-800">Inversiones</p>
          <p className="text-2xl font-bold text-violet-900 tabular-nums">{pesos(inversiones)}</p>
        </div>
        <div className="rounded-xl bg-sky-50 p-4 ring-1 ring-sky-200">
          <p className="text-sm text-sky-800">Por cobrar (crédito y separados)</p>
          <p className="text-2xl font-bold text-sky-900 tabular-nums">{pesos(informe.porCobrar.pendiente)}</p>
          <p className="text-xs text-sky-700">
            {informe.porCobrar.ventas} venta(s) del periodo por {pesos(informe.porCobrar.valor)} · cartera total {pesos(cartera)}
          </p>
        </div>
        <div className={`rounded-xl p-4 ring-1 ${diferencia >= 0 ? "bg-slate-900 ring-slate-900" : "bg-amber-50 ring-amber-300"}`}>
          <p className={`text-sm ${diferencia >= 0 ? "text-slate-300" : "text-amber-800"}`}>Quedó (entró − salió)</p>
          <p className={`text-2xl font-bold tabular-nums ${diferencia >= 0 ? "text-white" : "text-amber-900"}`}>{pesos(diferencia)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-700">Día a día</h4>
          {dias.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No hubo ventas ni compras en el periodo.</p>
          ) : (
            <div className="mt-2 max-h-80 overflow-auto rounded-lg ring-1 ring-slate-200">
              <table className="w-full text-right text-sm tabular-nums">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Día</th>
                    <th className="px-3 py-2 font-medium">Entró</th>
                    <th className="px-3 py-2 font-medium">Compras</th>
                    <th className="px-3 py-2 font-medium">Gastos</th>
                    <th className="px-3 py-2 font-medium">Invers.</th>
                    <th className="px-3 py-2 font-medium">Quedó</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dias.map((d) => (
                    <tr key={d.dia}>
                      <td className="px-3 py-1.5 text-left capitalize text-slate-700">{fechaCorta(d.dia)}</td>
                      <td className="px-3 py-1.5 text-green-700">{pesos(d.recibido)}</td>
                      <td className="px-3 py-1.5 text-red-700">{d.compras ? pesos(d.compras) : "—"}</td>
                      <td className="px-3 py-1.5 text-orange-700">{d.gastos ? pesos(d.gastos) : "—"}</td>
                      <td className="px-3 py-1.5 text-violet-700">
                        {d.inversiones ? pesos(d.inversiones) : "—"}
                        {d.inversionInicial > 0 && (
                          <span className="block text-xs text-violet-500">inicial {pesos(d.inversionInicial)}</span>
                        )}
                      </td>
                      <td className={`px-3 py-1.5 font-semibold ${d.recibido - salio(d) < 0 ? "text-amber-700" : "text-slate-900"}`}>
                        {pesos(d.recibido - salio(d))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-700">Qué se compró</h4>
          {informe.comprasDetalle.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No hay compras en el periodo.</p>
          ) : (
            <div className="mt-2 max-h-80 overflow-auto rounded-lg ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">Proveedor</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {informe.comprasDetalle.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 whitespace-nowrap capitalize text-slate-600">{fechaCorta(c.fecha)}</td>
                      <td className="px-3 py-1.5">
                        <Link href={`/compras/${c.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                          {c.proveedor}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          N.º {c.numero}
                          {c.empresa && ` · ${c.empresa}`}
                          {c.esInversion && <span className="ml-1 font-semibold text-violet-700">· Inversión inicial</span>}
                        </span>
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${c.esInversion ? "text-violet-700" : "text-red-700"}`}>
                        {pesos(c.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Dinero recibido discriminado por forma de pago. */
function VentasPorFormaPago({ filas }: { filas: Informe["recibidoPorForma"] }) {
  const total = filas.reduce((s, f) => s + f.valor, 0);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h3 className="font-semibold text-slate-900">Ventas por forma de pago</h3>
      <p className="text-xs text-slate-500">
        Dinero recibido en el periodo (contado y abonos de crédito o separado), según cómo pagó el cliente.
      </p>
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No hubo pagos en el periodo.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filas.map((f) => (
            <div key={f.forma} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-sm font-medium text-slate-600">{f.forma}</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{pesos(f.valor)}</p>
              <p className="text-xs text-slate-500">
                {f.pagos} pago(s) · {pct(f.valor).toFixed(1)}%
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${pct(f.valor)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
