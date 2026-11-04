"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { asignarEmpresa, guardarConfigBuzon, marcarCuenti, procesarAhora, type ConfigBuzon } from "./acciones";

export type FacturaCorreo = {
  id: string;
  cufe: string;
  numero: string | null;
  fecha_documento: string | null;
  proveedor_nombre: string | null;
  proveedor_nit: string | null;
  cliente_nombre: string | null;
  cliente_nit: string | null;
  monto: number | null;
  empresa_id: string | null;
  asunto: string | null;
  remitente: string | null;
  archivo: string | null;
  compra_id: string | null;
  cuenti: boolean;
  creado_en: string;
};

export type PagoCorreo = {
  id: string;
  fecha_pago: string | null;
  fecha_pago_texto: string | null;
  empresa_pagadora: string | null;
  cuenta: string | null;
  banco: string | null;
  valor_total: number | null;
  nro_factura: string | null;
  nro_factura_proveedor: string | null;
  valor_pagado: number | null;
  retefte: number | null;
  asunto: string | null;
  cuenti: boolean;
  creado_en: string;
};

// Paleta del panel anterior (Apps Script)
const C = {
  fondo: "#FAF9F5",
  tinta: "#1B2321",
  suave: "#5B6B63",
  verde: "#0F5257",
  verdeSuave: "#E4EEED",
  dorado: "#9C6B1F",
  linea: "#DFE3DE",
};

const pesos = (v: number | null | undefined) =>
  v == null || Number.isNaN(Number(v)) ? "" : `$${Math.round(Number(v)).toLocaleString("es-CO")}`;
const cufeCorto = (c: string) => (c.length > 18 ? `${c.slice(0, 10)}…${c.slice(-8)}` : c);

type Vista = "facturas" | "pagos";

