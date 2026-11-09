"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { IlustracionProducto } from "@/components/ilustracion-producto";
import { pesos } from "@/lib/formato";
import { comprimirImagen } from "@/lib/imagenes";
import { urlImagenPortafolio } from "@/lib/portafolio";
import { guardarItem, publicarTodos } from "./acciones";

export type ItemPortafolio = {
  id: string;
  codigo: string;
  nombre: string;
  precio_venta: number;
  stock: number;
  es_servicio: boolean;
  publicar_portafolio: boolean;
  descripcion_comercial: string | null;
  foto_path: string | null;
  etiqueta_portafolio: "oferta" | "nuevo" | null;
};

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Fila({ item }: { item: ItemPortafolio }) {
  const [publicar, setPublicar] = useState(item.publicar_portafolio);
  // "Publicar todos" cambia el dato desde el servidor: la casilla debe seguirlo
  const [publicadoPrevio, setPublicadoPrevio] = useState(item.publicar_portafolio);
  if (item.publicar_portafolio !== publicadoPrevio) {
    setPublicadoPrevio(item.publicar_portafolio);
    setPublicar(item.publicar_portafolio);
  }
  const [etiqueta, setEtiqueta] = useState(item.etiqueta_portafolio ?? "");
  const [descripcion, setDescripcion] = useState(item.descripcion_comercial ?? "");
  const [foto, setFoto] = useState(item.foto_path);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();

  type Cambios = { publicar?: boolean; etiqueta?: string; archivo?: File; quitarFoto?: boolean };

  function guardar(c: Cambios = {}) {
    const datos = new FormData();
    datos.set("id", item.id);
    datos.set("publicar", String(c.publicar ?? publicar));
    datos.set("etiqueta", c.etiqueta ?? etiqueta);
    datos.set("descripcion", descripcion);
    if (c.archivo) datos.set("foto", c.archivo);
    if (c.quitarFoto) datos.set("quitar_foto", "true");
    setError(undefined);
    iniciar(async () => {
      const r = await guardarItem(datos);
      if (r.error) setError(r.error);
      else if (r.foto_path !== undefined) setFoto(r.foto_path);
    });
  }

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    guardar({ archivo: await comprimirImagen(archivo, 1200) });
  }

  const url = urlImagenPortafolio(foto);

  return (
    <li className="flex flex-wrap items-start gap-4 px-4 py-3">
      <label className="relative flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 hover:ring-blue-400">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen pública de Supabase
          <img src={url} alt={item.nombre} className="size-full object-cover" />
        ) : (
          <IlustracionProducto nombre={item.nombre} esServicio={item.es_servicio} compacta />
        )}
        <span className="sr-only">Cambiar foto de {item.nombre}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => elegirFoto(e.target.files?.[0])} />
      </label>

      <div className="min-w-60 flex-1 space-y-2">
        <div>
          <p className="font-medium text-slate-900">{item.nombre}</p>
          <p className="text-xs text-slate-500">
            <span className="font-mono">{item.codigo}</span> · {pesos(item.precio_venta)} ·{" "}
            {item.es_servicio ? "Servicio" : `Stock ${item.stock}`}
            {url && (
              <button type="button" onClick={() => guardar({ quitarFoto: true })} className="ml-2 text-red-700 hover:underline">
                Quitar foto
              </button>
            )}
          </p>
        </div>
        <textarea
          rows={2}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          onBlur={() => {
            if (descripcion !== (item.descripcion_comercial ?? "")) guardar();
          }}
          placeholder="Descripción comercial para el cliente"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          aria-label={`Descripción de ${item.nombre}`}
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      <div className="flex w-36 flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={publicar}
            onChange={(e) => {
              setPublicar(e.target.checked);
              guardar({ publicar: e.target.checked });
            }}
            className="size-4"
          />
          Publicar
        </label>
        <select
          value={etiqueta}
          onChange={(e) => {
            setEtiqueta(e.target.value);
            guardar({ etiqueta: e.target.value });
          }}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          aria-label={`Etiqueta de ${item.nombre}`}
        >
          <option value="">Sin etiqueta</option>
          <option value="oferta">Oferta</option>
          <option value="nuevo">Nuevo</option>
        </select>
        <span className={`text-xs text-slate-500 ${guardando ? "" : "invisible"}`}>Guardando…</span>
      </div>
    </li>
  );
}

export function ListaItems({ items }: { items: ItemPortafolio[] }) {
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [confirmar, setConfirmar] = useState<"publicar" | "quitar" | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string }>();
  const [aplicando, iniciarMasivo] = useTransition();
  const publicados = items.filter((i) => i.publicar_portafolio).length;

  function aplicarATodos() {
    const publicar = confirmar === "publicar";
    iniciarMasivo(async () => {
      const r = await publicarTodos(publicar);
      setConfirmar(null);
      setAviso(
        r.error
          ? { ok: false, texto: r.error }
          : { ok: true, texto: publicar ? `${r.cantidad} publicados` : `${r.cantidad} retirados del portafolio` },
      );
    });
  }

  const lista = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    return items.filter((i) => {
      if (filtro === "productos" && i.es_servicio) return false;
      if (filtro === "servicios" && !i.es_servicio) return false;
      if (filtro === "publicados" && !i.publicar_portafolio) return false;
      const donde = normalizar(`${i.nombre} ${i.codigo}`);
      return palabras.every((p) => donde.includes(p));
    });
  }, [items, texto, filtro]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">
          <strong className="text-slate-900">{publicados}</strong> de {items.length} publicados
          {aviso && <span className={`ml-3 ${aviso.ok ? "text-green-700" : "text-red-700"}`}>{aviso.texto}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/portafolio/redes" className={botonSecundario}>
            Imágenes para redes
          </Link>
          <button type="button" onClick={() => setConfirmar("quitar")} className={botonSecundario}>
            Quitar todos
          </button>
          <button type="button" onClick={() => setConfirmar("publicar")} className={botonPrimario}>
            Publicar todos
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar producto o servicio..."
          autoComplete="off"
          className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
          <option value="todos">Todos</option>
          <option value="productos">Productos</option>
          <option value="servicios">Servicios</option>
          <option value="publicados">Publicados</option>
        </select>
      </div>
      {lista.length === 0 ? (
        <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">No hay productos que coincidan.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
          {lista.map((i) => (
            <Fila key={i.id} item={i} />
          ))}
        </ul>
      )}

      <Dialogo
        abierto={confirmar !== null}
        titulo={confirmar === "publicar" ? "¿Publicar todos?" : "¿Quitar todos del portafolio?"}
        alCerrar={aplicando ? undefined : () => setConfirmar(null)}
        acciones={
          <>
            <button className={botonSecundario} onClick={() => setConfirmar(null)} disabled={aplicando}>
              Cancelar
            </button>
            <button className={botonPrimario} onClick={aplicarATodos} disabled={aplicando}>
              {aplicando ? "Aplicando..." : "Sí, aplicar"}
            </button>
          </>
        }
      >
        <p>
          {confirmar === "publicar"
            ? `Los ${items.length} productos y servicios activos quedarán visibles en el portafolio. Después puede quitar los que no quiera.`
            : "Ningún producto ni servicio se verá en el portafolio hasta que los publique de nuevo."}
        </p>
      </Dialogo>
    </section>
  );
}
