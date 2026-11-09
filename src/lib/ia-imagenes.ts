import "server-only";

/** Mejora de fotos con Cloudflare Workers AI (cupo gratis diario, sin facturación activa). */

const MODELO = "@cf/black-forest-labs/flux-2-klein-9b";
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

const BASE =
  "Edit this photo for professional advertising. Keep the main subject, all equipment, devices, cables and the installation exactly as they are. " +
  "Do not add, remove or change any device. No text, no letters, no logos, no watermarks.";

const OPCIONES: Record<string, (color: string) => string> = {
  luz: () => "Improve the lighting, colors and sharpness.",
  fondo: () => "Replace the messy background with a clean, professional one.",
  oficina: () => "Place the scene in a modern, tidy office environment.",
  graficos: (color) => `Add subtle abstract decorative graphic shapes at the edges of the image in the color ${color}.`,
};

export type ResultadoIA = { imagen?: string; error?: string };

function medida(valor: FormDataEntryValue | null): number {
  const n = Math.round(Number(valor) / 16) * 16;
  return Number.isFinite(n) ? Math.min(Math.max(n, 256), 1024) : 1024;
}

export async function mejorarImagen(form: FormData): Promise<ResultadoIA> {
  const cuenta = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!cuenta || !token) return { error: "Falta configurar CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN en el servidor." };

  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Seleccione la foto." };
  if (!TIPOS.includes(archivo.type)) return { error: "La foto debe ser JPG, PNG o WEBP." };
  if (archivo.size > MAX_BYTES) return { error: "La foto pesa más de 5 MB." };

  const colorRecibido = String(form.get("color") ?? "");
  const color = /^#[0-9a-fA-F]{6}$/.test(colorRecibido) ? colorRecibido : "#1d4ed8";
  const pedidos = form.getAll("opciones").flatMap((o) => (typeof o === "string" && OPCIONES[o] ? [OPCIONES[o](color)] : []));
  const texto = String(form.get("texto") ?? "").trim().slice(0, 300);

  const solicitud = new FormData();
  solicitud.append("prompt", [BASE, ...pedidos, texto && `Additional request: ${texto}`].filter(Boolean).join(" "));
  solicitud.append("width", String(medida(form.get("ancho"))));
  solicitud.append("height", String(medida(form.get("alto"))));
  solicitud.append("input_image_0", archivo);

  let respuesta: Response;
  try {
    respuesta = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/ai/run/${MODELO}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: solicitud,
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return { error: "El servicio de IA no respondió. Intente de nuevo." };
  }

  const datos = (await respuesta.json().catch(() => null)) as {
    result?: { image?: string };
    errors?: { message?: string }[];
  } | null;

  if (datos?.result?.image) return { imagen: `data:image/jpeg;base64,${datos.result.image}` };
  if (respuesta.status === 429) return { error: "Se agotó el cupo gratis de hoy. Intente mañana." };
  if (respuesta.status === 401 || respuesta.status === 403) return { error: "Cloudflare rechazó las credenciales configuradas." };
  return { error: datos?.errors?.[0]?.message ?? `El servicio de IA devolvió un error (${respuesta.status}).` };
}
