"use client";

import { useMemo, useState, useTransition } from "react";
import { ValorCopiable } from "@/components/copiar";
import { botonExito, botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { pesos } from "@/lib/formato";
import type { DocumentoLeido } from "@/lib/facturas/foto";
import { verCompra, type ProductoCatalogo, type ResultadoImportacion } from "../importar/acciones";
import { catalogoEmpresa, guardarCompraManual, leerFoto, type CompraManual } from "./acciones";

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
const lineaVacia = (): Linea => ({ codigo: "", nombre: "", cantidad: "1", costo: "", iva: "0" });

function codigoDesde(texto: string): string {
  const base = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((p) => p.slice(0, 4))
    .join("-");
  return base ? `P-${base}` : "";
}

/** Reduce fotos del celular (varios MB) a JPEG de máx. 2000 px antes de enviarlas. */
async function comprimir(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/gif") return archivo;
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 2000 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
  return blob ? new File([blob], archivo.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : archivo;
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
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [leyendo, iniciarLectura] = useTransition();
  const [guardando, iniciarGuardado] = useTransition();
  const [abriendo, iniciarApertura] = useTransition();
  const [, iniciarCatalogo] = useTransition();

  const porCodigo = useMemo(() => new Map(catalogo.map((p) => [p.codigo, p])), [catalogo]);
  const empresa = empresas.find((e) => e.id === empresaId)!;

  const filas = lineas.map((l) => {
    const cant = numero(l.cantidad);
    const costo = numero(l.costo);
    const sub = cant * costo;
    return { ...l, cant, costoNum: costo, total: sub * (1 + numero(l.iva) / 100) };
  });
  const total = filas.reduce((s, f) => s + f.total, 0);
  const validas = filas.filter((f) => f.codigo.trim() || f.nombre.trim());
  const completo =
    proveedor.trim() !== "" &&
    validas.length > 0 &&
    validas.every((f) => f.codigo.trim() && f.nombre.trim() && f.cant > 0 && f.costoNum >= 0);

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
            // Si el código leído ya existe en el catálogo se usa; si no, se propone uno a partir del nombre
            const codigo = l.codigo && porCodigo.has(l.codigo) ? l.codigo : l.codigo || codigoDesde(l.descripcion);
            return {
              codigo,
              nombre: porCodigo.get(codigo)?.nombre ?? l.descripcion,
              cantidad: String(l.cantidad),
              costo: String(Math.round(costo * 100) / 100),
              iva: String(l.iva_porcentaje),
            };
          })
        : [lineaVacia()],
    );
    setFormularioVisible(true);
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
    setLineas((a) =>
      a.map((l, j) => {
        if (j !== i) return l;
        const nueva = { ...l, ...cambio };
        // Al escribir un código existente se toma su nombre
        if (cambio.codigo !== undefined && porCodigo.has(cambio.codigo.trim())) {
          nueva.nombre = porCodigo.get(cambio.codigo.trim())!.nombre;
        }
        return nueva;
      }),
    );
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

            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Código</th>
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
                    const existente = porCodigo.get(f.codigo.trim());
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <input
                            value={f.codigo}
                            onChange={(e) => editar(i, { codigo: e.target.value })}
                            list="catalogo-foto"
                            className={`${campo} font-mono`}
                            aria-label="Código"
                          />
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              existente ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {existente ? `Existente · stock ${existente.stock}` : "Nuevo"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={f.nombre}
                            onChange={(e) => editar(i, { nombre: e.target.value })}
                            className={campo}
                            aria-label="Nombre"
                          />
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
              <datalist id="catalogo-foto">
                {catalogo.map((p) => (
                  <option key={p.id} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
              </datalist>
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
        titulo="No se pudo leer el documento"
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
