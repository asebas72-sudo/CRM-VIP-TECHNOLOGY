"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { botonPrimario, botonSecundario } from "@/components/dialogo";
import { aBlob, descargarBlob as descargar, dibujarPieza, nombreArchivo, textoPublicacion, type Formato, type ItemPieza, type MarcaPieza } from "./piezas";

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function GeneradorRedes({ items, marca, preciosInicial }: { items: ItemPieza[]; marca: MarcaPieza; preciosInicial: boolean }) {
  const [texto, setTexto] = useState("");
  const [elegidoId, setElegidoId] = useState(items[0]?.id);
  const [conPrecio, setConPrecio] = useState(preciosInicial);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string>();
  const [progreso, setProgreso] = useState<string>();
  const cuadrada = useRef<HTMLCanvasElement>(null);
  const vertical = useRef<HTMLCanvasElement>(null);

  const elegido = items.find((i) => i.id === elegidoId);

  const lista = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    return items.filter((i) => palabras.every((p) => normalizar(i.nombre).includes(p)));
  }, [items, texto]);

  useEffect(() => {
    if (!elegido || !cuadrada.current || !vertical.current) return;
    setError(undefined);
    Promise.all([
      dibujarPieza(cuadrada.current, elegido, marca, "cuadrada", conPrecio),
      dibujarPieza(vertical.current, elegido, marca, "vertical", conPrecio),
    ]).catch(() => setError("No se pudo dibujar la imagen."));
  }, [elegido, marca, conPrecio]);

  async function bajar(formato: Formato) {
    const lienzo = formato === "cuadrada" ? cuadrada.current : vertical.current;
    if (!lienzo || !elegido) return;
    try {
      descargar(await aBlob(lienzo), nombreArchivo(elegido, formato));
    } catch {
      setError("No se pudo crear la imagen. Pruebe con otra foto.");
    }
  }

  async function copiar() {
    if (!elegido) return;
    await navigator.clipboard.writeText(textoPublicacion(elegido, marca, conPrecio));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function descargarTodas() {
    setError(undefined);
    try {
      const { zipSync, strToU8 } = await import("fflate");
      const lienzo = document.createElement("canvas");
      const archivos: Record<string, [Uint8Array, { level: 0 }]> = {};
      const usados = new Set<string>();
      const textos: string[] = [];
      for (let i = 0; i < items.length; i++) {
        setProgreso(`Creando ${i + 1} de ${items.length}...`);
        const item = items[i];
        for (const formato of ["cuadrada", "vertical"] as Formato[]) {
          await dibujarPieza(lienzo, item, marca, formato, conPrecio);
          const blob = await aBlob(lienzo);
          let nombre = `${formato}/${nombreArchivo(item, formato)}`;
          if (usados.has(nombre)) nombre = nombre.replace(".jpg", `-${i + 1}.jpg`);
          usados.add(nombre);
          archivos[nombre] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
        }
        textos.push(textoPublicacion(item, marca, conPrecio));
      }
      archivos["textos-publicaciones.txt"] = [strToU8(textos.join("\n\n----------\n\n")), { level: 0 }];
      const zip = zipSync(archivos);
      descargar(new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }), `Redes ${marca.empresa}.zip`);
    } catch {
      setError("No se pudieron crear todas las imágenes. Intente de nuevo.");
    } finally {
      setProgreso(undefined);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">
        Todavía no hay productos publicados. Publíquelos en Portafolio para crear sus imágenes.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar producto o servicio..."
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200">
          {lista.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => setElegidoId(i.id)}
                className={`w-full px-4 py-2.5 text-left text-sm ${i.id === elegidoId ? "bg-blue-50 font-semibold text-blue-900" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {i.nombre}
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No hay coincidencias.</li>}
        </ul>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} className="size-4" />
            Mostrar precio
          </label>
          <button type="button" onClick={descargarTodas} disabled={Boolean(progreso)} className={botonPrimario}>
            {progreso ?? `Descargar todas (${items.length}) en ZIP`}
          </button>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}

        <div className="flex flex-wrap items-start gap-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <figure className="w-72 max-w-full space-y-2">
            <canvas ref={cuadrada} className="w-full rounded-lg ring-1 ring-slate-200" aria-label="Imagen cuadrada para publicación" />
            <figcaption className="text-xs text-slate-500">Publicación de Facebook e Instagram (1080 × 1080)</figcaption>
            <button type="button" onClick={() => bajar("cuadrada")} className={`${botonSecundario} w-full`}>
              Descargar cuadrada
            </button>
          </figure>
          <figure className="w-48 max-w-full space-y-2">
            <canvas ref={vertical} className="w-full rounded-lg ring-1 ring-slate-200" aria-label="Imagen vertical para historias" />
            <figcaption className="text-xs text-slate-500">Historias y estados (1080 × 1920)</figcaption>
            <button type="button" onClick={() => bajar("vertical")} className={`${botonSecundario} w-full`}>
              Descargar vertical
            </button>
          </figure>
          {elegido && (
            <div className="min-w-60 flex-1 space-y-2">
              <p className="text-sm font-medium text-slate-700">Texto de la publicación</p>
              <pre className="max-h-72 overflow-y-auto rounded-lg bg-slate-50 p-3 font-sans text-sm whitespace-pre-wrap text-slate-800 ring-1 ring-slate-200">
                {textoPublicacion(elegido, marca, conPrecio)}
              </pre>
              <button type="button" onClick={copiar} className={`${botonSecundario} w-full`}>
                {copiado ? "Copiado" : "Copiar texto"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
