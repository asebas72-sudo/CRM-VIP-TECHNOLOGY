"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { botonExito, botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { pesos } from "@/lib/formato";
import {
  buscarProductos,
  registrarVenta,
  serialesDisponibles,
  type DatosVenta,
  type ProductoVenta,
} from "./acciones";

type Linea = {
  producto: ProductoVenta;
  cantidad: number;
  descuento: number;
  seriales: { id: string; serial: string }[];
};

const FORMAS: { valor: DatosVenta["forma_pago"]; texto: string }[] = [
  { valor: "efectivo", texto: "Efectivo" },
  { valor: "tarjeta", texto: "Tarjeta" },
  { valor: "transferencia", texto: "Transferencia" },
  { valor: "mixto", texto: "Mixto" },
];

const entero = (v: string) => Number(v.replace(/\D/g, "")) || 0;

export function PuntoDeVenta() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ProductoVenta[]>([]);
  const [aviso, setAviso] = useState<string>();
  const [buscando, iniciarBusqueda] = useTransition();

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [forma, setForma] = useState<DatosVenta["forma_pago"]>("efectivo");
  const [recibido, setRecibido] = useState("");
  const [cliente, setCliente] = useState({ documento: "", nombre: "", telefono: "" });
  const [verCliente, setVerCliente] = useState(false);
  const [notas, setNotas] = useState("");

  const [eligiendoSerial, setEligiendoSerial] = useState<{
    indice: number;
    disponibles: { id: string; serial: string }[];
  } | null>(null);
  const [error, setError] = useState<string>();
  const [ventaLista, setVentaLista] = useState<string | null>(null);
  const [cobrando, iniciarCobro] = useTransition();

  const total = lineas.reduce((s, l) => s + l.producto.precio_venta * l.cantidad - l.descuento, 0);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const recibidoNum = entero(recibido);
  const cambio = forma === "efectivo" && recibidoNum > 0 ? recibidoNum - total : null;
  const faltanSeriales = lineas.some((l) => l.producto.maneja_serial && l.seriales.length !== l.cantidad);
  const sinStock = lineas.some((l) => l.cantidad > l.producto.stock);

  function enfocar() {
    setTimeout(() => entrada.current?.focus(), 0);
  }

  function agregar(producto: ProductoVenta) {
    setLineas((actual) => {
      const i = actual.findIndex((l) => l.producto.id === producto.id);
      if (i >= 0) return actual.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...actual, { producto, cantidad: 1, descuento: 0, seriales: [] }];
    });
    setTexto("");
    setResultados([]);
    setAviso(undefined);
    enfocar();
  }

  function buscar(valor: string, alPresionarEnter: boolean) {
    const q = valor.trim();
    if (!q) {
      setResultados([]);
      return;
    }
    iniciarBusqueda(async () => {
      const r = await buscarProductos(q);
      // Escáner o código exacto + Enter: se agrega directo al carrito
      if (alPresionarEnter && (r.exacto || r.productos.length === 1)) {
        agregar(r.productos[0]);
        return;
      }
      setResultados(r.productos);
      setAviso(r.productos.length === 0 ? `No se encontró "${q}"` : undefined);
    });
  }

  function alEscribir(valor: string) {
    setTexto(valor);
    clearTimeout(temporizador.current);
    if (valor.trim().length >= 2) temporizador.current = setTimeout(() => buscar(valor, false), 350);
    else setResultados([]);
  }

  function cambiarLinea(i: number, cambio: Partial<Linea>) {
    setLineas((actual) => actual.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  }

  async function abrirSeriales(i: number) {
    const disponibles = await serialesDisponibles(lineas[i].producto.id);
    setEligiendoSerial({ indice: i, disponibles });
  }

  function alternarSerial(s: { id: string; serial: string }) {
    if (!eligiendoSerial) return;
    const linea = lineas[eligiendoSerial.indice];
    const elegido = linea.seriales.some((x) => x.id === s.id);
    const seriales = elegido ? linea.seriales.filter((x) => x.id !== s.id) : [...linea.seriales, s];
    // La cantidad sigue a los seriales elegidos
    cambiarLinea(eligiendoSerial.indice, { seriales, cantidad: Math.max(seriales.length, 1) });
  }

  function cobrar() {
    setError(undefined);
    const datos: DatosVenta = {
      items: lineas.map((l) => ({
        producto_id: l.producto.id,
        cantidad: l.cantidad,
        descuento: l.descuento,
        serial_ids: l.seriales.map((s) => s.id),
      })),
      forma_pago: forma,
      recibido: forma === "efectivo" && recibidoNum > 0 ? recibidoNum : null,
      notas,
      cliente: cliente.documento || cliente.nombre ? cliente : null,
    };
    iniciarCobro(async () => {
      const r = await registrarVenta(datos);
      if (r.ok) setVentaLista(r.ventaId);
      else setError(r.error);
    });
  }

  function nuevaVenta() {
    setLineas([]);
    setRecibido("");
    setCliente({ documento: "", nombre: "", telefono: "" });
    setVerCliente(false);
    setNotas("");
    setForma("efectivo");
    setVentaLista(null);
    enfocar();
  }

  const lineaSerial = eligiendoSerial ? lineas[eligiendoSerial.indice] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Escáner / búsqueda */}
        <div className="relative">
          <input
            ref={entrada}
            value={texto}
            autoFocus
            onChange={(e) => alEscribir(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(temporizador.current);
                buscar(texto, true);
              }
              if (e.key === "Escape") setResultados([]);
            }}
            placeholder="Escanee el QR o escriba código / nombre y presione Enter"
            className="w-full rounded-xl border-2 border-blue-600 bg-white px-4 py-3 text-lg outline-none focus:ring-4 focus:ring-blue-600/20"
          />
          {buscando && <span className="absolute top-4 right-4 text-sm text-slate-400">Buscando...</span>}
          {(resultados.length > 0 || aviso) && (
            <div className="absolute z-10 mt-1 max-h-96 w-full overflow-y-auto rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
              {aviso && <p className="px-4 py-3 text-sm text-slate-500">{aviso}</p>}
              {resultados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => agregar(p)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 text-left hover:bg-blue-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{p.nombre}</span>
                    <span className="font-mono text-xs text-slate-500">
                      {p.codigo}
                      {p.ubicacion && <span className="font-sans"> · {p.ubicacion}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">{pesos(p.precio_venta)}</span>
                    <span className={`text-xs ${p.stock > 0 ? "text-slate-500" : "font-semibold text-red-600"}`}>
                      Stock {p.stock}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          {lineas.length === 0 ? (
            <p className="p-10 text-center text-slate-400">El carrito está vacío. Escanee un producto para empezar.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 text-right font-medium">Precio</th>
                  <th className="px-3 py-2 text-center font-medium">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium">Descuento</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {lineas.map((l, i) => (
                  <tr key={l.producto.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{l.producto.nombre}</p>
                      <p className="font-mono text-xs text-slate-500">{l.producto.codigo}</p>
                      {l.cantidad > l.producto.stock && (
                        <p className="text-xs font-semibold text-red-600">Solo hay {l.producto.stock} en stock</p>
                      )}
                      {l.producto.maneja_serial && (
                        <button
                          onClick={() => abrirSeriales(i)}
                          className={`mt-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                            l.seriales.length === l.cantidad ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          Seriales {l.seriales.length}/{l.cantidad}
                          {l.seriales.length > 0 && `: ${l.seriales.map((s) => s.serial).join(", ")}`}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{pesos(l.producto.precio_venta)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="size-7 rounded-md bg-slate-100 font-bold hover:bg-slate-200"
                          onClick={() => cambiarLinea(i, { cantidad: Math.max(1, l.cantidad - 1) })}
                          aria-label="Restar uno"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-semibold tabular-nums">{l.cantidad}</span>
                        <button
                          className="size-7 rounded-md bg-slate-100 font-bold hover:bg-slate-200"
                          onClick={() => cambiarLinea(i, { cantidad: l.cantidad + 1 })}
                          aria-label="Sumar uno"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        value={l.descuento || ""}
                        placeholder="0"
                        inputMode="numeric"
                        onChange={(e) => cambiarLinea(i, { descuento: entero(e.target.value) })}
                        aria-label="Descuento en pesos"
                        className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {pesos(l.producto.precio_venta * l.cantidad - l.descuento)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => {
                          setLineas((a) => a.filter((_, j) => j !== i));
                          enfocar();
                        }}
                        className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50"
                        aria-label="Quitar"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Cobro */}
      <div className="space-y-4 self-start rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div>
          <p className="text-sm text-slate-500">{unidades} unidad(es)</p>
          <p className="text-4xl font-bold tabular-nums text-slate-900">{pesos(total)}</p>
          <p className="text-xs text-slate-500">IVA incluido</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {FORMAS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setForma(f.valor)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                forma === f.valor ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>

        {forma === "efectivo" && (
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Recibido
              <input
                value={recibido ? Number(entero(recibido)).toLocaleString("es-CO") : ""}
                onChange={(e) => setRecibido(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right text-lg tabular-nums"
              />
            </label>
            {cambio !== null && (
              <p className={`mt-1 text-right text-lg font-semibold ${cambio < 0 ? "text-red-600" : "text-green-700"}`}>
                {cambio < 0 ? `Faltan ${pesos(-cambio)}` : `Cambio ${pesos(cambio)}`}
              </p>
            )}
          </div>
        )}

        <div>
          <button onClick={() => setVerCliente(!verCliente)} className="text-sm font-medium text-blue-700 hover:underline">
            {verCliente ? "− Ocultar cliente" : "+ Agregar cliente (opcional)"}
          </button>
          {verCliente && (
            <div className="mt-2 space-y-2">
              {(["documento", "nombre", "telefono"] as const).map((campo) => (
                <input
                  key={campo}
                  value={cliente[campo]}
                  onChange={(e) => setCliente({ ...cliente, [campo]: e.target.value })}
                  placeholder={{ documento: "Cédula / NIT", nombre: "Nombre", telefono: "Teléfono" }[campo]}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              ))}
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Nota de la venta"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
          )}
        </div>

        <button
          onClick={cobrar}
          disabled={lineas.length === 0 || cobrando || faltanSeriales || sinStock || (cambio !== null && cambio < 0)}
          className={`${botonExito} w-full py-3 text-lg`}
        >
          {cobrando ? "Registrando..." : "Cobrar"}
        </button>
        {faltanSeriales && <p className="text-xs text-amber-700">Seleccione los seriales de los productos marcados.</p>}
        {lineas.length > 0 && (
          <button onClick={nuevaVenta} className="w-full text-sm text-slate-500 hover:text-red-600">
            Cancelar venta
          </button>
        )}
      </div>

      {/* Selección de seriales */}
      <Dialogo
        abierto={eligiendoSerial !== null}
        titulo={`Seriales de ${lineaSerial?.producto.nombre ?? ""}`}
        alCerrar={() => setEligiendoSerial(null)}
        acciones={
          <button className={botonPrimario} onClick={() => setEligiendoSerial(null)}>
            Listo ({lineaSerial?.seriales.length ?? 0})
          </button>
        }
      >
        {eligiendoSerial?.disponibles.length === 0 ? (
          <p>No hay seriales disponibles de este producto.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {eligiendoSerial?.disponibles.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1 font-mono hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={lineaSerial?.seriales.some((x) => x.id === s.id) ?? false}
                  onChange={() => alternarSerial(s)}
                />
                {s.serial}
              </label>
            ))}
          </div>
        )}
      </Dialogo>

      {/* Resultado */}
      <Dialogo
        abierto={ventaLista !== null}
        tono="exito"
        titulo="Venta registrada"
        acciones={
          <>
            <button className={botonSecundario} onClick={nuevaVenta}>
              Nueva venta
            </button>
            <button className={botonPrimario} onClick={() => router.push(`/ventas/${ventaLista}?imprimir=1`)}>
              Imprimir tirilla
            </button>
          </>
        }
      >
        <p>
          Total <strong>{pesos(total)}</strong>
          {cambio !== null && cambio >= 0 && (
            <>
              {" "}
              · cambio <strong>{pesos(cambio)}</strong>
            </>
          )}
          .
        </p>
      </Dialogo>
      <Dialogo
        abierto={Boolean(error)}
        tono="error"
        titulo="No se pudo registrar la venta"
        alCerrar={() => setError(undefined)}
        acciones={
          <button className={botonPrimario} onClick={() => setError(undefined)}>
            Entendido
          </button>
        }
      >
        <p>{error}</p>
      </Dialogo>
    </div>
  );
}
