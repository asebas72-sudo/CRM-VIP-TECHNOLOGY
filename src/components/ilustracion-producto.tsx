import {
  Banknote,
  BatteryCharging,
  Box,
  Briefcase,
  Cable,
  Cctv,
  Code,
  Droplet,
  Fan,
  HardDrive,
  Headphones,
  Headset,
  Keyboard,
  Laptop,
  MemoryStick,
  Mouse,
  Network,
  Package,
  Plug,
  Power,
  Router,
  Settings2,
  ShieldCheck,
  SprayCan,
  Usb,
  Watch,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { tipoIlustracion, type TipoIlustracion } from "@/lib/ilustraciones";

const ICONOS: Record<TipoIlustracion, LucideIcon> = {
  combo: Keyboard,
  mouse: Mouse,
  teclado: Keyboard,
  audifonos: Headphones,
  powerbank: BatteryCharging,
  cargador: Plug,
  fuente: Power,
  regulador: ShieldCheck,
  router: Router,
  switch: Network,
  wifi: Wifi,
  hub: Usb,
  cable: Cable,
  disco: HardDrive,
  memoria: MemoryStick,
  reloj: Watch,
  tinta: Droplet,
  enfriamiento: Fan,
  limpieza: SprayCan,
  funda: Laptop,
  cajon: Banknote,
  caja: Box,
  camara: Cctv,
  reparacion: Wrench,
  instalacion: Settings2,
  redes: Network,
  software: Code,
  asesoria: Headset,
  servicio: Briefcase,
  producto: Package,
};

// Segundo dibujo para distinguir el combo del teclado solo y el cargador del enchufe
const SEGUNDO_ICONO: Partial<Record<TipoIlustracion, LucideIcon>> = { combo: Mouse, cargador: Zap };

/** Dibujos de la ilustración de un producto (para generar imágenes). */
export function iconosIlustracion(nombre: string, esServicio = false): LucideIcon[] {
  const tipo = tipoIlustracion(nombre, esServicio);
  const segundo = SEGUNDO_ICONO[tipo];
  return segundo ? [ICONOS[tipo], segundo] : [ICONOS[tipo]];
}

/** Ilustración que se muestra mientras el producto o servicio no tenga foto real. */
export function IlustracionProducto({
  nombre,
  esServicio = false,
  color = "#475569",
  compacta = false,
}: {
  nombre: string;
  esServicio?: boolean;
  color?: string;
  compacta?: boolean;
}) {
  const tipo = tipoIlustracion(nombre, esServicio);
  const Icono = ICONOS[tipo];
  const Segundo = SEGUNDO_ICONO[tipo];
  const tamano = compacta ? "size-8" : "size-[38%]";

  return (
    <div className="flex size-full items-center justify-center gap-1" style={{ backgroundColor: `${color}14`, color }} role="img" aria-label={nombre}>
      <Icono className={tamano} strokeWidth={1.25} aria-hidden />
      {Segundo && <Segundo className={compacta ? "size-5" : "size-[22%]"} strokeWidth={1.25} aria-hidden />}
    </div>
  );
}
