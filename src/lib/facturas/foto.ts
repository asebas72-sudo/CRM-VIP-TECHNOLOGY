import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * Lectura de facturas, recibos de caja o cuentas de cobro desde una foto o
 * PDF, usando Claude (visión + salida estructurada). Requiere la variable de
 * entorno ANTHROPIC_API_KEY.
 */

const LineaSchema = z.object({
  descripcion: z.string().describe("Descripción del producto tal como aparece"),
  codigo: z.string().nullable().describe("Código o referencia del producto si aparece, si no null"),
  cantidad: z.number().describe("Cantidad comprada"),
  valor_unitario: z.number().describe("Valor unitario en pesos colombianos, sin separadores"),
  iva_porcentaje: z.number().describe("Porcentaje de IVA de la línea (0, 5 o 19). 0 si no se discrimina IVA"),
  precio_incluye_iva: z.boolean().describe("true si el valor unitario ya incluye IVA"),
});

const DocumentoSchema = z.object({
  es_documento_de_compra: z
    .boolean()
    .describe("false si la imagen no es una factura, recibo, remisión o cuenta de cobro"),
  tipo_documento: z.enum(["factura_electronica", "factura_papel", "recibo_caja", "cuenta_cobro", "remision", "otro"]),
  proveedor_nombre: z.string().nullable(),
  proveedor_nit: z.string().nullable().describe("NIT o cédula del vendedor, solo dígitos, sin dígito de verificación"),
  numero: z.string().nullable().describe("Número del documento"),
  fecha: z.string().nullable().describe("Fecha del documento en formato AAAA-MM-DD"),
  cufe: z.string().nullable().describe("CUFE completo si aparece (factura electrónica)"),
  lineas: z.array(LineaSchema),
  total: z.number().nullable().describe("Total a pagar del documento"),
  observaciones: z
    .string()
    .describe("Advertencias breves en español: partes ilegibles, valores dudosos, tachones, etc. Vacío si nada."),
});

export type DocumentoLeido = z.infer<typeof DocumentoSchema>;

const INSTRUCCIONES = `Eres un auxiliar contable colombiano. Te comparten la foto o el PDF de un documento de compra a un proveedor: puede ser una factura electrónica impresa, una factura de papel, un recibo de caja, una remisión o una cuenta de cobro escrita a mano.

Extrae los datos tal como aparecen en el documento. Reglas:
- Valores en pesos colombianos como números (ej. "$ 1.250.000" -> 1250000; en Colombia el punto separa miles y la coma decimales).
- Una línea por cada producto o servicio. Si el documento solo trae un total sin detalle, devuelve una sola línea con la descripción disponible.
- Si un dato no aparece o no se puede leer, usa null; no lo inventes. Anota en "observaciones" lo que no se lea con seguridad.
- En recibos manuales normalmente no se discrimina IVA: usa iva_porcentaje 0 y precio_incluye_iva true, salvo que el documento diga otra cosa.`;

export class LecturaNoDisponible extends Error {}

export async function leerDocumentoCompra(archivo: { datos: Buffer; tipo: string }): Promise<DocumentoLeido> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LecturaNoDisponible(
      "La lectura automática no está configurada (falta ANTHROPIC_API_KEY). Puede registrar la compra escribiendo las líneas a mano.",
    );
  }

  const base64 = archivo.datos.toString("base64");
  const adjunto: Anthropic.Beta.BetaContentBlockParam =
    archivo.tipo === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: archivo.tipo as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64,
          },
        };

  const client = new Anthropic();
  try {
    const respuesta = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(DocumentoSchema) },
      system: INSTRUCCIONES,
      messages: [
        {
          role: "user",
          content: [adjunto, { type: "text", text: "Extrae los datos de este documento de compra." }],
        },
      ],
    });

    if (respuesta.stop_reason === "refusal") {
      throw new LecturaNoDisponible("No fue posible leer este documento. Regístrelo a mano.");
    }
    if (!respuesta.parsed_output) {
      throw new LecturaNoDisponible("No se pudo interpretar el documento. Intente con una foto más clara o regístrelo a mano.");
    }
    return respuesta.parsed_output;
  } catch (error) {
    if (error instanceof LecturaNoDisponible) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new LecturaNoDisponible("La clave ANTHROPIC_API_KEY no es válida.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new LecturaNoDisponible("Hay muchas lecturas en curso. Intente de nuevo en un minuto.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new LecturaNoDisponible(`El archivo no se pudo procesar: ${error.message}`);
    }
    if (error instanceof Anthropic.APIError) {
      throw new LecturaNoDisponible(`Error del servicio de lectura (${error.status}). Intente de nuevo.`);
    }
    throw error;
  }
}
