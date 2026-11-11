import { pesos } from "@/lib/formato";
import {
  cargarImagen,
  encajar,
  FUENTE,
  lineasDeTexto,
  rectanguloRedondeado,
  textoAjustado,
  textoSobre,
  type Formato,
  type MarcaPieza,
  type MostrarPieza,
} from "./piezas";

/** Anuncios para redes al estilo publicitario: foto completa, título grande y datos de contacto. */

export type Plantilla = "banda" | "arriba" | "lateral" | "oferta" | "contacto";
export type MostrarAnuncio = MostrarPieza & { redes: boolean };
export type TextosAnuncio = { titulo: string; subtitulo: string; precio: number | null };

const ANCHO = 1080;
const MARGEN = 50;

/** Plantilla sugerida según la forma de la foto. */
export function plantillaSugerida(ancho: number, alto: number): Plantilla {
  return ancho / alto >= 1.3 ? "lateral" : "banda";
}

// Íconos propios (dibujos sencillos, no los logos oficiales de cada red)
function svgIcono(tipo: "whatsapp" | "instagram" | "facebook", color: string, fondo: string): string {
  const cuerpo = {
    whatsapp: `<path d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.3z" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/><path d="M9 8.5c0 3.2 3.3 6.5 6.5 6.5l1-1.6-2-1-1 .9c-1.2-.6-2.2-1.6-2.8-2.8l.9-1-1-2z" fill="${color}"/>`,
    instagram: `<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="${color}" stroke-width="2"/><circle cx="12" cy="12" r="4.3" fill="none" stroke="${color}" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.2" fill="${color}"/>`,
    facebook: `<circle cx="12" cy="12" r="10.5" fill="${color}"/><path d="M13.4 20.5v-6.6h2.2l.4-2.6h-2.6V9.7c0-.8.3-1.3 1.4-1.3H16V6.1c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.4v1.9H8.4v2.6h2.2v6.6z" fill="${fondo}"/>`,
  }[tipo];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">${cuerpo}</svg>`;
}

function usuarioRed(valor: string | null | undefined, conArroba: boolean): string | null {
  const t = (valor ?? "").trim();
  if (!t) return null;
  let usuario = t;
  if (/^https?:\/\//i.test(t) || /\.(com|me)\b/i.test(t)) {
    try {
      const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
      usuario = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return null;
    }
  }
  usuario = usuario.replace(/^@/, "");
  if (!usuario || usuario === "profile.php") return null;
  return conArroba ? `@${usuario}` : usuario;
}

type Dato = { icono: "whatsapp" | "instagram" | "facebook"; texto: string };

function datosContacto(marca: MarcaPieza, mostrar: MostrarAnuncio): Dato[] {
  const datos: Dato[] = [];
  if (mostrar.whatsapp && marca.whatsapp) datos.push({ icono: "whatsapp", texto: marca.whatsapp });
  if (mostrar.redes) {
    const ig = usuarioRed(marca.instagram, true);
    const fb = usuarioRed(marca.facebook, false);
    if (ig) datos.push({ icono: "instagram", texto: ig });
    if (fb) datos.push({ icono: "facebook", texto: fb });
  }
  return datos;
}

function cubrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const escala = Math.max(w / img.width, h / img.height);
  const [sw, sh] = [w / escala, h / escala];
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function degradado(ctx: CanvasRenderingContext2D, y0: number, y1: number, desde: number, hasta: number, alto: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(0,0,0,${desde})`);
  g.addColorStop(1, `rgba(0,0,0,${hasta})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.min(y0, y1), ANCHO, Math.min(Math.abs(y1 - y0), alto));
}

/** Logo (o nombre de la empresa) en una cápsula blanca. Devuelve el alto usado. */
async function dibujarMarca(ctx: CanvasRenderingContext2D, marca: MarcaPieza, mostrar: MostrarAnuncio, x: number, y: number, alto: number, alDerecha: boolean): Promise<number> {
  const logo = mostrar.logo && marca.logoUrl ? await cargarImagen(marca.logoUrl) : null;
  if (logo) {
    const w = Math.min((logo.width / logo.height) * alto, 320);
    const px = alDerecha ? x - w - 32 : x;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    rectanguloRedondeado(ctx, px, y, w + 32, alto + 20, 18);
    encajar(ctx, logo, logo.width, logo.height, px + 16, y + 10, w, alto);
    return alto + 20;
  }
  if (mostrar.empresa) {
    ctx.font = `800 ${Math.round(alto * 0.42)}px ${FUENTE}`;
    const w = ctx.measureText(marca.empresa).width;
    const px = alDerecha ? x - w - 40 : x;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    rectanguloRedondeado(ctx, px, y, w + 40, alto * 0.75, 16);
    ctx.fillStyle = "#0f172a";
    ctx.textBaseline = "middle";
    ctx.fillText(marca.empresa, px + 20, y + (alto * 0.75) / 2);
    ctx.textBaseline = "alphabetic";
    return alto * 0.75;
  }
  return 0;
}

