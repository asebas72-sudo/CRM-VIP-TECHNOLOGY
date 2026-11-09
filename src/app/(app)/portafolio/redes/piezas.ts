import { createElement } from "react";
import { iconosIlustracion } from "@/components/ilustracion-producto";
import { pesos } from "@/lib/formato";

/** Imágenes para Facebook e Instagram, dibujadas en el navegador con los datos del portafolio. */

export type ItemPieza = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  etiqueta: "oferta" | "nuevo" | null;
  disponibilidad: "disponible" | "pocas" | "por_pedido";
  fotoUrl: string | null;
  esServicio: boolean;
};

export type MarcaPieza = {
  empresa: string;
  color: string;
  logoUrl: string | null;
  whatsapp: string | null;
  enlace: string;
};

export type Formato = "cuadrada" | "vertical";

const MEDIDAS = {
  // Vertical: encabezado y pie altos para respetar las zonas que tapan las historias
  cuadrada: { alto: 1080, encabezado: 150, pie: 130, imagen: 470, nombre: 50, lineas: 2, precio: 84, logo: 100, y: 0 },
  vertical: { alto: 1920, encabezado: 300, pie: 320, imagen: 800, nombre: 66, lineas: 3, precio: 116, logo: 130, y: 110 },
};

const FUENTE = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
const ANCHO = 1080;
const MARGEN = 60;

function textoSobre(color: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? "#0f172a" : "#ffffff";
}

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((listo) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => listo(img);
    img.onerror = () => listo(null);
    img.src = url;
  });
}

async function imagenIlustracion(item: ItemPieza, color: string): Promise<HTMLImageElement[]> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const iconos = iconosIlustracion(item.nombre, item.esServicio);
  const dibujos = await Promise.all(
    iconos.map((Icono) => {
      const svg = renderToStaticMarkup(createElement(Icono, { size: 600, color, strokeWidth: 1.25 }));
      return cargarImagen(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    }),
  );
  return dibujos.filter((d): d is HTMLImageElement => d !== null);
}

