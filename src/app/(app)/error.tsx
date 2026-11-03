"use client";

export default function ErrorApp({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 ring-1 ring-red-200">
      <h2 className="font-semibold text-red-700">No se pudo completar la operación</h2>
      <p className="mt-2 text-sm text-slate-600">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
      >
        Volver a intentar
      </button>
    </div>
  );
}
