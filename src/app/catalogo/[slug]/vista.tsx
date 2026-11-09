"use client";

import { Briefcase, Mail, MapPin, MessageCircle, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { pesos } from "@/lib/formato";
import { urlImagenPortafolio, type ItemPublico, type PortafolioPublico } from "@/lib/portafolio";
import { enlaceWhatsapp } from "@/lib/servicio";

const DISPONIBILIDAD = {
  disponible: { texto: "Disponible", clase: "text-green-700" },
  pocas: { texto: "Pocas unidades", clase: "text-amber-700" },
  por_pedido: { texto: "Por pedido", clase: "text-slate-500" },
};

const FILTROS = [
  { valor: "todo", texto: "Todo" },
  { valor: "productos", texto: "Productos" },
  { valor: "servicios", texto: "Servicios" },
  { valor: "oferta", texto: "Ofertas" },
  { valor: "nuevo", texto: "Nuevos" },
];

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const enlaceExterno = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

function Tarjeta({ item, p }: { item: ItemPublico; p: PortafolioPublico }) {
  const foto = urlImagenPortafolio(item.foto_path);
  const disp = DISPONIBILIDAD[item.disponibilidad];
  const cotizar = enlaceWhatsapp(p.whatsapp, `Hola, ${p.empresa}. Me interesa cotizar: ${item.nombre}`);
  const Icono = item.es_servicio ? Briefcase : Package;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="relative aspect-square bg-slate-100">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen pública de Supabase
          <img src={foto} alt={item.nombre} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Icono className="size-12 text-slate-300" strokeWidth={1.3} aria-hidden />
          </div>
        )}
        {item.etiqueta && (
          <span className="absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: p.color }}>
            {item.etiqueta === "oferta" ? "Oferta" : "Nuevo"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm font-semibold text-slate-900">{item.nombre}</h3>
        {item.descripcion && <p className="text-xs leading-relaxed text-slate-600">{item.descripcion}</p>}
        <div className="mt-auto pt-2">
          {item.precio !== null && <p className="font-bold text-slate-900 tabular-nums">{pesos(item.precio)}</p>}
          <p className={`text-xs font-medium ${disp.clase}`}>{item.es_servicio ? "Servicio" : disp.texto}</p>
        </div>
        {cotizar && (
          <a
            href={cotizar}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: p.color }}
          >
            <MessageCircle className="size-4" aria-hidden />
            Cotizar
          </a>
        )}
      </div>
    </article>
  );
}

export function VistaCatalogo({ p }: { p: PortafolioPublico }) {
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("todo");
  const [categoria, setCategoria] = useState("");
  const logo = urlImagenPortafolio(p.logo_path);
  const contacto = enlaceWhatsapp(p.whatsapp, `Hola, ${p.empresa}. Quisiera más información.`);

  const categorias = useMemo(
    () => [...new Set(p.items.map((i) => i.categoria).filter((c): c is string => Boolean(c)))].sort(),
    [p.items],
  );

  const lista = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    return p.items.filter((i) => {
      if (filtro === "productos" && i.es_servicio) return false;
      if (filtro === "servicios" && !i.es_servicio) return false;
      if ((filtro === "oferta" || filtro === "nuevo") && i.etiqueta !== filtro) return false;
      if (categoria && i.categoria !== categoria) return false;
      const donde = normalizar(`${i.nombre} ${i.descripcion ?? ""}`);
      return palabras.every((w) => donde.includes(w));
    });
  }, [p.items, texto, filtro, categoria]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white ring-1 ring-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element -- imagen pública de Supabase
              <img src={logo} alt={`Logo de ${p.empresa}`} className="h-10 w-auto max-w-32 object-contain" />
            )}
            <span className="truncate text-lg font-bold">{p.empresa}</span>
          </div>
          {contacto && (
            <a
              href={contacto}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: p.color }}
            >
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {(p.titulo || p.mensaje) && (
          <section className="rounded-2xl px-6 py-8 text-white" style={{ backgroundColor: p.color }}>
            {p.titulo && <h1 className="text-2xl font-bold sm:text-3xl">{p.titulo}</h1>}
            {p.mensaje && <p className="mt-2 max-w-2xl text-sm sm:text-base">{p.mensaje}</p>}
          </section>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar productos y servicios..."
              aria-label="Buscar"
              className="min-w-0 flex-1 basis-56 rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
            {categorias.length > 1 && (
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                aria-label="Categoría"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                onClick={() => setFiltro(f.valor)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${filtro === f.valor ? "text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                style={filtro === f.valor ? { backgroundColor: p.color } : undefined}
              >
                {f.texto}
              </button>
            ))}
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">
            {p.items.length === 0 ? "Pronto publicaremos nuestros productos y servicios." : "No encontramos resultados para su búsqueda."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lista.map((i) => (
              <Tarjeta key={i.id} item={i} p={p} />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-6 bg-white ring-1 ring-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-5 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{p.empresa}</span>
          {p.direccion && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {p.direccion}
            </span>
          )}
          {p.correo && (
            <a href={`mailto:${p.correo}`} className="flex items-center gap-1.5 hover:underline">
              <Mail className="size-4" aria-hidden />
              {p.correo}
            </a>
          )}
          {p.facebook && (
            <a href={enlaceExterno(p.facebook)} target="_blank" rel="noreferrer" className="hover:underline">
              Facebook
            </a>
          )}
          {p.instagram && (
            <a href={enlaceExterno(p.instagram)} target="_blank" rel="noreferrer" className="hover:underline">
              Instagram
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
