"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { botonPrimario, botonSecundario } from "@/components/dialogo";
import { comprimirImagen } from "@/lib/imagenes";
import { dibujarAnuncio, plantillaSugerida, type MostrarAnuncio, type Plantilla } from "../anuncio";
import { aBlob, descargarBlob, dibujarPieza, nombreArchivo, textoPublicacion, type Formato, type ItemPieza, type MarcaPieza } from "../piezas";

const OPCIONES = [
  { valor: "creativo", texto: "Rediseñar como anuncio (cambia mucho la foto)" },
  { valor: "luz", texto: "Mejorar luz, color y nitidez" },
  { valor: "fondo", texto: "Limpiar el fondo" },
  { valor: "oficina", texto: "Ambiente de oficina moderna" },
  { valor: "graficos", texto: "Formas gráficas decorativas en los bordes" },
];

const ESTILOS = [
  { nombre: "Anuncio creativo (la IA rediseña)", opciones: ["creativo", "luz"] },
  { nombre: "Profesional", opciones: ["luz", "fondo"] },
  { nombre: "Natural (solo mejorar la foto)", opciones: ["luz"] },
  { nombre: "Oficina moderna", opciones: ["luz", "oficina"] },
  { nombre: "Publicitario", opciones: ["luz", "fondo", "graficos"] },
];

const PLANTILLAS: { valor: Plantilla | "ficha"; nombre: string }[] = [
  { valor: "contacto", nombre: "Textos de la IA + contacto" },
  { valor: "banda", nombre: "Banda inferior" },
  { valor: "arriba", nombre: "Título arriba" },
  { valor: "lateral", nombre: "Lateral" },
  { valor: "oferta", nombre: "Oferta" },
  { valor: "ficha", nombre: "Ficha sencilla" },
];

type Generar = (form: FormData) => Promise<{ imagen?: string; error?: string }>;
type Sugerir = (servicio: string, descripcion: string) => Promise<{ opciones?: { titulo: string; subtitulo: string }[]; error?: string }>;

