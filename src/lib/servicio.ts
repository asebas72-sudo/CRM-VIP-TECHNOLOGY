/**
 * Reglas del módulo de servicio técnico (reparaciones y asesorías),
 * migradas del sistema anterior en Google Apps Script.
 */

export const ESTADOS_ORDEN = [
  "INGRESADO",
  "TALLER",
  "EN PROCESO",
  "ESPERA REPUESTOS",
  "REVISADO",
  "LISTO",
  "ENTREGADO",
] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

export const ESTILO_ESTADO_ORDEN: Record<EstadoOrden, { texto: string; icono: string; clase: string }> = {
  INGRESADO: { texto: "Ingresado", icono: "📥", clase: "bg-blue-100 text-blue-800" },
  TALLER: { texto: "En taller", icono: "🏭", clase: "bg-slate-200 text-slate-800" },
  "EN PROCESO": { texto: "En proceso", icono: "🔧", clase: "bg-amber-100 text-amber-800" },
  "ESPERA REPUESTOS": { texto: "Espera repuestos", icono: "⏳", clase: "bg-orange-100 text-orange-800" },
  REVISADO: { texto: "Revisado", icono: "🔬", clase: "bg-cyan-100 text-cyan-800" },
  LISTO: { texto: "Listo para entrega", icono: "✅", clase: "bg-green-100 text-green-800" },
  ENTREGADO: { texto: "Entregado", icono: "📦", clase: "bg-violet-100 text-violet-800" },
};

export const ESTADOS_ASESORIA = ["PENDIENTE", "CONFIRMADA", "REALIZADA", "CANCELADA"] as const;
export type EstadoAsesoria = (typeof ESTADOS_ASESORIA)[number];

export const ESTILO_ESTADO_ASESORIA: Record<EstadoAsesoria, { texto: string; icono: string; clase: string }> = {
  PENDIENTE: { texto: "Pendiente", icono: "🕒", clase: "bg-amber-100 text-amber-800" },
  CONFIRMADA: { texto: "Confirmada", icono: "📅", clase: "bg-blue-100 text-blue-800" },
  REALIZADA: { texto: "Realizada", icono: "✅", clase: "bg-green-100 text-green-800" },
  CANCELADA: { texto: "Cancelada", icono: "✖", clase: "bg-slate-200 text-slate-700" },
};

export const TIPOS_EQUIPO = ["Escritorio", "Portátil", "Todo en uno", "Impresora", "Celular / tablet", "Otro"];
export const ACCESORIOS = ["Cargador", "Teclado", "Mouse", "Estuche", "Cable de poder", "Batería"];
export const SOLICITUDES_ASESORIA = [
  "Instalación de software",
  "Configuración de red",
  "Mantenimiento CCTV",
  "Instalación CCTV",
  "Revisión cámaras",
  "Visita técnica",
  "Otro",
];

export const MAX_FOTOS = 5;

/**
 * Código único del equipo (mismo formato del sistema anterior):
 * [día] + 2 letras nombre + 2 dígitos cédula + 2 letras nombre + 2 últimos dígitos
 * cédula + 1 letra marca + [HHmmss]. Ej.: 03ANDR40AN97L085524
 */
