import { VistaMejoras } from "../../mejoras/vista";

export default function MejorasServicio({ searchParams }: PageProps<"/servicio/mejoras">) {
  return <VistaMejoras ruta="/servicio/mejoras" searchParams={searchParams} />;
}
