"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import estilos from "./panel.module.css";

interface Props {
  slug: string;
  version: string;
  renglones: { texto: string; marcado: boolean; por: string | null }[];
  puedeEscribir: boolean;
  rojo: boolean;
  yaAprobada: boolean;
}

/** Caso 6: checklist de la versión candidata y botón de aprobar (solo admin; nunca en rojo). */
export function PanelChecklist({
  slug,
  version,
  renglones,
  puedeEscribir,
  rojo,
  yaAprobada,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // La casilla cambia al instante; si el servidor lo rechaza, vuelve sola al terminar la transición.
  const [marcas, marcarOptimista] = useOptimistic(
    renglones,
    (actual, cambio: { texto: string; marcado: boolean }) =>
      actual.map((r) =>
        r.texto === cambio.texto ? { ...r, marcado: cambio.marcado } : r,
      ),
  );

  const enviar = (url: string, init: RequestInit, antes?: () => void) =>
    iniciar(async () => {
      antes?.();
      setError(null);
      const r = await fetch(url, {
        ...init,
        headers: { "content-type": "application/json" },
      });
      if (!r.ok)
        setError(
          ((await r.json().catch(() => ({}))) as { error?: string }).error ??
            "No se pudo guardar.",
        );
      router.refresh();
    });

  const motivoBloqueo = !puedeEscribir
    ? "Solo el administrador puede aprobar; la demo es de solo lectura."
    : rojo
      ? "Con rojo no se puede aprobar."
      : yaAprobada
        ? `La versión ${version} ya está aprobada.`
        : null;

  return (
    <div>
      <ul className={estilos.datos}>
        {marcas.map((r) => (
          <li key={r.texto}>
            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                minHeight: 44,
                cursor: puedeEscribir ? "pointer" : "default",
              }}
            >
              <input
                type="checkbox"
                checked={r.marcado}
                disabled={!puedeEscribir || pendiente}
                onChange={(e) => {
                  const marcado = e.target.checked;
                  enviar(
                    `/api/productos/${slug}/checklist`,
                    {
                      method: "POST",
                      body: JSON.stringify({ item: r.texto, marcado }),
                    },
                    () => marcarOptimista({ texto: r.texto, marcado }),
                  );
                }}
                style={{ width: 18, height: 18, accentColor: "var(--via)" }}
              />
              {r.texto}
            </label>
            <span className={estilos.repo}>{r.por ?? ""}</span>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 14 }}>
        <button
          type="button"
          className={`${estilos.boton} ${estilos.primario}`}
          disabled={motivoBloqueo !== null || pendiente}
          aria-describedby="motivo-aprobar"
          onClick={() =>
            enviar(`/api/productos/${slug}/aprobar`, { method: "POST" })
          }
        >
          Aprobar {version}
        </button>
      </p>
      <p id="motivo-aprobar" className={estilos.nota}>
        {motivoBloqueo ??
          "Se guarda quién aprobó, cuándo y el color en ese momento."}
      </p>
      {error ? (
        <p role="alert" className={estilos.rojo}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
