/** Tipo de ilustración según el nombre, para productos y servicios que aún no tienen foto. */

export type TipoIlustracion =
  | "combo"
  | "mouse"
  | "teclado"
  | "audifonos"
  | "powerbank"
  | "cargador"
  | "fuente"
  | "regulador"
  | "router"
  | "switch"
  | "wifi"
  | "hub"
  | "cable"
  | "disco"
  | "memoria"
  | "reloj"
  | "tinta"
  | "enfriamiento"
  | "limpieza"
  | "funda"
  | "cajon"
  | "caja"
  | "camara"
  | "reparacion"
  | "instalacion"
  | "redes"
  | "software"
  | "asesoria"
  | "servicio"
  | "producto";

// El orden importa: gana la primera regla que coincide, las más específicas van antes
const REGLAS_PRODUCTO: [TipoIlustracion, RegExp][] = [
  ["combo", /\bcombo\b|keyboard (&|and) mouse/],
  ["limpieza", /\b(espuma|spray|limpiador|limpiadora)\b/],
  ["enfriamiento", /\b(refrigerante|cooler|ventilador)\b/],
  ["cable", /\bcables?\b|\bhmi\b/],
  ["hub", /\bhub\b|\buh-\d+|\bconvertidor\b|usb.*\blan\b|\bextension usb\b/],
  ["camara", /\bds-2cd/],
  ["switch", /\bds-3e/],
  ["disco", /\bcaja externa\b/],
  ["mouse", /\bmouse\b|\bratón\b|\bm170\b/],
  ["teclado", /\bteclado\b|\bkeyboard\b/],
  ["audifonos", /\b(audifonos?|earphones?|buds|diadema|auriculares?|h390)\b/],
  ["powerbank", /power ?bank/],
  ["fuente", /\bfuente de poder\b/],
  ["cargador", /\bcargador\b|power adapter|powers adapter|adaptador pd\b/],
  ["regulador", /\bregulador\b/],
  ["router", /\brouter\b/],
  ["switch", /\bswitch\b|\bport gigabit\b/],
  ["wifi", /\bnano usb\b|\bwifi\b.*\badaptador\b|\badaptador\b.*\binalambrico\b/],
  ["disco", /\b(ssd|nvme|disco|estado solido|m\.?2)\b/],
  ["memoria", /\b(memoria|microsd|micro sd)\b/],
  ["reloj", /\b(watch|smart ?band|smartwatch|reloj)\b/],
  ["tinta", /\b(tinta|cartucho|toner)\b/],
  ["funda", /\b(funda|estuche|maletin)\b/],
  ["cajon", /\bcajon\b/],
  ["caja", /\bcaja\b/],
  ["camara", /\b(camara|dvr|nvr)\b/],
];

const REGLAS_SERVICIO: [TipoIlustracion, RegExp][] = [
  ["camara", /\b(camara|camaras|cctv|seguridad|vigilancia|alarma)\b/],
  ["redes", /\b(red|redes|cableado|wifi|internet)\b/],
  ["software", /\b(software|desarrollo|programacion|licencia|pagina web|aplicacion|sistema)\b/],
  ["asesoria", /\b(asesoria|asesorias|consultoria|soporte|capacitacion|acompanamiento)\b/],
  ["instalacion", /\b(instalacion|montaje|configuracion)\b/],
  ["reparacion", /\b(reparacion|mantenimiento|diagnostico|formateo|limpieza)\b/],
];

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function tipoIlustracion(nombre: string, esServicio = false): TipoIlustracion {
  const texto = normalizar(nombre);
  const reglas = esServicio ? REGLAS_SERVICIO : REGLAS_PRODUCTO;
  return reglas.find(([, patron]) => patron.test(texto))?.[0] ?? (esServicio ? "servicio" : "producto");
}
