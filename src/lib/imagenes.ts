/** Reduce fotos del celular (varios MB) a JPEG de máx. `lado` px antes de enviarlas. Solo navegador. */
export async function comprimirImagen(archivo: File, lado = 2000): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/gif") return archivo;
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
  return blob ? new File([blob], archivo.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : archivo;
}