/** Tamaño del título para que ninguna palabra se salga del ancho. */
function tamTituloAjustado(ctx: CanvasRenderingContext2D, titulo: string, ancho: number, tam: number): number {
  const palabras = titulo.toUpperCase().split(/\s+/).filter(Boolean);
  let t = tam;
  const cabe = () => {
    ctx.font = `900 ${t}px ${FUENTE}`;
    return palabras.every((p) => ctx.measureText(p).width <= ancho);
  };
  while (!cabe() && t > 24) t -= 2;
  return t;
}

/** El título cabe completo (sin "…") en máximo 3 líneas. */
function tituloCompleto(ctx: CanvasRenderingContext2D, titulo: string, ancho: number, tamTitulo: number): boolean {
  const tam = tamTituloAjustado(ctx, titulo, ancho, tamTitulo);
  ctx.font = `900 ${tam}px ${FUENTE}`;
  return lineasDeTexto(ctx, titulo.toUpperCase(), ancho, 10).length <= 3;
}

/** Alto que ocupa el bloque de título y subtítulo. */
function altoTextos(ctx: CanvasRenderingContext2D, t: TextosAnuncio, ancho: number, tamTitulo: number, tamSub: number, subtituloEnCaja: boolean): number {
  let alto = 0;
  if (t.subtitulo.trim()) {
    ctx.font = `600 ${tamSub}px ${FUENTE}`;
    alto += lineasDeTexto(ctx, t.subtitulo, ancho - (subtituloEnCaja ? 40 : 0), 3).length * tamSub * 1.25 + (subtituloEnCaja ? 30 : 0) + 22;
  }
  const tam = tamTituloAjustado(ctx, t.titulo, ancho, tamTitulo);
  ctx.font = `900 ${tam}px ${FUENTE}`;
  return alto + lineasDeTexto(ctx, t.titulo.toUpperCase(), ancho, 3).length * tam * 1.08;
}

/** Bloque de título y subtítulo hacia arriba desde `base`. Devuelve la y superior. */
function bloqueTextos(
  ctx: CanvasRenderingContext2D,
  t: TextosAnuncio,
  color: string,
  x: number,
  base: number,
  ancho: number,
  tamTitulo: number,
  tamSub: number,
  colorTitulo: string,
  subtituloEnCaja: boolean,
): number {
  let y = base;
  ctx.textBaseline = "alphabetic";
  if (t.subtitulo.trim()) {
    ctx.font = `600 ${tamSub}px ${FUENTE}`;
    const lineas = lineasDeTexto(ctx, t.subtitulo, ancho - (subtituloEnCaja ? 40 : 0), 3);
    const alto = lineas.length * tamSub * 1.25 + (subtituloEnCaja ? 30 : 0);
    y -= alto;
    if (subtituloEnCaja) {
      const w = Math.max(...lineas.map((l) => ctx.measureText(l).width)) + 40;
      ctx.fillStyle = color;
      rectanguloRedondeado(ctx, x, y, w, alto, 14);
      ctx.fillStyle = textoSobre(color);
    } else ctx.fillStyle = colorTitulo;
    lineas.forEach((l, i) => ctx.fillText(l, x + (subtituloEnCaja ? 20 : 0), y + (subtituloEnCaja ? 15 : 0) + tamSub * (i + 1) * 1.15));
    y -= 22;
  }
  const tam = tamTituloAjustado(ctx, t.titulo, ancho, tamTitulo);
  ctx.font = `900 ${tam}px ${FUENTE}`;
  const lineas = lineasDeTexto(ctx, t.titulo.toUpperCase(), ancho, 3);
  y -= lineas.length * tam * 1.08;
  ctx.fillStyle = colorTitulo;
  ctx.shadowColor = colorTitulo === "#ffffff" ? "rgba(0,0,0,0.45)" : "transparent";
  ctx.shadowBlur = 12;
  lineas.forEach((l, i) => ctx.fillText(l, x, y + tam * (i + 1) * 1.02));
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  return y;
}

