"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { ValorCopiable } from "@/components/copiar";
import { botonExito, botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { pesos } from "@/lib/formato";
import { comprimirImagen as comprimir } from "@/lib/imagenes";
import type { DocumentoLeido } from "@/lib/facturas/foto";
import { verCompra, type ProductoCatalogo, type ResultadoImportacion } from "../importar/acciones";
import { catalogoEmpresa, guardarCompraManual, leerFoto, type CompraManual } from "./acciones";
import { construirPlantilla, leerPlantilla } from "./excel";

/** codigo: el del producto existente elegido en el buscador; vacío = producto nuevo (el sistema le pone código). */
type Linea = { codigo: string; nombre: string; cantidad: string; costo: string; iva: string };

const TIPOS_DOC = [
  { valor: "recibo_caja", texto: "Recibo de caja" },
  { valor: "factura_papel", texto: "Factura de papel" },
  { valor: "factura_electronica", texto: "Factura electrónica (impresa)" },
  { valor: "cuenta_cobro", texto: "Cuenta de cobro" },
  { valor: "remision", texto: "Remisión" },
  { valor: "otro", texto: "Otro" },
];

const campo = "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm";
const numero = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;
/** Número a texto del formulario: `numero()` toma el punto como separador de miles, el decimal va con coma. */
const aCampo = (n: number) => String(n).replace(".", ",");
const lineaVacia = (): Linea => ({ codigo: "", nombre: "", cantidad: "1", costo: "", iva: "0" });

/** Texto para buscar: sin tildes, en minúsculas y sin espacios de más. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Productos que contienen todas las palabras escritas (en el nombre o el código). */
function sugerencias(catalogo: ProductoCatalogo[], texto: string): ProductoCatalogo[] {
  const palabras = normalizar(texto).split(" ").filter(Boolean);
  if (palabras.length === 0) return [];
  return catalogo
    .filter((p) => {
      const donde = normalizar(`${p.nombre} ${p.codigo}`);
      return palabras.every((w) => donde.includes(w));
    })
    .slice(0, 8);
}

/**
 * Campo "Producto" con sugerencias del inventario mientras se escribe.
 * Elegir una sugerencia suma a ese producto; seguir escribiendo crea uno nuevo.
 */
function BuscadorProducto({
  valor,
  catalogo,
  alEscribir,
  alElegir,
}: {
  valor: string;
  catalogo: ProductoCatalogo[];
  alEscribir: (texto: string) => void;
  alElegir: (p: ProductoCatalogo) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [marcada, setMarcada] = useState(0);
  const idLista = useId();
  const lista = abierto ? sugerencias(catalogo, valor) : [];

  function elegir(p: ProductoCatalogo) {
    alElegir(p);
    setAbierto(false);
  }

  return (
    <div className="relative">
      <input
        value={valor}
        onChange={(e) => {
          alEscribir(e.target.value);
          setAbierto(true);
          setMarcada(0);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={(e) => {
          if (lista.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setMarcada((m) => (m + 1) % lista.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setMarcada((m) => (m - 1 + lista.length) % lista.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            elegir(lista[marcada]);
          } else if (e.key === "Escape") {
            setAbierto(false);
          }
        }}
        placeholder="Escriba para buscar en el inventario…"
        className={campo}
        aria-label="Producto"
        autoComplete="off"
        role="combobox"
        aria-expanded={lista.length > 0}
        aria-controls={idLista}
      />
      {lista.length > 0 && (
        <ul id={idLista} role="listbox" className="absolute top-full left-0 z-30 mt-1 max-h-72 w-full min-w-80 overflow-y-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {lista.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === marcada}
              // mousedown en vez de click: así se elige antes de que el campo pierda el foco
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(p);
              }}
              onMouseEnter={() => setMarcada(i)}
              className={`cursor-pointer px-3 py-2 ${i === marcada ? "bg-blue-50" : ""}`}
            >
              <span className="block text-sm text-slate-900">{p.nombre}</span>
              <span className="text-xs text-slate-500">
                <span className="font-mono">{p.codigo}</span> · stock {p.stock}
              </span>
            </li>
          ))}
          <li className="border-t border-slate-100 px-3 pt-2 pb-1 text-xs text-slate-500">
            ¿No está? Siga escribiendo y se creará como producto nuevo.
          </li>
        </ul>
      )}
    </div>
  );
}

export function RegistroFoto({
  empresas,
  empresaInicial,
  catalogoInicial,
}: {
  empresas: { id: string; nombre: string }[];
  empresaInicial: string;
  catalogoInicial: ProductoCatalogo[];
}) {
  const [empresaId, setEmpresaId] = useState(empresaInicial);
  const [catalogo, setCatalogo] = useState(catalogoInicial);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [totalLeido, setTotalLeido] = useState<number | null>(null);

  const [tipoDoc, setTipoDoc] = useState("recibo_caja");
  const [proveedor, setProveedor] = useState("");
  const [nit, setNit] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }));
  const [cufe, setCufe] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia()]);

  const [error, setError] = useState<string>();
  const [procesandoExcel, setProcesandoExcel] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [leyendo, iniciarLectura] = useTransition();
  const [guardando, iniciarGuardado] = useTransition();
  const [abriendo, iniciarApertura] = useTransition();
  const [, iniciarCatalogo] = useTransition();

  const porCodigo = useMemo(() => new Map(catalogo.map((p) => [p.codigo, p])), [catalogo]);
  const porNombre = useMemo(() => new Map(catalogo.map((p) => [normalizar(p.nombre), p])), [catalogo]);
  const empresa = empresas.find((e) => e.id === empresaId)!;

  const filas = lineas.map((l) => {
    const cant = numero(l.cantidad);
    const costo = numero(l.costo);
    const sub = cant * costo;
    return { ...l, cant, costoNum: costo, total: sub * (1 + numero(l.iva) / 100) };
  });
  const total = filas.reduce((s, f) => s + f.total, 0);
  const validas = filas.filter((f) => f.nombre.trim());
  const completo = proveedor.trim() !== "" && validas.length > 0 && validas.every((f) => f.cant > 0 && f.costoNum >= 0);

  function cambiarEmpresa(id: string) {
    setEmpresaId(id);
    iniciarCatalogo(async () => setCatalogo(await catalogoEmpresa(id)));
  }

  async function elegirArchivo(f: File | undefined) {
    if (!f) return;
    const listo = await comprimir(f);
    setArchivo(listo);
    setVistaPrevia(listo.type.startsWith("image/") ? URL.createObjectURL(listo) : null);
  }

  function cargarLectura(d: DocumentoLeido) {
    setTipoDoc(d.tipo_documento);
    setProveedor(d.proveedor_nombre ?? "");
    setNit(d.proveedor_nit ?? "");
    setNumeroDoc(d.numero ?? "");
    if (d.fecha && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) setFecha(d.fecha);
    setCufe(d.cufe ?? "");
    setObservaciones(d.observaciones);
    setTotalLeido(d.total);
    setLineas(
      d.lineas.length
        ? d.lineas.map((l) => {
            const costo = l.precio_incluye_iva && l.iva_porcentaje > 0 ? l.valor_unitario / (1 + l.iva_porcentaje / 100) : l.valor_unitario;
            // Se reconoce el producto por su código o por el mismo nombre; si no, queda nuevo (código automático)
            const existente = (l.codigo && porCodigo.get(l.codigo)) || porNombre.get(normalizar(l.descripcion));
            return {
              codigo: existente ? existente.codigo : "",
              nombre: existente ? existente.nombre : l.descripcion,
              cantidad: aCampo(l.cantidad),
              costo: aCampo(Math.round(costo * 100) / 100),
              iva: String(l.iva_porcentaje),
            };
          })
        : [lineaVacia()],
    );
    setFormularioVisible(true);
  }

  async function descargarPlantilla() {
    setProcesandoExcel(true);
    try {
      const contenido = await construirPlantilla(catalogo);
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(
        new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      enlace.download = `Plantilla compra ${empresa.nombre}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch {
      setError("No se pudo generar la plantilla. Intente de nuevo.");
    } finally {
      setProcesandoExcel(false);
    }
  }

  async function subirExcel(f: File | undefined) {
    if (!f) return;
    setProcesandoExcel(true);
    try {
      const { lineas: leidas, errores } = await leerPlantilla(f);
      if (leidas.length === 0) {
        setError(errores.join(" ") || "El Excel no tiene productos.");
        return;
      }
      setLineas(
        leidas.map((l) => {
          const existente = porNombre.get(normalizar(l.nombre));
          return {
            codigo: existente?.codigo ?? "",
            nombre: existente?.nombre ?? l.nombre,
            cantidad: aCampo(l.cantidad),
            costo: aCampo(l.costo),
            iva: String(l.iva),
          };
        }),
      );
      setObservaciones(errores.length ? `Estas filas del Excel no se cargaron: ${errores.join(" ")}` : "");
      setTotalLeido(null);
      setFormularioVisible(true);
    } catch {
      setError("No se pudo leer el Excel. Verifique que sea la plantilla en formato .xlsx.");
    } finally {
      setProcesandoExcel(false);
    }
  }

  function leer() {
    if (!archivo) return;
    setError(undefined);
    const datos = new FormData();
    datos.set("empresa_id", empresaId);
    datos.set("archivo", archivo);
    iniciarLectura(async () => {
      const r = await leerFoto(datos);
      if (r.error) setError(r.error);
      else if (r.documento) cargarLectura(r.documento);
    });
  }

  function editar(i: number, cambio: Partial<Linea>) {
    setLineas((a) => a.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  }

  /** Al escribir en Producto deja de ser el producto elegido, salvo que el texto sea igual a uno existente. */
  function escribirNombre(i: number, texto: string) {
    editar(i, { nombre: texto, codigo: porNombre.get(normalizar(texto))?.codigo ?? "" });
  }

  function guardar() {
    const datos: CompraManual = {
      tipo_documento: tipoDoc,
      proveedor_nombre: proveedor,
      proveedor_nit: nit,
      numero: numeroDoc,
      fecha,
      cufe,
      lineas: validas.map((f) => ({
        codigo: f.codigo.trim(),
        nombre: f.nombre.trim(),
        cantidad: f.cant,
        costo_unitario: f.costoNum,
        iva_porcentaje: numero(f.iva),
      })),
    };
    const form = new FormData();
    form.set("empresa_id", empresaId);
    form.set("datos", JSON.stringify(datos));
    if (archivo) form.set("archivo", archivo);
    iniciarGuardado(async () => {
      const r = await guardarCompraManual(form);
      setConfirmando(false);
      setResultado(r);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="block text-sm font-medium text-slate-700">
          Cargar a la empresa
          <select
            value={empresaId}
            onChange={(e) => cambiarEmpresa(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold"
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Foto o PDF del documento
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => elegirArchivo(e.target.files?.[0])}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <div className="flex gap-2">
          <button onClick={leer} disabled={!archivo || leyendo} className={`${botonPrimario} py-2.5`}>
            {leyendo ? "Leyendo documento..." : "Leer con IA"}
          </button>
          {!formularioVisible && (
            <button onClick={() => setFormularioVisible(true)} className={`${botonSecundario} py-2.5`}>
              Escribir a mano
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-medium text-slate-700">Cargar los productos desde Excel</p>
          <p className="text-xs text-slate-500">Descargue la plantilla, llénela y súbala. Podrá revisar todo antes de guardar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={descargarPlantilla} disabled={procesandoExcel} className={`${botonSecundario} py-2.5`}>
            Descargar plantilla
          </button>
          <label className={`${botonPrimario} cursor-pointer py-2.5 ${procesandoExcel ? "pointer-events-none opacity-60" : ""}`}>
            {procesandoExcel ? "Procesando..." : "Subir Excel"}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                subirExcel(e.target.files?.[0]);
                e.target.value = ""; // permite subir de nuevo el mismo archivo corregido
              }}
            />
          </label>
        </div>
      </div>

      {formularioVisible && (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-400">Esta compra se cargará a</p>
              <p className="text-xl font-bold">{empresa.nombre}</p>
            </div>

            {observaciones && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                <strong>Revise:</strong> {observaciones}
              </p>
            )}

            <div className="grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Tipo de documento
                <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className={`${campo} mt-1 py-1.5`}>
                  {TIPOS_DOC.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.texto}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Proveedor *
                <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={`${campo} mt-1 py-1.5`} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                NIT / cédula del proveedor
                <input
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                  placeholder="Opcional"
                  className={`${campo} mt-1 py-1.5`}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Número del documento
                <input
                  value={numeroDoc}
                  onChange={(e) => setNumeroDoc(e.target.value)}
                  placeholder="Se genera si no tiene"
                  className={`${campo} mt-1 py-1.5`}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Fecha *
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${campo} mt-1 py-1.5`} />
              </label>
              {cufe && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <ValorCopiable etiqueta="CUFE" valor={cufe} />
                </div>
              )}
            </div>

            {/* En pantallas grandes sin recorte, para que las sugerencias del buscador se vean completas */}
            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200 lg:overflow-visible">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">Cant.</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">Costo u. sin IVA</th>
                    <th className="w-20 px-3 py-2 font-medium">IVA</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {filas.map((f, i) => {
                    const existente = f.codigo ? porCodigo.get(f.codigo) : undefined;
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <BuscadorProducto
                            valor={f.nombre}
                            catalogo={catalogo}
                            alEscribir={(texto) => escribirNombre(i, texto)}
                            alElegir={(p) => editar(i, { codigo: p.codigo, nombre: p.nombre })}
                          />
                          {f.nombre.trim() && (
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                existente ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {existente
                                ? `Existente · ${existente.codigo} · stock ${existente.stock}`
                                : "Nuevo · el código se asigna solo"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={f.cantidad}
                            onChange={(e) => editar(i, { cantidad: e.target.value })}
                            inputMode="decimal"
                            className={`${campo} text-right`}
                            aria-label="Cantidad"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={f.costo}
                            onChange={(e) => editar(i, { costo: e.target.value })}
                            inputMode="decimal"
                            className={`${campo} text-right`}
                            aria-label="Costo unitario"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select value={f.iva} onChange={(e) => editar(i, { iva: e.target.value })} className={campo}>
                            {["0", "5", "19"].map((v) => (
                              <option key={v} value={v}>
                                {v}%
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{pesos(f.total)}</td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => setLineas((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : [lineaVacia()]))}
                            className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50"
                            aria-label="Quitar línea"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                <button onClick={() => setLineas((a) => [...a, lineaVacia()])} className="text-sm font-medium text-blue-700 hover:underline">
                  + Agregar producto
                </button>
                <p className="text-sm">
                  Total <strong className="tabular-nums">{pesos(total)}</strong>
                  {totalLeido !== null && Math.abs(totalLeido - total) > 1 && (
                    <span className="ml-2 text-amber-700">(el documento dice {pesos(totalLeido)})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setConfirmando(true)} disabled={!completo} className={`${botonExito} px-5 py-2.5`}>
                Guardar compra en el inventario
              </button>
            </div>
          </div>

          {vistaPrevia && (
            <div className="self-start rounded-2xl bg-white p-3 ring-1 ring-slate-200 xl:sticky xl:top-16">
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Documento</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
              <img src={vistaPrevia} alt="Documento de compra" className="w-full rounded-lg" />
            </div>
          )}
        </div>
      )}

      <Dialogo
        abierto={Boolean(error)}
        tono="error"
        titulo="No se pudo procesar el archivo"
        alCerrar={() => setError(undefined)}
        acciones={
          <>
            <button
              className={botonSecundario}
              onClick={() => {
                setError(undefined);
                setFormularioVisible(true);
              }}
            >
              Escribir a mano
            </button>
            <button className={botonPrimario} onClick={() => setError(undefined)}>
              Entendido
            </button>
          </>
        }
      >
        <p>{error}</p>
      </Dialogo>

      <Dialogo
        abierto={confirmando}
        titulo="¿Guardar esta compra?"
        alCerrar={guardando ? undefined : () => setConfirmando(false)}
        acciones={
          <>
            <button className={botonSecundario} onClick={() => setConfirmando(false)} disabled={guardando}>
              Cancelar
            </button>
            <button className={botonExito} onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Sí, guardar"}
            </button>
          </>
        }
      >
        <p>
          {proveedor} · {validas.length} producto(s) · <strong>{pesos(total)}</strong>
        </p>
        <p>Se cargará al inventario de:</p>
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-base font-bold text-slate-900">{empresa.nombre}</p>
      </Dialogo>

      <Dialogo
        abierto={resultado !== null}
        tono={resultado?.ok ? "exito" : "error"}
        titulo={resultado?.ok ? "Compra registrada" : "No se pudo registrar la compra"}
        alCerrar={resultado?.ok ? undefined : () => setResultado(null)}
        acciones={
          resultado?.ok ? (
            <>
              <button className={botonSecundario} onClick={() => window.location.reload()}>
                Registrar otra
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
            Documento <strong>{resultado.numero}</strong> registrado en <strong>{resultado.empresa}</strong>.
          </p>
        ) : (
          <p>{resultado?.error}</p>
        )}
      </Dialogo>
    </div>
  );
}