const chip = (activo: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium ring-1 ${activo ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-700 ring-slate-300"}`;

export function MejorarConIA({
  items,
  marca,
  preciosInicial,
  generar,
  sugerir,
}: {
  items: ItemPieza[];
  marca: MarcaPieza;
  preciosInicial: boolean;
  generar: Generar;
  sugerir: Sugerir;
}) {
  // Los servicios primero: son lo que más se publica
  const ordenados = useMemo(() => [...items].sort((a, b) => Number(b.esServicio) - Number(a.esServicio) || a.nombre.localeCompare(b.nombre)), [items]);
  const [itemId, setItemId] = useState(ordenados[0]?.id ?? "");
  const [foto, setFoto] = useState<{ archivo: File; url: string; ancho: number; alto: number } | null>(null);
  const [opciones, setOpciones] = useState(ESTILOS[0].opciones);
  const [texto, setTexto] = useState("");
  const [textoIA, setTextoIA] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [plantilla, setPlantilla] = useState<Plantilla | "ficha">("banda");
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [sugerencias, setSugerencias] = useState<{ titulo: string; subtitulo: string }[]>([]);
  const [mostrar, setMostrar] = useState<MostrarAnuncio>({ logo: true, empresa: true, whatsapp: true, redes: true });
  const [conPrecio, setConPrecio] = useState(preciosInicial);
  const [error, setError] = useState<string>();
  const [copiado, setCopiado] = useState(false);
  const [generando, iniciar] = useTransition();
  const [sugiriendo, iniciarSugerir] = useTransition();
  const cuadrada = useRef<HTMLCanvasElement>(null);
  const vertical = useRef<HTMLCanvasElement>(null);

  const elegido = items.find((i) => i.id === itemId);
  const textos = useMemo(
    () => ({
      titulo: titulo.trim() || elegido?.nombre || "",
      subtitulo: subtitulo.trim(),
      precio: conPrecio && elegido ? elegido.precio : null,
    }),
    [titulo, subtitulo, conPrecio, elegido],
  );
  const pieza = useMemo(
    () => (elegido && resultado ? { ...elegido, fotoUrl: resultado, nombre: textos.titulo, descripcion: textos.subtitulo || elegido.descripcion } : null),
    [elegido, resultado, textos],
  );

  useEffect(() => {
    if (!pieza || !resultado || !cuadrada.current || !vertical.current) return;
    // Se dibuja aparte y solo se copia la última versión: evita que dos dibujos se mezclen
    let vigente = true;
    const dibujar = async (destino: HTMLCanvasElement, formato: Formato) => {
      const lienzo = document.createElement("canvas");
      if (plantilla === "ficha") await dibujarPieza(lienzo, pieza, marca, formato, conPrecio, mostrar);
      else await dibujarAnuncio(lienzo, resultado, textos, marca, plantilla, formato, mostrar);
      if (!vigente) return;
      destino.width = lienzo.width;
      destino.height = lienzo.height;
      destino.getContext("2d")!.drawImage(lienzo, 0, 0);
    };
    Promise.all([dibujar(cuadrada.current, "cuadrada"), dibujar(vertical.current, "vertical")]).catch(() => setError("No se pudo armar la pieza."));
    return () => {
      vigente = false;
    };
  }, [pieza, resultado, textos, marca, plantilla, mostrar, conPrecio]);

  function cambiarItem(id: string) {
    setItemId(id);
    setTitulo("");
    setSubtitulo("");
    setSugerencias([]);
  }

  async function elegirFoto(f: File | undefined) {
    if (!f) return;
    setError(undefined);
    setResultado(null);
    try {
      const archivo = await comprimirImagen(f, 1024);
      const imagen = await createImageBitmap(archivo);
      setFoto({ archivo, url: URL.createObjectURL(archivo), ancho: imagen.width, alto: imagen.height });
      setPlantilla(plantillaSugerida(imagen.width, imagen.height));
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
    form.set("servicio", elegido?.nombre ?? "");
    const escribeIA = textoIA && opciones.includes("creativo");
    if (escribeIA) {
      form.set("texto_ia", "1");
      form.set("titulo", textos.titulo);
    }
    opciones.forEach((o) => form.append("opciones", o));
    setError(undefined);
    iniciar(async () => {
      const r = await generar(form);
      if (r.imagen) {
        setResultado(r.imagen);
        // Si la IA ya escribió los textos, el CRM solo agrega logo y contacto
        setPlantilla(escribeIA ? "contacto" : (p) => (p === "contacto" ? "banda" : p));
      } else setError(r.error ?? "No se pudo mejorar la foto.");
    });
  }

  function pedirTextos() {
    if (!elegido) return;
    setError(undefined);
    iniciarSugerir(async () => {
      const r = await sugerir(elegido.nombre, elegido.descripcion ?? "");
      if (r.opciones) setSugerencias(r.opciones);
      else setError(r.error ?? "No se pudieron sugerir textos.");
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

  const casilla = (clave: keyof MostrarAnuncio, nombre: string) => (
    <label key={clave} className="flex items-center gap-2">
      <input type="checkbox" checked={mostrar[clave]} onChange={(e) => setMostrar((m) => ({ ...m, [clave]: e.target.checked }))} className="size-4" />
      {nombre}
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4 self-start rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <label className="block text-sm font-medium text-slate-700">
          Servicio o producto
          <select value={itemId} onChange={(e) => cambiarItem(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
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
          <legend className="font-medium">Estilo de la foto</legend>
          <div className="flex flex-wrap gap-2">
            {ESTILOS.map((e) => (
              <button key={e.nombre} type="button" onClick={() => setOpciones(e.opciones)} className={chip([...e.opciones].sort().join() === [...opciones].sort().join())}>
                {e.nombre}
              </button>
            ))}
          </div>
        </fieldset>
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
          Indicación adicional para la foto (opcional)
          <span className="block text-xs font-normal text-slate-500">Los textos y los datos de la empresa se ponen abajo, no aquí.</span>
          <textarea
            rows={2}
            maxLength={300}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
          />
        </label>
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <label className="block text-sm font-medium text-slate-700">
            Título del anuncio
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={elegido?.nombre}
              maxLength={60}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Subtítulo
            <input
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
            />
          </label>
          <button type="button" onClick={pedirTextos} disabled={sugiriendo} className={`${botonSecundario} w-full`}>
            {sugiriendo ? "Pensando textos..." : "Sugerir textos con IA"}
          </button>
          {sugerencias.length > 0 && (
            <div className="space-y-2">
              {sugerencias.map((s) => (
                <button
                  key={s.titulo}
                  type="button"
                  onClick={() => {
                    setTitulo(s.titulo);
                    setSubtitulo(s.subtitulo);
                  }}
                  className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm ring-1 ring-slate-200 hover:bg-blue-50 hover:ring-blue-300"
                >
                  <span className="block font-semibold text-slate-900">{s.titulo}</span>
                  <span className="text-slate-600">{s.subtitulo}</span>
                </button>
              ))}
            </div>
          )}
          <label className={`flex items-start gap-2 text-sm ${opciones.includes("creativo") ? "text-slate-700" : "text-slate-400"}`}>
            <input
              type="checkbox"
              checked={textoIA}
              disabled={!opciones.includes("creativo")}
              onChange={(e) => setTextoIA(e.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              Que la IA escriba el título dentro de la imagen (experimental)
              <span className="block text-xs text-slate-500">
                La IA gratis a veces escribe mal las palabras. Úselo con títulos de 2 a 4 palabras; si no, deje que el CRM ponga los textos.
              </span>
            </span>
          </label>
        </div>
        <button type="button" onClick={crear} disabled={!foto || generando} className={`${botonPrimario} w-full py-2.5`}>
          {generando ? "Generando..." : resultado ? "Generar otra versión" : "Mejorar foto"}
        </button>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}
        <p className="text-xs text-slate-500">Revise que la IA no cambie ni agregue equipos. No suba fotos con rostros, placas o datos de clientes.</p>
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
          <div className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            {plantilla === "contacto" && (
              <p className="text-sm text-slate-600">
                Los textos los escribió la IA dentro de la foto; revise que estén bien escritos. Si salen con errores, pulse «Generar otra versión» o elija otra plantilla
                para que el CRM los ponga.
              </p>
            )}
            <fieldset className="space-y-2 text-sm text-slate-700">
              <legend className="font-medium">Plantilla</legend>
              <div className="flex flex-wrap gap-2">
                {PLANTILLAS.map((p) => (
                  <button key={p.valor} type="button" onClick={() => setPlantilla(p.valor)} className={chip(plantilla === p.valor)}>
                    {p.nombre}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-700">
              <legend className="mb-2 font-medium">Incluir en la imagen</legend>
              {casilla("logo", "Logo")}
              {casilla("empresa", "Nombre (si no hay logo)")}
              {casilla("whatsapp", "WhatsApp")}
              {casilla("redes", "Instagram y Facebook")}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} className="size-4" />
                Precio
              </label>
            </fieldset>
            {mostrar.logo && !marca.logoUrl && <p className="text-sm text-amber-800">Esta empresa aún no tiene logo. Súbalo en Portafolio para que aparezca.</p>}
            {mostrar.redes && !marca.instagram && !marca.facebook && (
              <p className="text-sm text-amber-800">Agregue los enlaces de Instagram y Facebook en Portafolio para que aparezcan.</p>
            )}

            <div className="flex flex-wrap items-start gap-5">
              <figure className="w-80 max-w-full space-y-2">
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
