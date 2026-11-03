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

// ---------------------------------------------------------------------
// Mensajes de WhatsApp configurables (Reparaciones > Configuración)
// ---------------------------------------------------------------------

export type ClavePlantilla =
  | "ORDEN_INGRESADO"
  | "ORDEN_TALLER"
  | "ORDEN_EN_PROCESO"
  | "ORDEN_ESPERA_REPUESTOS"
  | "ORDEN_REVISADO"
  | "ORDEN_LISTO"
  | "ORDEN_ENTREGADO"
  | "ORDEN_ACTUALIZACION"
  | "ORDEN_TECNICO"
  | "ASESORIA_PENDIENTE"
  | "ASESORIA_CONFIRMADA"
  | "ASESORIA_REALIZADA"
  | "ASESORIA_CANCELADA"
  | "ASESORIA_TECNICO";

export type Plantillas = Record<ClavePlantilla, string>;

export const PLANTILLAS_DEFECTO: Plantillas = {
  ORDEN_INGRESADO: [
    "Hola {cliente} 👋",
    "Tu equipo *{equipo}* fue registrado en *{empresa}*.",
    "",
    "🧾 Código de caso: *{codigo}*",
    "📅 Fecha de ingreso: {fecha_ingreso}",
    "📆 Entrega estimada: {fecha_entrega}",
    "",
    "Pronto uno de nuestros técnicos se comunicará contigo.",
    "",
    "*TODA REVISIÓN CUESTA {valor_revision}*",
    "",
    "Guarda este código, lo necesitarás para reclamar tu equipo.",
    "¡Gracias por confiar en nosotros!",
  ].join("\n"),
  ORDEN_TALLER: [
    "Hola {cliente}, le escribimos de {empresa}.",
    "",
    "Su equipo *{equipo}* (ticket {codigo}) ya está en nuestro taller y pronto iniciaremos la revisión.",
    "",
    "¡Gracias por su confianza!",
  ].join("\n"),
  ORDEN_EN_PROCESO: [
    "Hola {cliente}, le escribimos de {empresa}.",
    "",
    "Estamos trabajando en su equipo *{equipo}* (ticket {codigo}).",
    "📝 {informe}",
    "",
    "Le avisaremos apenas esté listo. ¡Gracias por su confianza!",
  ].join("\n"),
  ORDEN_ESPERA_REPUESTOS: [
    "Hola {cliente}, le escribimos de {empresa}.",
    "",
    "Su equipo *{equipo}* (ticket {codigo}) está en espera de repuestos.",
    "📝 {informe}",
    "💰 Costo estimado de la reparación: {costo}",
    "",
    "Le avisaremos cuando lleguen. Cualquier duda, con gusto le atendemos.",
  ].join("\n"),
  ORDEN_REVISADO: [
    "Hola {cliente}, le escribimos de {empresa} con el diagnóstico de su equipo *{equipo}* (ticket {codigo}).",
    "",
    "🔬 Diagnóstico: {informe}",
    "💰 Costo de la reparación: {costo}",
    "",
    "Quedamos al pendiente de su aprobación para continuar; cualquier duda, con gusto le atendemos. ¡Gracias por su confianza!",
  ].join("\n"),
  ORDEN_LISTO: [
    "Hola {cliente}, le escribimos de {empresa}. ✅",
    "",
    "Su equipo *{equipo}* (ticket {codigo}) ya está disponible para ser recogido.",
    "💰 Valor a pagar: {costo}",
    "📝 {informe}",
    "",
    "Puede pasar por él preferiblemente los días LUNES - MIÉRCOLES - VIERNES de 3 de la tarde a 7 de la noche. Agradecemos su retiro dentro de los próximos 15 días hábiles, ya que posterior a esta fecha {empresa} no podrá responder por la custodia del mismo.",
    "",
    "Recuerde presentar el código *{codigo}*. ¡Quedamos atentos a su visita!",
  ].join("\n"),
  ORDEN_ENTREGADO: [
    "Hola {cliente}, gracias por confiar en {empresa}. 🙌",
    "",
    "Su equipo *{equipo}* (ticket {codigo}) fue entregado.",
    "",
    "Si tiene alguna inquietud con el servicio, con gusto le atendemos.",
  ].join("\n"),
  ORDEN_ACTUALIZACION: [
    "Hola {cliente}, le escribimos de {empresa} con una actualización sobre su equipo *{equipo}* (ticket {codigo}).",
    "",
    "📌 Estado: {estado}",
    "💰 Costo de la reparación: {costo}",
    "📝 {informe}",
    "",
    "Cualquier duda, con gusto le atendemos. ¡Gracias por su confianza!",
  ].join("\n"),
  ORDEN_TECNICO: [
    "Hola {tecnico}, tienes asignada la orden *{codigo}* (No. {orden}).",
    "",
    "💻 Equipo: {equipo}",
    "👤 Cliente: {cliente}",
    "⚠️ Falla reportada: {fallas}",
  ].join("\n"),
  ASESORIA_PENDIENTE: [
    "Hola {cliente} 👋",
    "Tu solicitud de asesoría en *{empresa}* fue registrada.",
    "",
    "🧾 Asesoría No. *{numero}*",
    "🛠️ Solicitud: {solicitud}",
    "",
    "Pronto confirmaremos contigo la fecha y hora de la visita.",
    "¡Gracias por confiar en nosotros!",
  ].join("\n"),
  ASESORIA_CONFIRMADA: [
    "Hola {cliente} 👋, te escribimos de *{empresa}*.",
    "",
    "Tu asesoría No. *{numero}* ({solicitud}) quedó confirmada:",
    "📅 Visita: {fecha_visita}",
    "👨‍🔧 Técnico: {tecnico}",
    "",
    "¡Nos vemos pronto!",
  ].join("\n"),
  ASESORIA_REALIZADA: [
    "Hola {cliente}, gracias por confiar en {empresa}. 🙌",
    "",
    "Tu asesoría No. {numero} ({solicitud}) fue realizada.",
    "📝 {informe}",
    "💰 Valor: {costo}",
    "",
    "Cualquier inquietud, con gusto te atendemos.",
  ].join("\n"),
  ASESORIA_CANCELADA: [
    "Hola {cliente}, te escribimos de {empresa}.",
    "",
    "Tu asesoría No. {numero} ({solicitud}) fue cancelada.",
    "📝 {informe}",
    "",
    "Si deseas reprogramarla, con gusto te ayudamos.",
  ].join("\n"),
  ASESORIA_TECNICO: [
    "Hola {tecnico}, tienes asignada la asesoría No. {numero}.",
    "",
    "👤 Cliente: {cliente}",
    "📱 Celular: {celular}",
    "🛠️ Solicitud: {solicitud}",
    "📝 Detalle: {detalle}",
    "📅 Visita: {fecha_visita}",
  ].join("\n"),
};

