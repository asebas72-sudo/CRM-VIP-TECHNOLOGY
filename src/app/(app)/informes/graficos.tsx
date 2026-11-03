"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { pesos } from "@/lib/formato";

/** Color de serie única (validado contra superficie blanca: contraste ≥ 3:1). */
const SERIE = "#2a78d6";
const REJILLA = "#e7e5e1";

/** $1,2 M · $350 mil · $900 */
export function pesosCompactos(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000).toLocaleString("es-CO")} mil`;
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function escalaAmigable(max: number): number[] {
  if (max <= 0) return [0];
  const paso0 = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= paso0)!;
  const marcas = [];
  for (let v = 0; v <= max + paso * 0.001; v += paso) marcas.push(v);
  if (marcas[marcas.length - 1] < max) marcas.push(marcas[marcas.length - 1] + paso);
  return marcas;
}

type Dia = { dia: string; ventas: number; utilidad: number; numero: number };

const corto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** Columnas de ventas por día con tooltip al pasar el mouse o enfocar. */
export function VentasPorDia({ dias }: { dias: Dia[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const ancho = 800;
  const alto = 240;
  const margen = { arriba: 12, derecha: 8, abajo: 26, izquierda: 64 };
  const areaAncho = ancho - margen.izquierda - margen.derecha;
  const areaAlto = alto - margen.arriba - margen.abajo;

  const marcas = escalaAmigable(Math.max(...dias.map((d) => d.ventas), 0));
  const tope = marcas[marcas.length - 1] || 1;
  const y = (v: number) => margen.arriba + areaAlto - (v / tope) * areaAlto;
  const franja = areaAncho / Math.max(dias.length, 1);
  const grosor = Math.max(1, Math.min(24, franja * 0.7));
  const cadaCuanto = Math.ceil(dias.length / 8);

  const d = activo !== null ? dias[activo] : null;
  const xActivo = activo !== null ? margen.izquierda + franja * activo + franja / 2 : 0;

  return (
    <div ref={contenedor} className="relative" onMouseLeave={() => setActivo(null)}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-auto w-full" role="img" aria-label="Ventas por día">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(m)} y2={y(m)} stroke={REJILLA} strokeWidth={1} />
            <text x={margen.izquierda - 8} y={y(m)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#6b6a66">
              {pesosCompactos(m)}
            </text>
          </g>
        ))}
        {dias.map((dia, i) => {
          const x = margen.izquierda + franja * i + (franja - grosor) / 2;
          const alturaBarra = (dia.ventas / tope) * areaAlto;
          const base = margen.arriba + areaAlto;
          const r = Math.min(4, grosor / 2, alturaBarra);
          // Extremo de datos redondeado (4px), base cuadrada
          const ruta =
            alturaBarra > 0
              ? `M${x},${base} V${base - alturaBarra + r} Q${x},${base - alturaBarra} ${x + r},${base - alturaBarra} H${x + grosor - r} Q${x + grosor},${base - alturaBarra} ${x + grosor},${base - alturaBarra + r} V${base} Z`
              : "";
          return (
            <g key={dia.dia}>
              {ruta && <path d={ruta} fill={SERIE} opacity={activo === null || activo === i ? 1 : 0.55} />}
              {i % cadaCuanto === 0 && (
                <text x={x + grosor / 2} y={alto - 8} textAnchor="middle" fontSize={11} fill="#6b6a66">
                  {corto(dia.dia)}
                </text>
              )}
              {/* Zona sensible: toda la franja del día, más grande que la barra */}
              <rect
                x={margen.izquierda + franja * i}
                y={margen.arriba}
                width={franja}
                height={areaAlto}
                fill="transparent"
                tabIndex={0}
                aria-label={`${dia.dia}: ${pesos(dia.ventas)}`}
                onMouseEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
              />
            </g>
          );
        })}
        <line
          x1={margen.izquierda}
          x2={ancho - margen.derecha}
          y1={margen.arriba + areaAlto}
          y2={margen.arriba + areaAlto}
          stroke="#c9c7c1"
          strokeWidth={1}
        />
      </svg>

      {d && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200"
          style={{ left: `${(xActivo / ancho) * 100}%` }}
        >
          <p className="text-slate-500">{new Date(`${d.dia}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}</p>
          <p className="text-sm font-bold text-slate-900 tabular-nums">{pesos(d.ventas)}</p>
          <p className="text-slate-500">
            {d.numero} venta(s) · utilidad <span className="font-semibold text-slate-700 tabular-nums">{pesos(d.utilidad)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export type Fila = { etiqueta: string; valor: number; detalle?: string; enlace?: string };

/** Barras horizontales con el valor siempre visible (no depende del tooltip). */
export function BarrasHorizontales({
  filas,
  formato = "pesos",
  vacio = "Sin datos en el periodo.",
}: {
  filas: Fila[];
  formato?: "pesos" | "cantidad" | "porcentaje";
  vacio?: string;
}) {
  if (filas.length === 0) return <p className="py-6 text-center text-sm text-slate-500">{vacio}</p>;
  const max = Math.max(...filas.map((f) => Math.abs(f.valor)), 1);
  const total = filas.reduce((s, f) => s + f.valor, 0);
  const texto = (v: number) =>
    formato === "pesos" ? pesos(v) : formato === "porcentaje" ? `${v.toFixed(1)}%` : v.toLocaleString("es-CO");

  return (
    <ul className="space-y-2.5">
      {filas.map((f, i) => {
        const etiqueta = f.enlace ? (
          <Link href={f.enlace} className="hover:text-blue-700 hover:underline">
            {f.etiqueta}
          </Link>
        ) : (
          f.etiqueta
        );
        return (
          <li key={`${f.etiqueta}-${i}`} title={`${f.etiqueta}: ${texto(f.valor)}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-800">{etiqueta}</span>
              <span className="shrink-0 font-semibold text-slate-900 tabular-nums">
                {texto(f.valor)}
                {formato === "pesos" && filas.length > 1 && total > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-slate-500">{((f.valor / total) * 100).toFixed(0)}%</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-r bg-slate-100">
              <div
                className="h-full rounded-r"
                style={{ width: `${Math.max(1, (Math.abs(f.valor) / max) * 100)}%`, background: SERIE }}
              />
            </div>
            {f.detalle && <p className="mt-0.5 text-xs text-slate-500">{f.detalle}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** Tabla accesible con los datos diarios (alternativa al gráfico). */
export function TablaDias({ dias }: { dias: Dia[] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-blue-700">Ver tabla de datos</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-white text-slate-500">
            <tr>
              <th className="py-1 font-medium">Día</th>
              <th className="py-1 text-right font-medium">Ventas</th>
              <th className="py-1 text-right font-medium">No.</th>
              <th className="py-1 text-right font-medium">Utilidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dias.map((d) => (
              <tr key={d.dia}>
                <td className="py-1">{d.dia}</td>
                <td className="py-1 text-right tabular-nums">{pesos(d.ventas)}</td>
                <td className="py-1 text-right tabular-nums">{d.numero}</td>
                <td className="py-1 text-right tabular-nums">{pesos(d.utilidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
