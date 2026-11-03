"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { botonExito, botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { cantidad, fecha, pesos } from "@/lib/formato";
import {
  analizarFactura,
  importarCompra,
  verCompra,
  type EdicionLinea,
  type EmpresaResumen,
  type EstadoAnalisis,
  type ResultadoImportacion,
  type VistaPrevia,
} from "./acciones";

const campo =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

type Props = { empresas: EmpresaResumen[]; empresaInicial: string };

/** Envoltura que permite empezar de cero ("Importar otra factura"). */
export function Importador(props: Props) {
  const [intento, setIntento] = useState(0);
  return <FormularioImportacion key={intento} {...props} alReiniciar={() => setIntento((n) => n + 1)} />;
}

function FormularioImportacion({ empresas, empresaInicial, alReiniciar }: Props & { alReiniciar: () => void }) {
  const [estado, analizar, analizando] = useActionState<EstadoAnalisis, FormData>(analizarFactura, {});
  const [, iniciarAnalisis] = useTransition();
  const [empresaId, setEmpresaId] = useState(empresaInicial);
  const [errorCerrado, setErrorCerrado] = useState<EstadoAnalisis | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // onSubmit en vez de action: así React no limpia los archivos elegidos,
  // que se vuelven a enviar al confirmar la importación.
  function leer(empresa: string) {
    const form = formRef.current;
    if (!form) return;
    const datos = new FormData(form);
    datos.set("empresa_id", empresa);
    iniciarAnalisis(() => analizar(datos));
  }

  function cambiarEmpresa(id: string) {
    setEmpresaId(id);
    // Si ya se leyó la factura, se vuelve a analizar contra el inventario de la otra empresa
    if (estado.vista) leer(id);
  }

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          leer(empresaId);
        }}
        className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
      >
        <label className="block text-sm font-medium text-slate-700">
          Cargar a la empresa
          <select
            name="empresa_id"
            value={empresaId}
            onChange={(e) => cambiarEmpresa(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900"
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
                {e.nit ? ` · NIT ${e.nit}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Factura XML (obligatorio)
          <input
            name="xml"
            type="file"
            accept=".xml,text/xml,application/xml"
            required
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          PDF de la factura (opcional)
          <input
            name="pdf"
            type="file"
            accept=".pdf,application/pdf"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5"
          />
        </label>
        <button disabled={analizando} className={`${botonPrimario} py-2.5`}>
          {analizando ? "Leyendo..." : "Leer factura"}
        </button>
      </form>

      <Dialogo
        abierto={Boolean(estado.error) && errorCerrado !== estado}
        tono="error"
        titulo="No se pudo leer la factura"
        alCerrar={() => setErrorCerrado(estado)}
        acciones={
          <button className={botonPrimario} onClick={() => setErrorCerrado(estado)}>
            Entendido
          </button>
        }
      >
        <p>{estado.error}</p>
      </Dialogo>

      {estado.vista && (
        // key: al leer otra factura o cambiar de empresa se reinician las ediciones
        <VistaPreviaCompra
          key={`${estado.vista.empresa.id}-${estado.vista.factura.proveedor.nit}-${estado.vista.factura.numero}`}
          vista={estado.vista}
          formulario={formRef}
          analizando={analizando}
          alReiniciar={alReiniciar}
        />
      )}
    </div>
  );
}

function VistaPreviaCompra({
  vista,
  formulario,
  analizando,
  alReiniciar,
}: {
  vista: VistaPrevia;
  formulario: React.RefObject<HTMLFormElement | null>;
  analizando: boolean;
  alReiniciar: () => void;
}) {
  const { factura, lineas, catalogo, empresa } = vista;
  const porCodigo = useMemo(() => new Map(catalogo.map((p) => [p.codigo, p])), [catalogo]);
  const [ediciones, setEdiciones] = useState<EdicionLinea[]>(() =>
    lineas.map((l) => ({
      codigo: l.codigoSugerido,
      nombre: l.descripcion,
      manejaSerial: l.seriales.length > 0,
    })),
  );
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [importando, iniciar] = useTransition();
  const [abriendo, iniciarApertura] = useTransition();

  const editar = (i: number, cambio: Partial<EdicionLinea>) =>
    setEdiciones((actual) => actual.map((e, j) => (j === i ? { ...e, ...cambio } : e)));

  // Códigos nuevos repetidos dentro de la misma factura se crean una sola vez
  const nuevos = new Set(
    ediciones.filter((e) => e.codigo.trim() && !porCodigo.has(e.codigo.trim())).map((e) => e.codigo.trim()),
  );
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const seriales = lineas.reduce((s, l, i) => s + (ediciones[i].manejaSerial ? l.seriales.length : 0), 0);
  const sinCodigo = ediciones.some((e) => !e.codigo.trim());

  function importar() {
    const form = formulario.current;
    if (!form) return;
    const datos = new FormData(form);
    datos.set("empresa_id", empresa.id);
    datos.set("ediciones", JSON.stringify(ediciones));
    iniciar(async () => {
      const r = await importarCompra(datos);
      setConfirmando(false);
      setResultado(r);
    });
  }

  return (
    <div className={`space-y-4 ${analizando ? "pointer-events-none opacity-60" : ""}`}>
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white">
        <p className="text-xs uppercase tracking-wide text-slate-400">Esta compra se cargará a</p>
        <p className="text-xl font-bold">{empresa.nombre}</p>
        {empresa.nit && <p className="text-sm text-slate-400">NIT {empresa.nit}</p>}
      </div>

      <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-4">
        <Dato
          titulo="Proveedor"
          valor={factura.proveedor.nombre}
          detalle={`NIT ${factura.proveedor.nit}${vista.proveedorNuevo ? " · nuevo" : ""}`}
        />
        <Dato titulo="Factura" valor={factura.numero} detalle={fecha(factura.fecha)} />
        <Dato titulo="Unidades" valor={cantidad(unidades)} detalle={`${lineas.length} líneas · ${seriales} seriales`} />
        <Dato
          titulo="Total"
          valor={pesos(factura.total)}
          detalle={`Subtotal ${pesos(factura.subtotal)} + IVA ${pesos(factura.iva)}`}
        />
      </div>

      {vista.duplicada && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Esta factura ya fue importada en {empresa.nombre}. No se puede cargar dos veces.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">En la factura</th>
              <th className="px-3 py-2 text-right font-medium">Cant.</th>
              <th className="px-3 py-2 text-right font-medium">Costo u. (sin IVA)</th>
              <th className="w-[38%] px-3 py-2 font-medium">Producto en inventario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {lineas.map((l, i) => {
              const ed = ediciones[i];
              const existente = porCodigo.get(ed.codigo.trim());
              return (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <p className="text-slate-900">{l.descripcion}</p>
                    <p className="text-xs text-slate-500">
                      Cód. proveedor {l.codigoProveedor || "—"} · IVA {l.ivaPorcentaje}%
                      {l.seriales.length > 0 && ` · ${l.seriales.length} serial(es)`}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{cantidad(l.cantidad)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesos(l.costoUnitario)}</td>
                  <td className="space-y-1.5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={ed.codigo}
                        onChange={(e) => editar(i, { codigo: e.target.value })}
                        list="catalogo-productos"
                        className={`${campo} font-mono`}
                        aria-label="Código del producto"
                      />
                      {existente ? (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Existente
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          Nuevo
                        </span>
                      )}
                    </div>
                    {existente ? (
                      <p className="text-xs text-slate-600">
                        {existente.nombre} · stock actual {cantidad(existente.stock)}
                        {l.origen === "proveedor" && " · reconocido por el código del proveedor"}
                      </p>
                    ) : (
                      <>
                        <input
                          value={ed.nombre}
                          onChange={(e) => editar(i, { nombre: e.target.value })}
                          className={campo}
                          aria-label="Nombre del producto nuevo"
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={ed.manejaSerial}
                            onChange={(e) => editar(i, { manejaSerial: e.target.checked })}
                          />
                          Maneja serial (se pide al vender)
                        </label>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="catalogo-productos">
          {catalogo.map((p) => (
            <option key={p.id} value={p.codigo}>
              {p.nombre}
            </option>
          ))}
        </datalist>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">
          Se crearán <strong>{nuevos.size}</strong> producto(s) nuevo(s) con precio sugerido (costo + IVA + margen).
          Escriba el código de un producto existente para sumarle el stock.
        </p>
        <button
          onClick={() => setConfirmando(true)}
          disabled={vista.duplicada || sinCodigo}
          className={`${botonExito} px-5 py-2.5`}
        >
          Importar compra al inventario
        </button>
      </div>

      {/* Confirmación antes de importar */}
      <Dialogo
        abierto={confirmando}
        tono="info"
        titulo="¿Confirmar importación?"
        alCerrar={importando ? undefined : () => setConfirmando(false)}
        acciones={
          <>
            <button className={botonSecundario} onClick={() => setConfirmando(false)} disabled={importando}>
              Cancelar
            </button>
            <button className={botonExito} onClick={importar} disabled={importando}>
              {importando ? "Importando..." : "Sí, importar"}
            </button>
          </>
        }
      >
        <p>
          Factura <strong>{factura.numero}</strong> de {factura.proveedor.nombre} por{" "}
          <strong>{pesos(factura.total)}</strong>.
        </p>
        <p>
          Se cargarán {cantidad(unidades)} unidades ({nuevos.size} producto(s) nuevo(s)) al inventario de:
        </p>
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-base font-bold text-slate-900">{empresa.nombre}</p>
      </Dialogo>

      {/* Resultado */}
      <Dialogo
        abierto={resultado !== null}
        tono={resultado?.ok ? "exito" : "error"}
        titulo={resultado?.ok ? "Compra importada correctamente" : "No se pudo importar la compra"}
        alCerrar={resultado?.ok ? undefined : () => setResultado(null)}
        acciones={
          resultado?.ok ? (
            <>
              <button className={botonSecundario} onClick={alReiniciar}>
                Importar otra factura
              </button>
              <button
                className={botonPrimario}
                disabled={abriendo}
                onClick={() => iniciarApertura(() => verCompra(resultado.empresaId, resultado.compraId))}
              >
                {abriendo ? "Abriendo..." : "Ver compra"}
              </button>
            </>
          ) : (
            <button className={botonPrimario} onClick={() => setResultado(null)}>
              Entendido
            </button>
          )
        }
      >
        {resultado?.ok ? (
          <p>
            La factura <strong>{resultado.numero}</strong> quedó registrada en <strong>{resultado.empresa}</strong> y
            sus {cantidad(unidades)} unidades ya están en el inventario.
          </p>
        ) : (
          <p>{resultado?.error}</p>
        )}
      </Dialogo>
    </div>
  );
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="truncate font-semibold text-slate-900">{valor}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}