export function PanelBuzon({
  facturas: facturasIniciales,
  pagos: pagosIniciales,
  empresas,
  config,
  ultimaRevision,
  ultimoResultado,
}: {
  facturas: FacturaCorreo[];
  pagos: PagoCorreo[];
  empresas: { id: string; nombre: string }[];
  config: ConfigBuzon | null;
  ultimaRevision: string | null;
  ultimoResultado: string | null;
}) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("facturas");
  const [facturas, setFacturas] = useState(facturasIniciales);
  const [pagos, setPagos] = useState(pagosIniciales);
  const [aviso, setAviso] = useState<string | null>(null);
  const [procesando, iniciarProceso] = useTransition();
  const [refrescando, iniciarRefresco] = useTransition();
  const [verConfig, setVerConfig] = useState(false);

  // Al refrescar desde el servidor llegan datos nuevos por props
  const [origen, setOrigen] = useState({ facturasIniciales, pagosIniciales });
  if (origen.facturasIniciales !== facturasIniciales || origen.pagosIniciales !== pagosIniciales) {
    setOrigen({ facturasIniciales, pagosIniciales });
    setFacturas(facturasIniciales);
    setPagos(pagosIniciales);
  }

  function mostrar(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 2500);
  }

  function procesar() {
    iniciarProceso(async () => {
      const r = await procesarAhora();
      if (r.error) return mostrar(`Error: ${r.error}`);
      const x = r.resultado!;
      router.refresh();
      mostrar(
        x.facturasNuevas || x.pagosNuevos
          ? `Nuevas: ${x.facturasNuevas} factura(s) y ${x.pagosNuevos} línea(s) de pago${x.pendientes ? ` · quedan ${x.pendientes} correos por leer` : ""}`
          : `No hay facturas ni pagos nuevos (${x.correosLeidos} correo(s) revisados)`,
      );
    });
  }

  const nombreEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));

  return (
    <div className="-m-4 min-h-[calc(100vh-2rem)] p-4 md:-m-8 md:p-8" style={{ background: C.fondo, color: C.tinta }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b-2 pb-4" style={{ borderColor: C.tinta }}>
          <h1 className="text-[26px] font-semibold" style={{ fontFamily: "var(--font-lora), serif", color: C.verde }}>
            {vista === "facturas" ? "Registro de facturas" : "Registro de pagos"}
          </h1>
          <span className="text-xs" style={{ color: C.suave }}>
            {ultimaRevision
              ? `Última revisión del correo: ${new Date(ultimaRevision).toLocaleString("es-CO")} · ${ultimoResultado ?? ""}`
              : "Aún no se ha revisado el correo"}
          </span>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2">
          <Pestana activa={vista === "facturas"} onClick={() => setVista("facturas")} icono={<IconoFactura />} texto="Facturas (CUFE)" />
          <Pestana activa={vista === "pagos"} onClick={() => setVista("pagos")} icono={<IconoBanco />} texto="Pagos" />
          <button
            type="button"
            onClick={() => setVerConfig(!verConfig)}
            className="ml-auto rounded-md border bg-white px-3 py-2 text-[13px]"
            style={{ borderColor: C.linea, color: C.suave }}
          >
            ⚙ Configuración del buzón
          </button>
        </nav>

        {verConfig && config && <ConfiguracionBuzon config={config} alGuardar={() => router.refresh()} mostrar={mostrar} />}

        {vista === "facturas" ? (
          <VistaFacturas
            facturas={facturas}
            setFacturas={setFacturas}
            empresas={empresas}
            nombreEmpresa={nombreEmpresa}
            procesar={procesar}
            procesando={procesando}
            refrescar={() => iniciarRefresco(() => router.refresh())}
            refrescando={refrescando}
            mostrar={mostrar}
          />
        ) : (
          <VistaPagos
            pagos={pagos}
            setPagos={setPagos}
            procesar={procesar}
            procesando={procesando}
            refrescar={() => iniciarRefresco(() => router.refresh())}
            refrescando={refrescando}
            mostrar={mostrar}
          />
        )}
      </div>

      <div
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-[13px] text-white transition ${
          aviso ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
        style={{ background: C.tinta }}
      >
        {aviso}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Facturas (CUFE)
// ---------------------------------------------------------------------

function VistaFacturas({
  facturas,
  setFacturas,
  empresas,
  nombreEmpresa,
  procesar,
  procesando,
  refrescar,
  refrescando,
  mostrar,
}: {
  facturas: FacturaCorreo[];
  setFacturas: React.Dispatch<React.SetStateAction<FacturaCorreo[]>>;
  empresas: { id: string; nombre: string }[];
  nombreEmpresa: Map<string, string>;
  procesar: () => void;
  procesando: boolean;
  refrescar: () => void;
  refrescando: boolean;
  mostrar: (m: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"" | "pendientes" | "importadas" | "sin-cuenti">("");

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return facturas.filter((f) => {
      if (filtro === "pendientes" && f.compra_id) return false;
      if (filtro === "importadas" && !f.compra_id) return false;
      if (filtro === "sin-cuenti" && f.cuenti) return false;
      if (!q) return true;
      return [f.proveedor_nombre, f.cufe, f.asunto, f.numero, f.proveedor_nit].some((x) => (x ?? "").toLowerCase().includes(q));
    });
  }, [facturas, busqueda, filtro]);

  const total = lista.reduce((s, f) => s + Number(f.monto ?? 0), 0);
  const pendientes = facturas.filter((f) => !f.compra_id).length;

  async function cambiarCuenti(f: FacturaCorreo, valor: boolean) {
    setFacturas((a) => a.map((x) => (x.id === f.id ? { ...x, cuenti: valor } : x)));
    const r = await marcarCuenti("facturas", f.id, valor);
    if (r.error) {
      setFacturas((a) => a.map((x) => (x.id === f.id ? { ...x, cuenti: !valor } : x)));
      mostrar(`Error al guardar: ${r.error}`);
    } else mostrar(valor ? "Marcada como registrada en Cuenti" : "Marca de Cuenti quitada");
  }

  async function cambiarEmpresa(f: FacturaCorreo, empresaId: string) {
    setFacturas((a) => a.map((x) => (x.id === f.id ? { ...x, empresa_id: empresaId || null } : x)));
    const r = await asignarEmpresa(f.id, empresaId || null);
    if (r.error) mostrar(`Error: ${r.error}`);
  }

  return (
    <section>
      <Estadisticas
        datos={[
          { valor: String(lista.length), texto: "Facturas registradas" },
          { valor: pesos(total) || "$0", texto: "Monto total" },
          { valor: String(pendientes), texto: "Pendientes de cargar a Compras" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por proveedor, CUFE o asunto…"
          className="min-w-60 flex-1 rounded-md border bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2"
          style={{ borderColor: C.linea }}
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as typeof filtro)}
          className="rounded-md border bg-white px-3 py-2.5 text-[13.5px]"
          style={{ borderColor: C.linea }}
        >
          <option value="">Todas</option>
          <option value="pendientes">Pendientes de cargar</option>
          <option value="importadas">Ya en Compras</option>
          <option value="sin-cuenti">Sin marcar en Cuenti</option>
        </select>
        <BotonesProceso procesar={procesar} procesando={procesando} refrescar={refrescar} refrescando={refrescando} texto="Procesar facturas ahora" />
      </div>

      <Tabla vacia={lista.length === 0} mensaje="No hay facturas que coincidan con la búsqueda.">
        <thead>
          <tr>
            {["Fecha documento", "Proveedor", "Monto", "CUFE", "Asunto", "Empresa / Compras", "Cuenti"].map((t) => (
              <Th key={t}>{t}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map((f) => (
            <tr key={f.id} className="border-b last:border-b-0 hover:bg-[#E4EEED]" style={{ borderColor: C.linea }}>
              <Td>{f.fecha_documento ?? ""}</Td>
              <Td>
                {f.proveedor_nombre}
                {f.numero && <span className="block text-[11.5px]" style={{ color: C.suave }}>Factura {f.numero}</span>}
              </Td>
              <Td className="text-right font-medium whitespace-nowrap tabular-nums" style={{ color: C.dorado }}>
                {pesos(f.monto)}
              </Td>
              <Td className="font-mono text-xs" style={{ color: C.suave }}>
                {cufeCorto(f.cufe)}{" "}
                <button
                  type="button"
                  className="text-[11.5px] underline"
                  style={{ color: C.verde }}
                  onClick={() => navigator.clipboard.writeText(f.cufe).then(() => mostrar("CUFE copiado"))}
                >
                  copiar
                </button>
              </Td>
              <Td className="max-w-72">{f.asunto}</Td>
              <Td className="min-w-48">
                {f.compra_id ? (
                  <>
                    <span className="block text-[12.5px]">{f.empresa_id ? nombreEmpresa.get(f.empresa_id) : ""}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: C.verdeSuave, color: C.verde }}>
                      ✓ En Compras
                    </span>
                  </>
                ) : (
                  <div className="space-y-1">
                    <select
                      value={f.empresa_id ?? ""}
                      onChange={(e) => cambiarEmpresa(f, e.target.value)}
                      className="w-full rounded border bg-white px-1.5 py-1 text-[12.5px]"
                      style={{ borderColor: f.empresa_id ? C.linea : "#d97706" }}
                      aria-label="Empresa de la factura"
                    >
                      <option value="">Sin asignar…</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                    {f.empresa_id ? (
                      <Link
                        href={`/compras/importar?correo=${f.id}`}
                        className="inline-block rounded px-2 py-1 text-[12px] font-semibold text-white"
                        style={{ background: C.verde }}
                      >
                        Cargar a Compras →
                      </Link>
                    ) : (
                      <span className="block text-[11.5px] text-amber-700">Elija la empresa para cargarla</span>
                    )}
                  </div>
                )}
              </Td>
              <Td className="text-center">
                <input
                  type="checkbox"
                  checked={f.cuenti}
                  onChange={(e) => cambiarCuenti(f, e.target.checked)}
                  className="size-[18px] cursor-pointer"
                  style={{ accentColor: C.verde }}
                  aria-label="Registrada en Cuenti"
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </section>
  );
}

// ---------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------

type ClavePago = "fecha_pago" | "empresa_pagadora" | "nro_factura" | "nro_factura_proveedor" | "valor_pagado" | "retefte" | "cuenti";

function VistaPagos({
  pagos,
  setPagos,
  procesar,
  procesando,
  refrescar,
  refrescando,
  mostrar,
}: {
  pagos: PagoCorreo[];
  setPagos: React.Dispatch<React.SetStateAction<PagoCorreo[]>>;
  procesar: () => void;
  procesando: boolean;
  refrescar: () => void;
  refrescando: boolean;
  mostrar: (m: string) => void;
}) {
  const [empresa, setEmpresa] = useState("");
  const [nroProv, setNroProv] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [orden, setOrden] = useState<{ clave: ClavePago | null; dir: 1 | -1 }>({ clave: null, dir: 1 });

  const empresas = useMemo(() => [...new Set(pagos.map((p) => p.empresa_pagadora).filter(Boolean))].sort() as string[], [pagos]);
  const facturasProv = useMemo(
    () => [...new Set(pagos.map((p) => p.nro_factura_proveedor).filter(Boolean))].sort() as string[],
    [pagos],
  );

  const lista = useMemo(() => {
    const filtrados = pagos.filter((p) => {
      if (empresa && p.empresa_pagadora !== empresa) return false;
      if (nroProv && p.nro_factura_proveedor !== nroProv) return false;
      if (desde && p.fecha_pago && p.fecha_pago < desde) return false;
      if (hasta && p.fecha_pago && p.fecha_pago > hasta) return false;
      return true;
    });
    if (!orden.clave) return filtrados;
    const k = orden.clave;
    return [...filtrados].sort((a, b) => {
      const va = a[k] ?? "";
      const vb = b[k] ?? "";
      const x = typeof va === "number" || typeof vb === "number" ? Number(va) - Number(vb) : String(va).localeCompare(String(vb), "es", { numeric: true });
      return x * orden.dir;
    });
  }, [pagos, empresa, nroProv, desde, hasta, orden]);

  const total = lista.reduce((s, p) => s + Number(p.valor_pagado ?? 0), 0);

  function ordenar(clave: ClavePago) {
    setOrden((o) => (o.clave === clave ? { clave, dir: o.dir === 1 ? -1 : 1 } : { clave, dir: 1 }));
  }

  async function cambiarCuenti(p: PagoCorreo, valor: boolean) {
    setPagos((a) => a.map((x) => (x.id === p.id ? { ...x, cuenti: valor } : x)));
    const r = await marcarCuenti("pagos", p.id, valor);
    if (r.error) {
      setPagos((a) => a.map((x) => (x.id === p.id ? { ...x, cuenti: !valor } : x)));
      mostrar(`Error al guardar: ${r.error}`);
    } else mostrar(valor ? "Marcado como registrado en Cuenti" : "Marca de Cuenti quitada");
  }

  const control = "rounded-md border bg-white px-3 py-2 text-[13.5px]";
  const columnas: { clave: ClavePago; texto: string }[] = [
    { clave: "fecha_pago", texto: "Fecha pago" },
    { clave: "empresa_pagadora", texto: "Empresa pagadora" },
    { clave: "nro_factura", texto: "Nro. Factura" },
    { clave: "nro_factura_proveedor", texto: "Nro. Fact. Prov." },
    { clave: "valor_pagado", texto: "Valor pagado" },
    { clave: "retefte", texto: "ReteFte" },
    { clave: "cuenti", texto: "Cuenti" },
  ];

  return (
    <section>
      <Estadisticas
        datos={[
          { valor: String(lista.length), texto: "Líneas de pago registradas" },
          { valor: pesos(total) || "$0", texto: "Valor pagado (total)" },
          { valor: lista[0]?.fecha_pago ?? "—", texto: "Último pago recibido" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={control} style={{ borderColor: C.linea }}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select value={nroProv} onChange={(e) => setNroProv(e.target.value)} className={control} style={{ borderColor: C.linea }}>
          <option value="">Todos los Nro. Fact. Prov.</option>
          {facturasProv.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: C.suave }}>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={control} style={{ borderColor: C.linea }} aria-label="Desde" />
          <span>–</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={control} style={{ borderColor: C.linea }} aria-label="Hasta" />
        </div>
        <BotonAccion
          onClick={() => {
            setEmpresa("");
            setNroProv("");
            setDesde("");
            setHasta("");
          }}
        >
          Limpiar filtros
        </BotonAccion>
        <BotonesProceso procesar={procesar} procesando={procesando} refrescar={refrescar} refrescando={refrescando} texto="Procesar pagos ahora" />
      </div>

      <Tabla vacia={lista.length === 0} mensaje="No hay pagos que coincidan con los filtros.">
        <thead>
          <tr>
            {columnas.map((c) => (
              <Th key={c.clave} onClick={() => ordenar(c.clave)} ordenable>
                {c.texto}
                {orden.clave === c.clave && <span className="ml-1 text-[9px]">{orden.dir === 1 ? "▲" : "▼"}</span>}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.id} className="border-b last:border-b-0 hover:bg-[#E4EEED]" style={{ borderColor: C.linea }}>
              <Td>{p.fecha_pago ?? p.fecha_pago_texto}</Td>
              <Td>
                {p.empresa_pagadora}
                <span className="block text-[11.5px]" style={{ color: C.suave }}>
                  {[p.banco, p.cuenta && `cta ${p.cuenta}`].filter(Boolean).join(" · ")}
                </span>
              </Td>
              <Td>{p.nro_factura}</Td>
              <Td>{p.nro_factura_proveedor}</Td>
              <Td className="text-right font-medium whitespace-nowrap tabular-nums" style={{ color: C.dorado }}>
                {pesos(p.valor_pagado)}
              </Td>
              <Td className="text-right whitespace-nowrap tabular-nums" style={{ color: C.dorado }}>
                {p.retefte != null ? pesos(p.retefte) : "—"}
              </Td>
              <Td className="text-center">
                <input
                  type="checkbox"
                  checked={p.cuenti}
                  onChange={(e) => cambiarCuenti(p, e.target.checked)}
                  className="size-[18px] cursor-pointer"
                  style={{ accentColor: C.verde }}
                  aria-label="Registrado en Cuenti"
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </section>
  );
}

// ---------------------------------------------------------------------
// Configuración del buzón
// ---------------------------------------------------------------------

function ConfiguracionBuzon({ config, alGuardar, mostrar }: { config: ConfigBuzon; alGuardar: () => void; mostrar: (m: string) => void }) {
  const [remitentes, setRemitentes] = useState(config.remitentes.join("\n"));
  const [asunto, setAsunto] = useState(config.asunto_pagos);
  const [prefijo, setPrefijo] = useState(config.prefijo_factura_pago);
  const [fecha, setFecha] = useState(config.fecha_inicio);
  const [guardando, iniciar] = useTransition();
  const campo = "mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm";

  return (
    <div className="mb-6 grid gap-4 rounded-md border bg-white p-5 md:grid-cols-2" style={{ borderColor: C.linea }}>
      <label className="text-[13px] font-medium md:row-span-2">
        Correos que reenvían facturas y pagos (uno por línea)
        <textarea value={remitentes} onChange={(e) => setRemitentes(e.target.value)} rows={5} className={campo} style={{ borderColor: C.linea }} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[13px] font-medium">
          Asunto de los pagos contiene
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={campo} style={{ borderColor: C.linea }} />
        </label>
        <label className="text-[13px] font-medium">
          Prefijo de sus facturas en los pagos
          <input value={prefijo} onChange={(e) => setPrefijo(e.target.value)} className={campo} style={{ borderColor: C.linea }} />
        </label>
        <label className="text-[13px] font-medium">
          Leer correos desde
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} style={{ borderColor: C.linea }} />
        </label>
      </div>
      <div className="flex items-end justify-end">
        <BotonAccion
          principal
          disabled={guardando}
          onClick={() =>
            iniciar(async () => {
              const r = await guardarConfigBuzon({
                remitentes: remitentes.split(/[\n,;]+/),
                asunto_pagos: asunto,
                prefijo_factura_pago: prefijo,
                fecha_inicio: fecha,
              });
              if (r.error) mostrar(`Error: ${r.error}`);
              else {
                mostrar("Configuración guardada");
                alGuardar();
              }
            })
          }
        >
          {guardando ? "Guardando…" : "Guardar configuración"}
        </BotonAccion>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------

function Pestana({ activa, onClick, icono, texto }: { activa: boolean; onClick: () => void; icono: React.ReactNode; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border px-4 py-2 text-[13.5px] font-medium"
      style={activa ? { borderColor: C.verde, color: C.verde, background: C.verdeSuave } : { borderColor: C.linea, color: C.suave, background: "#fff" }}
    >
      {icono}
      {texto}
    </button>
  );
}

function Estadisticas({ datos }: { datos: { valor: string; texto: string }[] }) {
  return (
    <div className="mb-6 grid overflow-hidden rounded-md border bg-white sm:grid-cols-3" style={{ borderColor: C.linea }}>
      {datos.map((d, i) => (
        <div key={d.texto} className={`px-5 py-4 ${i < datos.length - 1 ? "border-b sm:border-r sm:border-b-0" : ""}`} style={{ borderColor: C.linea }}>
          <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-lora), serif", color: C.verde }}>
            {d.valor}
          </p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: C.suave }}>
            {d.texto}
          </p>
        </div>
      ))}
    </div>
  );
}

function BotonAccion({
  children,
  onClick,
  principal,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  principal?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border px-4 py-2.5 text-[13.5px] font-medium whitespace-nowrap disabled:opacity-50"
      style={principal ? { borderColor: C.verde, background: C.verde, color: "#fff" } : { borderColor: C.verde, background: "#fff", color: C.verde }}
    >
      {children}
    </button>
  );
}

function BotonesProceso({
  procesar,
  procesando,
  refrescar,
  refrescando,
  texto,
}: {
  procesar: () => void;
  procesando: boolean;
  refrescar: () => void;
  refrescando: boolean;
  texto: string;
}) {
  return (
    <>
      <BotonAccion onClick={refrescar} disabled={refrescando || procesando}>
        {refrescando ? "Cargando…" : "Refrescar vista"}
      </BotonAccion>
      <BotonAccion principal onClick={procesar} disabled={procesando}>
        {procesando ? "Revisando correo…" : texto}
      </BotonAccion>
    </>
  );
}

function Tabla({ vacia, mensaje, children }: { vacia: boolean; mensaje: string; children: React.ReactNode }) {
  return (
    <div className="max-h-[65vh] overflow-auto rounded-md border bg-white" style={{ borderColor: C.linea }}>
      <table className="w-full border-collapse text-sm">{children}</table>
      {vacia && (
        <p className="px-4 py-12 text-center" style={{ color: C.suave }}>
          {mensaje}
        </p>
      )}
    </div>
  );
}

function Th({ children, onClick, ordenable }: { children: React.ReactNode; onClick?: () => void; ordenable?: boolean }) {
  return (
    <th
      onClick={onClick}
      className={`sticky top-0 z-10 px-3.5 py-2.5 text-left text-[12.5px] font-medium whitespace-nowrap text-white ${
        ordenable ? "cursor-pointer select-none hover:bg-[#2A332F]" : ""
      }`}
      style={{ background: C.tinta }}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <td className={`px-3.5 py-2.5 align-top ${className}`} style={style}>
      {children}
    </td>
  );
}

function IconoFactura() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function IconoBanco() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10l9-6 9 6" />
      <path d="M4 10v9M9 10v9M15 10v9M20 10v9" />
      <path d="M2 21h20" />
    </svg>
  );
}