/** Grupos y nombres que ve el administrador al editar los mensajes. */
export const GRUPOS_PLANTILLAS: { titulo: string; plantillas: { clave: ClavePlantilla; texto: string; ayuda: string }[] }[] = [
  {
    titulo: "Reparaciones · mensajes al cliente según el estado",
    plantillas: [
      { clave: "ORDEN_INGRESADO", texto: "📥 Ingresado", ayuda: "Al registrar el equipo y cuando la orden vuelve a Ingresado." },
      { clave: "ORDEN_TALLER", texto: "🏭 En taller", ayuda: "Cuando la orden pasa a En taller." },
      { clave: "ORDEN_EN_PROCESO", texto: "🔧 En proceso", ayuda: "Cuando la orden pasa a En proceso." },
      { clave: "ORDEN_ESPERA_REPUESTOS", texto: "⏳ Espera repuestos", ayuda: "Cuando la orden pasa a Espera repuestos." },
      { clave: "ORDEN_REVISADO", texto: "🔬 Revisado", ayuda: "Diagnóstico y costo para que el cliente apruebe." },
      { clave: "ORDEN_LISTO", texto: "✅ Listo para entrega", ayuda: "El equipo está listo para recoger." },
      { clave: "ORDEN_ENTREGADO", texto: "📦 Entregado", ayuda: "Agradecimiento al entregar el equipo." },
      { clave: "ORDEN_ACTUALIZACION", texto: "✏️ Otros cambios", ayuda: "Cuando cambia el costo o el informe sin cambiar el estado." },
    ],
  },
  {
    titulo: "Reparaciones · mensaje al técnico",
    plantillas: [{ clave: "ORDEN_TECNICO", texto: "👨‍🔧 Orden asignada", ayuda: "Botón de WhatsApp junto al técnico asignado." }],
  },
  {
    titulo: "Asesorías · mensajes al cliente según el estado",
    plantillas: [
      { clave: "ASESORIA_PENDIENTE", texto: "🕒 Registrada (pendiente)", ayuda: "Al registrar la solicitud." },
      { clave: "ASESORIA_CONFIRMADA", texto: "📅 Confirmada", ayuda: "Con la fecha de visita y el técnico." },
      { clave: "ASESORIA_REALIZADA", texto: "✅ Realizada", ayuda: "Al terminar la asesoría." },
      { clave: "ASESORIA_CANCELADA", texto: "✖ Cancelada", ayuda: "Si la asesoría se cancela." },
    ],
  },
  {
    titulo: "Asesorías · mensaje al técnico",
    plantillas: [{ clave: "ASESORIA_TECNICO", texto: "👨‍🔧 Asesoría asignada", ayuda: "Botón de WhatsApp junto al técnico asignado." }],
  },
];

