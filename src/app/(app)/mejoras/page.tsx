import { VistaMejoras } from "./vista";

export default function PaginaMejoras({ searchParams }: PageProps<"/mejoras">) {
  return <VistaMejoras ruta="/mejoras" searchParams={searchParams} />;
}