async function iconos(datos: Dato[], color: string, fondo: string) {
  return Promise.all(datos.map((d) => cargarImagen(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgIcono(d.icono, color, fondo))}`)));
}

/** Lista de contacto vertical; con caja oscura si se pide. Se dibuja hacia arriba desde `base`. */
async function contactoVertical(
  ctx: CanvasRenderingContext2D,
  datos: Dato[],
  x: number,
  base: number,
  ancho: number,
  tam: number,
  colorTexto: string,
  conCaja: boolean,
): Promise<number> {
  if (datos.length === 0) return base;
  const fila = tam * 1.7;
  const alto = 34 + tam * 1.1 + datos.length * fila + (conCaja ? 24 : 0);
  const y = base - alto;
  if (conCaja) {
    ctx.fillStyle = "rgba(15,23,42,0.62)";
    rectanguloRedondeado(ctx, x, y, ancho, alto, 22);
  }
  const pad = conCaja ? 26 : 0;
  ctx.fillStyle = colorTexto;
  ctx.font = `800 ${Math.round(tam * 0.9)}px ${FUENTE}`;
  ctx.fillText("CONTÁCTENOS", x + pad, y + 24 + tam);
  const fondo = conCaja ? "#0f172a" : colorTexto === "#ffffff" ? "#0f172a" : "#ffffff";
  const imgs = await iconos(datos, colorTexto, fondo);
  datos.forEach((d, i) => {
    const yFila = y + 34 + tam * 1.1 + i * fila;
    const img = imgs[i];
    if (img) ctx.drawImage(img, x + pad, yFila + (fila - tam * 1.15) / 2, tam * 1.15, tam * 1.15);
    ctx.fillStyle = colorTexto;
    textoAjustado(ctx, d.texto, ancho - pad * 2 - tam * 1.6, "600", tam);
    ctx.textBaseline = "middle";
    ctx.fillText(d.texto, x + pad + tam * 1.6, yFila + fila / 2);
    ctx.textBaseline = "alphabetic";
  });
  return y;
}

/** Contacto en una franja horizontal centrada. */
async function contactoHorizontal(ctx: CanvasRenderingContext2D, datos: Dato[], centroY: number, tam: number, colorTexto: string, fondo: string) {
  if (datos.length === 0) return;
  const imgs = await iconos(datos, colorTexto, fondo);
  let t = tam;
  const medir = () => {
    ctx.font = `700 ${t}px ${FUENTE}`;
    return datos.reduce((s, d) => s + t * 1.5 + ctx.measureText(d.texto).width, 0) + (datos.length - 1) * t * 1.4;
  };
  while (medir() > ANCHO - MARGEN * 2 && t > 20) t -= 2;
  let x = (ANCHO - medir()) / 2;
  ctx.fillStyle = colorTexto;
  ctx.textBaseline = "middle";
  datos.forEach((d, i) => {
    const img = imgs[i];
    if (img) ctx.drawImage(img, x, centroY - t * 0.6, t * 1.2, t * 1.2);
    x += t * 1.5;
    ctx.fillText(d.texto, x, centroY);
    x += ctx.measureText(d.texto).width + t * 1.4;
  });
  ctx.textBaseline = "alphabetic";
}

export async function dibujarAnuncio(
  canvas: HTMLCanvasElement,
  fotoUrl: string,
  textos: TextosAnuncio,
  marca: MarcaPieza,
  plantilla: Plantilla,
  formato: Formato,
  mostrar: MostrarAnuncio,
) {
  const vertical = formato === "vertical";
  const alto = vertical ? 1920 : 1080;
  canvas.width = ANCHO;
  canvas.height = alto;
  const ctx = canvas.getContext("2d")!;
  // Zonas que tapan las historias de Instagram y Facebook
  const arriba = vertical ? 230 : MARGEN;
  const abajo = vertical ? alto - 290 : alto - MARGEN;
  const foto = await cargarImagen(fotoUrl);
  const datos = datosContacto(marca, mostrar);
  const color = marca.color;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, ANCHO, alto);

  if (plantilla === "contacto") {
    // La IA ya escribió los textos: la imagen va completa (sin recortar) y solo se agregan logo y contacto
    const franja = datos.length ? (vertical ? 170 : 110) : 0;
    if (foto) {
      ctx.filter = "blur(40px) brightness(0.45)";
      cubrir(ctx, foto, -80, -80, ANCHO + 160, alto + 160);
      ctx.filter = "none";
    }
    const yFranja = vertical ? abajo - franja + 60 : alto - franja;
    const y0 = vertical ? arriba + 150 : 0;
    if (foto) encajar(ctx, foto, foto.width, foto.height, 0, y0, ANCHO, (datos.length ? yFranja : vertical ? abajo : alto) - y0);
    if (vertical) await dibujarMarca(ctx, marca, mostrar, MARGEN, arriba, 110, false);
    else await dibujarMarca(ctx, marca, mostrar, ANCHO - MARGEN + 20, 30, 64, true);
    if (datos.length) {
      ctx.fillStyle = color;
      ctx.fillRect(0, yFranja, ANCHO, alto - yFranja);
      await contactoHorizontal(ctx, datos, yFranja + (vertical ? franja - 60 : franja) / 2, vertical ? 42 : 34, textoSobre(color), color);
    }
    // La IA solo escribe el título; el subtítulo lo pone el CRM sobre la parte baja de la imagen
    if (textos.subtitulo.trim()) {
      const tam = vertical ? 44 : 34;
      const base = (datos.length ? yFranja : vertical ? abajo : alto) - 30;
      ctx.font = `600 ${tam}px ${FUENTE}`;
      const lineas = lineasDeTexto(ctx, textos.subtitulo, ANCHO - MARGEN * 2 - (textos.precio !== null ? 260 : 0), 2);
      degradado(ctx, base - lineas.length * tam * 1.3 - 60, base + 30, 0, 0.75, alto);
      ctx.fillStyle = "#ffffff";
      lineas.forEach((l, i) => ctx.fillText(l, MARGEN, base - (lineas.length - 1 - i) * tam * 1.3));
    }
    if (textos.precio !== null) {
      const r = vertical ? 140 : 100;
      await precioCirculo(ctx, textos.precio, color, ANCHO - MARGEN - r, (datos.length ? yFranja : alto) - r - 20, r, false);
    }
    return;
  }

  if (plantilla === "lateral") {
    const sobre = textoSobre(color);
    const [fx, fy, fw, fh] = vertical ? [0, 0, ANCHO, alto * 0.52] : [0, 0, 590, alto];
    if (foto) cubrir(ctx, foto, fx, fy, fw, fh);
    const px = vertical ? 0 : 590;
    const py = vertical ? alto * 0.52 : 0;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, ANCHO - px, alto - py);
    const x = px + MARGEN;
    const anchoTexto = ANCHO - px - MARGEN * 2;
    const yMarca = vertical ? py + 50 : arriba;
    const hMarca = await dibujarMarca(ctx, marca, mostrar, x, yMarca, vertical ? 110 : 90, false);
    // En vertical el contacto va en una sola línea abajo para dejarle espacio al título
    let yContacto = abajo;
    if (vertical) {
      if (datos.length) {
        await contactoHorizontal(ctx, datos, abajo - 30, 38, sobre, color);
        yContacto = abajo - 70;
      }
    } else yContacto = await contactoVertical(ctx, datos, x, abajo, anchoTexto, 30, sobre, false);

    // De arriba hacia abajo: marca, precio, título y subtítulo, sin pisar el contacto
    let yInicio = yMarca + hMarca + (hMarca ? 36 : 0);
    if (textos.precio !== null) {
      const tamPrecio = vertical ? 76 : 52;
      ctx.fillStyle = sobre;
      textoAjustado(ctx, pesos(textos.precio), anchoTexto, "900", tamPrecio);
      ctx.fillText(pesos(textos.precio), x, yInicio + tamPrecio);
      yInicio += tamPrecio * 1.25 + 20;
    }
    const disponible = (datos.length ? yContacto - 30 : abajo) - yInicio;
    let escala = 1;
    const [tamT, tamS] = [vertical ? 80 : 58, vertical ? 42 : 32];
    while (
      escala > 0.45 &&
      (altoTextos(ctx, textos, anchoTexto, tamT * escala, tamS * escala, false) > disponible || !tituloCompleto(ctx, textos.titulo, anchoTexto, tamT * escala))
    )
      escala -= 0.05;
    const altoBloque = altoTextos(ctx, textos, anchoTexto, tamT * escala, tamS * escala, false);
    bloqueTextos(ctx, textos, color, x, yInicio + altoBloque, anchoTexto, Math.round(tamT * escala), Math.round(tamS * escala), sobre, false);
    return;
  }

  if (foto) cubrir(ctx, foto, 0, 0, ANCHO, alto);

  if (plantilla === "arriba") {
    degradado(ctx, 0, alto * 0.6, 0.8, 0, alto);
    const franja = vertical ? 200 : 150;
    const yFranja = vertical ? abajo - franja + 40 : alto - franja;
    const hMarca = await dibujarMarca(ctx, marca, mostrar, MARGEN, arriba, vertical ? 110 : 80, false);
    // Título y subtítulo bajo el logo
    const tamT = vertical ? 92 : 70;
    ctx.font = `900 ${tamT}px ${FUENTE}`;
    const lineasT = lineasDeTexto(ctx, textos.titulo.toUpperCase(), ANCHO - MARGEN * 2, 3);
    ctx.font = `600 ${vertical ? 46 : 36}px ${FUENTE}`;
    const lineasS = textos.subtitulo.trim() ? lineasDeTexto(ctx, textos.subtitulo, ANCHO - MARGEN * 2 - 40, 3) : [];
    const altoBloque = lineasT.length * tamT * 1.08 + (lineasS.length ? 22 + lineasS.length * (vertical ? 46 : 36) * 1.25 + 30 : 0);
    bloqueTextos(ctx, textos, color, MARGEN, arriba + hMarca + 40 + altoBloque, ANCHO - MARGEN * 2, tamT, vertical ? 46 : 36, "#ffffff", true);
    if (datos.length) {
      ctx.fillStyle = color;
      ctx.fillRect(0, yFranja, ANCHO, alto - yFranja);
      await contactoHorizontal(ctx, datos, yFranja + (vertical ? franja - 40 : franja) / 2, vertical ? 44 : 36, textoSobre(color), color);
    }
    if (textos.precio !== null) await precioCirculo(ctx, textos.precio, color, ANCHO - MARGEN - (vertical ? 170 : 130), (datos.length ? yFranja : abajo) - (vertical ? 190 : 150), vertical ? 170 : 130, false);
    return;
  }

  // Banda inferior (y oferta, que agrega el precio destacado)
  degradado(ctx, alto * 0.35, alto, 0, 0.88, alto);
  await dibujarMarca(ctx, marca, mostrar, ANCHO - MARGEN, arriba, vertical ? 110 : 80, true);
  if (plantilla === "oferta") {
    await precioCirculo(ctx, textos.precio, color, MARGEN + (vertical ? 190 : 150), arriba + (vertical ? 190 : 150), vertical ? 190 : 150, true);
  }
  if (vertical) {
    const yContacto = await contactoVertical(ctx, datos, MARGEN, abajo, ANCHO - MARGEN * 2, 42, "#ffffff", true);
    bloqueTextos(ctx, textos, color, MARGEN, yContacto - 40, ANCHO - MARGEN * 2, 96, 46, "#ffffff", true);
  } else {
    const anchoContacto = datos.length ? 380 : 0;
    await contactoVertical(ctx, datos, ANCHO - MARGEN - anchoContacto, abajo, anchoContacto, 30, "#ffffff", true);
    bloqueTextos(ctx, textos, color, MARGEN, abajo, ANCHO - MARGEN * 2 - anchoContacto - (datos.length ? 30 : 0), 66, 34, "#ffffff", true);
    if (plantilla !== "oferta" && textos.precio !== null) {
      await precioCirculo(ctx, textos.precio, color, MARGEN + 130, arriba + 130, 130, false);
    }
  }
}

async function precioCirculo(ctx: CanvasRenderingContext2D, precio: number | null, color: string, cx: number, cy: number, radio: number, oferta: boolean) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.round(radio * 0.05);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.stroke();
  const sobre = textoSobre(color);
  ctx.fillStyle = sobre;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (oferta) {
    ctx.font = `800 ${Math.round(radio * 0.24)}px ${FUENTE}`;
    ctx.fillText("OFERTA", cx, cy - radio * (precio === null ? 0 : 0.34));
  }
  if (precio !== null) {
    textoAjustado(ctx, pesos(precio), radio * 1.65, "900", Math.round(radio * 0.36));
    ctx.fillText(pesos(precio), cx, cy + (oferta ? radio * 0.12 : 0));
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}