export const VARIABLES_ORDEN = [
  "{cliente}",
  "{equipo}",
  "{codigo}",
  "{orden}",
  "{empresa}",
  "{estado}",
  "{costo}",
  "{informe}",
  "{fallas}",
  "{fecha_ingreso}",
  "{fecha_entrega}",
  "{valor_revision}",
  "{tecnico}",
];
export const VARIABLES_ASESORIA = [
  "{cliente}",
  "{celular}",
  "{numero}",
  "{solicitud}",
  "{detalle}",
  "{empresa}",
  "{estado}",
  "{fecha_visita}",
  "{tecnico}",
  "{costo}",
  "{informe}",
];

/** Textos de la empresa: los personalizados reemplazan a los originales. */
export function plantillasDe(personalizadas: unknown): Plantillas {
  const guardadas = (personalizadas && typeof personalizadas === "object" ? personalizadas : {}) as Partial<Plantillas>;
  const resultado = { ...PLANTILLAS_DEFECTO };
  for (const clave of Object.keys(PLANTILLAS_DEFECTO) as ClavePlantilla[]) {
    const t = guardadas[clave];
    if (typeof t === "string" && t.trim()) resultado[clave] = t;
  }
  return resultado;
}

export const clavePorEstadoOrden = (estado: EstadoOrden) => `ORDEN_${estado.replace(/ /g, "_")}` as ClavePlantilla;
export const clavePorEstadoAsesoria = (estado: EstadoAsesoria) => `ASESORIA_${estado}` as ClavePlantilla;

/**
 * Reemplaza {variables}. Las líneas con una variable sin valor se quitan
 * (por ejemplo, "💰 Costo: {costo}" no sale si aún no hay costo).
 */
export function aplicarPlantilla(texto: string, valores: Record<string, string | number | null | undefined>): string {
  const lineas = texto.split("\n").flatMap((linea) => {
    let vacia = false;
    const nueva = linea.replace(/\{(\w+)\}/g, (completo, nombre: string) => {
      if (!(nombre in valores)) return completo;
      const v = valores[nombre];
      if (v === null || v === undefined || String(v).trim() === "") {
        vacia = true;
        return "";
      }
      return String(v);
    });
    return vacia ? [] : [nueva];
  });
  // Sin líneas en blanco repetidas al quitar
  return lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const pesosCO = (n: number | null | undefined) => (n == null ? null : `$${Math.round(n).toLocaleString("es-CO")}`);

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