export function construirCodigo(cedula: string, nombre: string, marca: string, fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  const ced = cedula.replace(/\D/g, "");
  const nom = (nombre.trim().split(/\s+/)[0] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .slice(0, 4);
  const mar = marca.replace(/\s+/g, "").toUpperCase().slice(0, 1);
  return `${p("day")}${nom.slice(0, 2)}${ced.slice(0, 2)}${nom.slice(2, 4)}${ced.slice(-2)}${mar}${p("hour")}${p("minute")}${p("second")}`;
}

/** Enlace de WhatsApp (agrega el 57 de Colombia a números de 10 dígitos). */
export function enlaceWhatsapp(celular: string | null | undefined, texto = ""): string | null {
  let digitos = String(celular ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 10) digitos = `57${digitos}`;
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

const pesosCO = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

export function mensajeIngreso(d: {
  empresa: string;
  nombre: string;
  equipo: string;
  codigo: string;
  fechaIngreso: string;
  valorRevision: number;
}): string {
  return [
    `Hola ${d.nombre} 👋`,
    `Tu equipo *${d.equipo}* fue registrado en *${d.empresa}*.`,
    "",
    `🧾 Código de caso: *${d.codigo}*`,
    `📅 Fecha de ingreso: ${d.fechaIngreso}`,
    "",
    "Pronto uno de nuestros técnicos se comunicará contigo.",
    "",
    `*TODA REVISIÓN CUESTA ${pesosCO(d.valorRevision)}*`,
    "",
    "Guarda este código, lo necesitarás para reclamar tu equipo.",
    "¡Gracias por confiar en nosotros!",
  ].join("\n");
}

export type CambioOrden = { campo: string; antes: string; ahora: string };

export function mensajeActualizacion(d: {
  empresa: string;
  cliente: string;
  equipo: string;
  codigo: string;
  cambios: CambioOrden[];
}): string {
  const listo = d.cambios.some((c) => c.campo === "Estado" && c.ahora === "LISTO");
  const lineas = [
    `Hola ${d.cliente}, le escribimos de ${d.empresa} con una actualización sobre su equipo "${d.equipo}" (Ticket ${d.codigo}).`,
    "",
    ...d.cambios.map((c) =>
      c.campo === "Estado"
        ? `• Estado actual: ${ESTILO_ESTADO_ORDEN[c.ahora as EstadoOrden]?.texto ?? c.ahora}`
        : c.campo === "Costo"
          ? `• Costo estimado de la reparación: ${pesosCO(Number(c.ahora))}`
          : `• ${c.campo}: ${c.ahora}`,
    ),
    "",
  ];
  if (listo) {
    lineas.push(
      `Su equipo ya está disponible para ser recogido, puede pasar por él preferiblemente los días LUNES - MIÉRCOLES - VIERNES de 3 de la tarde a 7 de la noche. Agradecemos su retiro dentro de los próximos 15 días hábiles, ya que posterior a esta fecha ${d.empresa} no podrá responder por la custodia del mismo. ¡Quedamos atentos a su visita!`,
      "",
      "Gracias por la confianza.",
    );
  } else {
    lineas.push("Quedamos al pendiente de su aprobación; cualquier duda, con gusto le atendemos. ¡Gracias por su confianza!");
  }
  return lineas.join("\n");
}

export function mensajeAsesoriaCliente(d: { empresa: string; nombre: string; numero: number; solicitud: string; fechaVisita?: string | null }): string {
  return [
    `Hola ${d.nombre} 👋`,
    `Tu solicitud de asesoría en *${d.empresa}* fue registrada.`,
    "",
    `🧾 Asesoría No. *${d.numero}*`,
    `🛠️ Solicitud: ${d.solicitud}`,
    d.fechaVisita ? `📅 Visita: ${d.fechaVisita}` : "Pronto confirmaremos contigo la fecha y hora de la visita.",
    "",
    "¡Gracias por confiar en nosotros!",
  ].join("\n");
}

export function mensajeAsesoriaTecnico(d: {
  tecnico: string;
  numero: number;
  cliente: string;
  celular: string;
  solicitud: string;
  fallas?: string | null;
  fechaVisita?: string | null;
}): string {
  return [
    `Hola ${d.tecnico}, tienes asignada la asesoría No. ${d.numero}.`,
    "",
    `👤 Cliente: ${d.cliente}`,
    `📱 Celular: ${d.celular}`,
    `🛠️ Solicitud: ${d.solicitud}`,
    d.fallas ? `📝 Detalle: ${d.fallas}` : "",
    d.fechaVisita ? `📅 Visita: ${d.fechaVisita}` : "📅 Visita: por agendar",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** dd/mm/aaaa en hora de Colombia */
export function fechaCorta(valor: string | Date): string {
  return new Date(valor).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** dd/mm/aaaa hh:mm a. m. en hora de Colombia */
export function fechaHora(valor: string | Date): string {
  return new Date(valor).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
