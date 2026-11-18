export const TIPOS: Record<string, string> = {
  mejora: "Mejorar algo que ya existe",
  falta: "Algo que le falta al sistema",
  error: "Algo que no funciona bien",
};

export const TIPO_CORTO: Record<string, string> = { mejora: "Mejora", falta: "Le falta", error: "Falla" };

export const AREAS: Record<string, string> = {
  ventas: "Ventas y caja",
  productos: "Productos e inventario",
  compras: "Compras y facturas",
  cartera: "Cartera y abonos",
  servicio: "Servicio técnico",
  informes: "Informes",
  etiquetas: "Etiquetas QR",
  usuarios: "Usuarios y empresas",
  otro: "Otro",
};

export const PRIORIDADES: Record<string, string> = { baja: "Puede esperar", media: "Importante", alta: "Urgente" };

export const ESTADOS: Record<string, string> = {
  nueva: "Nueva",
  revisando: "En revisión",
  planeada: "Planeada",
  hecha: "Hecha",
  descartada: "Descartada",
};

export const ESTILO_ESTADO: Record<string, string> = {
  nueva: "bg-blue-100 text-blue-800",
  revisando: "bg-amber-100 text-amber-800",
  planeada: "bg-violet-100 text-violet-800",
  hecha: "bg-green-100 text-green-800",
  descartada: "bg-slate-200 text-slate-600",
};

export const ESTILO_PRIORIDAD: Record<string, string> = {
  baja: "text-slate-500",
  media: "text-amber-700",
  alta: "font-semibold text-red-700",
};
