export const TIPOS_GASTO: Record<string, string> = { gasto: "Gasto", inversion: "Inversión" };

/** Categorías sugeridas según el tipo */
export const CATEGORIAS: Record<string, Record<string, string>> = {
  gasto: {
    arriendo: "Arriendo",
    servicios: "Servicios públicos e internet",
    nomina: "Nómina y pagos a personal",
    transporte: "Transporte y domicilios",
    publicidad: "Publicidad",
    mantenimiento: "Mantenimiento y aseo",
    papeleria: "Papelería e insumos",
    impuestos: "Impuestos y trámites",
    bancarios: "Comisiones bancarias",
    alimentacion: "Alimentación",
    otro: "Otro gasto",
  },
  inversion: {
    equipos: "Equipos y computadores",
    herramientas: "Herramientas",
    mobiliario: "Muebles y vitrinas",
    adecuaciones: "Adecuaciones del local",
    software: "Software y licencias",
    vehiculo: "Vehículo",
    otro: "Otra inversión",
  },
};

export function nombreCategoria(tipo: string, categoria: string): string {
  return CATEGORIAS[tipo]?.[categoria] ?? categoria;
}

export const FORMAS_PAGO_GASTO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};