function encajar(ctx: CanvasRenderingContext2D, img: CanvasImageSource, ancho: number, alto: number, x: number, y: number, w: number, h: number) {
  const escala = Math.min(w / ancho, h / alto);
  const [dw, dh] = [ancho * escala, alto * escala];
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function lineasDeTexto(ctx: CanvasRenderingContext2D, texto: string, maximo: number, lineas: number): string[] {
  const palabras = texto.trim().split(/\s+/);
  const salida: string[] = [];
  let actual = "";
  let i = 0;
  for (; i < palabras.length; i++) {
    const prueba = actual ? `${actual} ${palabras[i]}` : palabras[i];
    if (ctx.measureText(prueba).width <= maximo) {
      actual = prueba;
      continue;
    }
    if (salida.length === lineas - 1) break;
    if (actual) salida.push(actual);
    actual = palabras[i];
  }
  if (i < palabras.length) {
    while (actual && ctx.measureText(`${actual}…`).width > maximo) actual = actual.slice(0, -1).trimEnd();
    actual = `${actual}…`;
  }
  if (actual) salida.push(actual);
  return salida;
}

function textoAjustado(ctx: CanvasRenderingContext2D, texto: string, maximo: number, peso: string, tamano: number): void {
  let t = tamano;
  do {
    ctx.font = `${peso} ${t}px ${FUENTE}`;
    t -= 2;
  } while (ctx.measureText(texto).width > maximo && t > 20);
}

function rectanguloRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

const TEXTO_DISPONIBILIDAD = { disponible: "", pocas: "Pocas unidades", por_pedido: "Por pedido" };

export type MostrarPieza = { logo: boolean; empresa: boolean; whatsapp: boolean };
const MOSTRAR_TODO: MostrarPieza = { logo: true, empresa: true, whatsapp: true };

export async function dibujarPieza(
  canvas: HTMLCanvasElement,
  item: ItemPieza,
  marca: MarcaPieza,
  formato: Formato,
  conPrecio: boolean,
  mostrar: MostrarPieza = MOSTRAR_TODO,
) {
  const m = MEDIDAS[formato];
  canvas.width = ANCHO;
  canvas.height = m.alto;
  const ctx = canvas.getContext("2d")!;
  const sobreColor = textoSobre(marca.color);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ANCHO, m.alto);

  // Encabezado con el logo y el nombre de la empresa
  if (mostrar.logo || mostrar.empresa) {
    ctx.fillStyle = marca.color;
    ctx.fillRect(0, 0, ANCHO, m.encabezado);
  }
  const centro = m.y + (m.encabezado - m.y) / 2;
  let xTexto = MARGEN;
  const logo = mostrar.logo && marca.logoUrl ? await cargarImagen(marca.logoUrl) : null;
  if (logo) {
    const h = m.logo;
    const w = Math.min((logo.width / logo.height) * h, 300);
    ctx.fillStyle = "#ffffff";
    rectanguloRedondeado(ctx, MARGEN, centro - h / 2 - 8, w + 32, h + 16, 16);
    encajar(ctx, logo, logo.width, logo.height, MARGEN + 16, centro - h / 2, w, h);
    xTexto = MARGEN + w + 60;
  }
  if (mostrar.empresa) {
    ctx.fillStyle = sobreColor;
    ctx.textBaseline = "middle";
    textoAjustado(ctx, marca.empresa, ANCHO - xTexto - MARGEN, "700", formato === "vertical" ? 64 : 52);
    ctx.fillText(marca.empresa, xTexto, centro);
    ctx.textBaseline = "alphabetic";
  }

  // Foto real o ilustración
  const yImagen = m.encabezado + 30;
  const ladoImagen = ANCHO - MARGEN * 2;
  ctx.fillStyle = `${marca.color}14`;
  rectanguloRedondeado(ctx, MARGEN, yImagen, ladoImagen, m.imagen, 28);
  const foto = item.fotoUrl ? await cargarImagen(item.fotoUrl) : null;
  if (foto) {
    encajar(ctx, foto, foto.width, foto.height, MARGEN + 20, yImagen + 20, ladoImagen - 40, m.imagen - 40);
  } else {
    const dibujos = await imagenIlustracion(item, marca.color);
    const tamano = m.imagen * 0.62;
    const principal = dibujos.length > 1 ? tamano * 0.85 : tamano;
    const secundario = tamano * 0.5;
    const total = principal + (dibujos.length > 1 ? secundario + 20 : 0);
    let x = (ANCHO - total) / 2;
    dibujos.forEach((d, i) => {
      const t = i === 0 ? principal : secundario;
      ctx.drawImage(d, x, yImagen + (m.imagen - t) / 2, t, t);
      x += t + 20;
    });
  }

  if (item.etiqueta) {
    const texto = item.etiqueta === "oferta" ? "OFERTA" : "NUEVO";
    ctx.font = `700 ${formato === "vertical" ? 44 : 36}px ${FUENTE}`;
    const ancho = ctx.measureText(texto).width + 56;
    const alto = formato === "vertical" ? 80 : 66;
    ctx.fillStyle = marca.color;
    rectanguloRedondeado(ctx, MARGEN + 24, yImagen + 24, ancho, alto, alto / 2);
    ctx.fillStyle = sobreColor;
    ctx.textBaseline = "middle";
    ctx.fillText(texto, MARGEN + 52, yImagen + 24 + alto / 2 + 2);
    ctx.textBaseline = "alphabetic";
  }

  // Nombre y precio
  let y = yImagen + m.imagen + 28 + m.nombre;
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 ${m.nombre}px ${FUENTE}`;
  for (const linea of lineasDeTexto(ctx, item.nombre, ANCHO - MARGEN * 2, m.lineas)) {
    ctx.fillText(linea, MARGEN, y);
    y += m.nombre * 1.2;
  }

  const yPrecio = m.alto - m.pie - 34;
  ctx.fillStyle = marca.color === "#ffffff" ? "#0f172a" : marca.color;
  ctx.font = `800 ${conPrecio ? m.precio : Math.round(m.precio * 0.7)}px ${FUENTE}`;
  const textoPrecio = conPrecio ? pesos(item.precio) : "Cotice con nosotros";
  ctx.fillText(textoPrecio, MARGEN, yPrecio);
  const aviso = item.esServicio ? "" : TEXTO_DISPONIBILIDAD[item.disponibilidad];
  if (aviso) {
    const xAviso = MARGEN + ctx.measureText(textoPrecio).width + 32;
    ctx.fillStyle = "#475569";
    ctx.font = `600 ${Math.round(m.nombre * 0.76)}px ${FUENTE}`;
    ctx.fillText(aviso, xAviso, yPrecio);
  }

  // Pie con los datos de contacto
  const yPie = m.alto - m.pie;
  ctx.fillStyle = marca.color;
  ctx.fillRect(0, yPie, ANCHO, m.pie);
  ctx.fillStyle = sobreColor;
  ctx.textBaseline = "middle";
  const principal = mostrar.whatsapp && marca.whatsapp ? `Cotice por WhatsApp ${marca.whatsapp}` : "Cotice con nosotros";
  const altoPie = formato === "vertical" ? 170 : m.pie;
  textoAjustado(ctx, principal, ANCHO - MARGEN * 2, "700", formato === "vertical" ? 50 : 42);
  ctx.textAlign = "center";
  ctx.fillText(principal, ANCHO / 2, yPie + altoPie / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function etiquetaHash(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
}

/** Texto listo para pegar en la publicación (sin emojis). */
export function textoPublicacion(item: ItemPieza, marca: MarcaPieza, conPrecio: boolean): string {
  const lineas = [item.nombre];
  if (item.descripcion) lineas.push("", item.descripcion);
  lineas.push("");
  if (conPrecio) lineas.push(`Precio: ${pesos(item.precio)}`);
  const aviso = item.esServicio ? "" : TEXTO_DISPONIBILIDAD[item.disponibilidad];
  if (aviso) lineas.push(aviso);
  if (marca.whatsapp) lineas.push(`Cotice por WhatsApp: ${marca.whatsapp}`);
  lineas.push(`Vea todo nuestro portafolio: ${marca.enlace}`, "");
  lineas.push(`#${etiquetaHash(marca.empresa)} #Tecnologia #${item.esServicio ? "ServicioTecnico" : "Colombia"}`);
  return lineas.join("\n");
}

export function nombreArchivo(item: ItemPieza, formato: Formato): string {
  const base = etiquetaHash(item.nombre).slice(0, 50) || item.id;
  return `${base}-${formato}.jpg`;
}

export function descargarBlob(blob: Blob, nombre: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function aBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((listo, fallo) => canvas.toBlob((b) => (b ? listo(b) : fallo(new Error("No se pudo crear la imagen"))), "image/jpeg", 0.92));
}
