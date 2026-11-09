"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { botonPrimario, botonSecundario } from "@/components/dialogo";
import { comprimirImagen } from "@/lib/imagenes";
import { aBlob, descargarBlob, dibujarPieza, nombreArchivo, textoPublicacion, type Formato, type ItemPieza, type MarcaPieza } from "../piezas";

const OPCIONES = [
  { valor: "luz", texto: "Mejorar luz, color y nitidez" },
  { valor: "fondo", texto: "Limpiar el fondo" },
  { valor: "oficina", texto: "Ambiente de oficina moderna" },
  { valor: "graficos", texto: "Formas gráficas decorativas en los bordes" },
];

type Generar = (form: FormData) => Promise<{ imagen?: string; error?: string }>;

export function MejorarConIA({
  items,
  marca,
  preciosInicial,
  generar,
}: {
  items: ItemPieza[];
  marca: MarcaPieza;
  preciosInicial: boolean;
  generar: Generar;
}) {
  // Los servicios primero: son lo que más se publica
  const ordenados = useMemo(() => [...items].sort((a, b) => Number(b.esServicio) - Number(a.esServicio) || a.nombre.localeCompare(b.nombre)), [items]);
  const [itemId, setItemId] = useState(ordenados[0]?.id ?? "");
  const [foto, setFoto] = useState<{ archivo: File; url: string; ancho: number; alto: number } | null>(null);
  const [opciones, setOpciones] = useState(["luz"]);
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [conPrecio, setConPrecio] = useState(preciosInicial);
  const [error, setError] = useState<string>();
  const [copiado, setCopiado] = useState(false);
  const [generando, iniciar] = useTransition();
  const cuadrada = useRef<HTMLCanvasElement>(null);
  const vertical = useRef<HTMLCanvasElement>(null);

  const elegido = items.find((i) => i.id === itemId);
  const pieza = useMemo(() => (elegido && resultado ? { ...elegido, fotoUrl: resultado } : null), [elegido, resultado]);

  useEffect(() => {
    if (!pieza || !cuadrada.current || !vertical.current) return;
    Promise.all([
      dibujarPieza(cuadrada.current, pieza, marca, "cuadrada", conPrecio),
      dibujarPieza(vertical.current, pieza, marca, "vertical", conPrecio),
    ]).catch(() => setError("No se pudo armar la pieza."));
  }, [pieza, marca, conPrecio]);

  async function elegirFoto(f: File | undefined) {
    if (!f) return;
    setError(undefined);
    setResultado(null);
    try {
      const archivo = await comprimirImagen(f, 1024);
      const imagen = await createImageBitmap(archivo);
      setFoto({ archivo, url: URL.createObjectURL(archivo), ancho: imagen.width, alto: imagen.height });
    } catch {
      setError("No se pudo abrir la foto. Use JPG, PNG o WEBP.");
    }
  }

  function crear() {
    if (!foto) return;
    const form = new FormData();
    form.set("archivo", foto.archivo);
    form.set("ancho", String(foto.ancho));
    form.set("alto", String(foto.alto));
    form.set("color", marca.color);
    form.set("texto", texto);
    opciones.forEach((o) => form.append("opciones", o));
    setError(undefined);
    iniciar(async () => {
      const r = await generar(form);
      if (r.imagen) setResultado(r.imagen);
      else setError(r.error ?? "No se pudo mejorar la foto.");
    });
  }

  async function bajar(formato: Formato) {
    const lienzo = formato === "cuadrada" ? cuadrada.current : vertical.current;
    if (lienzo && pieza) descargarBlob(await aBlob(lienzo), nombreArchivo(pieza, formato));
  }

  async function bajarMejorada() {
    if (resultado) descargarBlob(await (await fetch(resultado)).blob(), "foto-mejorada.jpg");
  }

  async function copiar() {
    if (!pieza) return;
    await navigator.clipboard.writeText(textoPublicacion(pieza, marca, conPrecio));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">
        Publique un servicio o producto en Portafolio para usarlo aquí.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4 self-start rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <label className="block text-sm font-medium text-slate-700">
          Servicio o producto
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
            {ordenados.map((i) => (
              <option key={i.id} value={i.id}>
                {i.esServicio ? "Servicio: " : ""}
                {i.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Foto del trabajo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => elegirFoto(e.target.files?.[0])}
            className="mt-1 block w-full text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <fieldset className="space-y-2 text-sm text-slate-700">
          <legend className="font-medium">Qué hacer</legend>
          {OPCIONES.map((o) => (
            <label key={o.valor} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={opciones.includes(o.valor)}
                onChange={(e) => setOpciones((a) => (e.target.checked ? [...a, o.valor] : a.filter((x) => x !== o.valor)))}
                className="size-4"
              />
              {o.texto}
            </label>
          ))}
        </fieldset>
        <label className="block text-sm font-medium text-slate-700">
          Indicación adicional (opcional)
          <textarea
            rows={3}
            maxLength={300}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
          />
        </label>
        <button type="button" onClick={crear} disabled={!foto || generando} className={`${botonPrimario} w-full py-2.5`}>
          {generando ? "Generando..." : resultado ? "Generar otra versión" : "Mejorar foto"}
        </button>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}
        <p className="text-xs text-slate-500">
          Revise que la IA no cambie ni agregue equipos. No suba fotos con rostros, placas o datos de clientes.
        </p>
      </div>

      <div className="space-y-4">
        {foto ? (
          <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-2">
            <figure className="space-y-2">
              <figcaption className="text-sm font-medium text-slate-700">Original</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local */}
              <img src={foto.url} alt="Foto original" className="w-full rounded-lg ring-1 ring-slate-200" />
            </figure>
            <figure className="space-y-2">
              <figcaption className="text-sm font-medium text-slate-700">Mejorada</figcaption>
              {resultado ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en esta sesión */}
                  <img src={resultado} alt="Foto mejorada con IA" className="w-full rounded-lg ring-1 ring-slate-200" />
                  <button type="button" onClick={bajarMejorada} className={`${botonSecundario} w-full`}>
                    Descargar foto mejorada
                  </button>
                </>
              ) : (
                <p className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 p-6 text-center text-sm text-slate-500">
                  {generando ? "La IA está trabajando..." : "Aquí aparecerá el resultado"}
                </p>
              )}
            </figure>
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">Suba una foto para empezar.</p>
        )}

        {pieza && (
          <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} className="size-4" />
              Mostrar precio
            </label>
            <div className="flex flex-wrap items-start gap-5">
              <figure className="w-72 max-w-full space-y-2">
                <canvas ref={cuadrada} className="w-full rounded-lg ring-1 ring-slate-200" aria-label="Imagen cuadrada" />
                <button type="button" onClick={() => bajar("cuadrada")} className={`${botonSecundario} w-full`}>
                  Descargar cuadrada
                </button>
              </figure>
              <figure className="w-48 max-w-full space-y-2">
                <canvas ref={vertical} className="w-full rounded-lg ring-1 ring-slate-200" aria-label="Imagen vertical" />
                <button type="button" onClick={() => bajar("vertical")} className={`${botonSecundario} w-full`}>
                  Descargar vertical
                </button>
              </figure>
              <div className="min-w-60 flex-1 space-y-2">
                <pre className="max-h-72 overflow-y-auto rounded-lg bg-slate-50 p-3 font-sans text-sm whitespace-pre-wrap text-slate-800 ring-1 ring-slate-200">
                  {textoPublicacion(pieza, marca, conPrecio)}
                </pre>
                <button type="button" onClick={copiar} className={`${botonSecundario} w-full`}>
                  {copiado ? "Copiado" : "Copiar texto"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
