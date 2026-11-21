"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { esquemaProducto, slugDesde } from "@/lib/productos/esquema";
import { IconoAlto } from "./Iconos";
import estilos from "./formulario.module.css";
import panel from "./panel.module.css";

interface Renglon {
  id: number;
  url: string;
  estado: string;
  latencia: string;
}
type Errores = Record<string, string>;

const MAX_ENDPOINTS = 5;
const nuevoRenglon = (id: number): Renglon => ({
  id,
  url: "",
  estado: "200",
  latencia: "1000",
});

/** Id del campo del DOM para una clave de error del esquema (o null si no tiene campo). */
function idDeCampo(clave: string): string | null {
  if (clave === "nombre" || clave === "slug" || clave === "repo")
    return `f-${clave}`;
  if (clave === "endpoints") return "agregar-endpoint";
  const m = /^endpoints\.(\d+)\.(url|estadoEsperado|latenciaMaximaMs)$/.exec(
    clave,
  );
  return m ? `f-ep-${m[1]}-${m[2]}` : null;
}

/** Caso 2: formulario de registro. La validación de aquí es solo UX; manda el servidor. */
export function FormularioProducto() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [repo, setRepo] = useState("");
  const [publico, setPublico] = useState(false);
  const [renglones, setRenglones] = useState<Renglon[]>([nuevoRenglon(0)]);
  const [siguienteId, setSiguienteId] = useState(1);
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string[]>([]);

  const entrada = (r = renglones) => ({
    nombre,
    slug,
    repo,
    publico,
    endpoints: r.map((e) => ({
      url: e.url,
      estadoEsperado: e.estado.trim() === "" ? NaN : Number(e.estado),
      latenciaMaximaMs: e.latencia.trim() === "" ? NaN : Number(e.latencia),
    })),
  });

  const validar = (r = renglones): Errores => {
    const res = esquemaProducto.safeParse(entrada(r));
    if (res.success) return {};
    const out: Errores = {};
    for (const i of res.error.issues) out[i.path.join(".")] ??= i.message;
    return out;
  };

  // Al escribir se borra el error del campo (el del servidor también: ya no corresponde).
  // Al salir solo se agregan errores; quitarlos en el blur movía el botón bajo el
  // cursor y el clic de "Registrar" se perdía.
  const limpiar = (...claves: string[]) =>
    setErrores((e) => {
      if (!claves.some((c) => c in e)) return e;
      const resto = { ...e };
      for (const c of claves) delete resto[c];
      return resto;
    });

  const alSalir = (clave: string) => {
    const msg = validar()[clave];
    if (msg) setErrores((e) => ({ ...e, [clave]: msg }));
  };

  const mostrar = (nuevos: Errores) => {
    const sinCampo: string[] = [];
    const orden: string[] = [];
    for (const [clave, texto] of Object.entries(nuevos)) {
      const id = idDeCampo(clave);
      if (id && document.getElementById(id)) orden.push(clave);
      else sinCampo.push(texto);
    }
    setErrores(nuevos);
    setGeneral(sinCampo);
    // Primer campo con error en el orden en que aparecen en la página.
    const ids = orden
      .map((c) => idDeCampo(c)!)
      .sort((a, b) =>
        document
          .getElementById(a)!
          .compareDocumentPosition(document.getElementById(b)!) &
        Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
    if (ids[0]) document.getElementById(ids[0])?.focus();
  };

  const actualizar = (id: number, cambio: Partial<Renglon>) =>
    setRenglones((rs) =>
      rs.map((r) => (r.id === id ? { ...r, ...cambio } : r)),
    );

  const quitar = (id: number) => {
    setRenglones((rs) => rs.filter((r) => r.id !== id));
    // Los errores van por posición: al quitar un renglón dejan de corresponder.
    setErrores((e) =>
      Object.fromEntries(
        Object.entries(e).filter(([k]) => !k.startsWith("endpoints.")),
      ),
    );
  };

  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    setGeneral([]);
    const locales = validar();
    if (Object.keys(locales).length > 0) return mostrar(locales);
    setErrores({});
    iniciar(async () => {
      let r: Response;
      try {
        r = await fetch("/api/productos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(esquemaProducto.parse(entrada())),
        });
      } catch {
        return setGeneral([
          "No se pudo registrar. Revisa tu conexión e inténtalo otra vez.",
        ]);
      }
      if (r.status === 201) return router.push(`/productos/${slug.trim()}`);
      if (r.status === 401) return router.push("/entrar");
      if (r.status === 403)
        return setGeneral(["Solo el administrador puede registrar productos."]);
      if (r.status === 400 || r.status === 409) {
        const cuerpo = (await r.json().catch(() => null)) as {
          errores?: Errores;
        } | null;
        if (cuerpo?.errores) return mostrar(cuerpo.errores);
      }
      setGeneral(["No se pudo registrar. Inténtalo otra vez."]);
    });
  };

  /** Atributos comunes de un campo con ayuda y/o error. */
  const campo = (clave: string, id: string, ayuda?: string) => ({
    id,
    "aria-invalid": errores[clave] ? (true as const) : undefined,
    "aria-describedby":
      [ayuda ? `${id}-ayuda` : "", errores[clave] ? `${id}-error` : ""]
        .filter(Boolean)
        .join(" ") || undefined,
    onBlur: () => alSalir(clave),
  });
  const mensaje = (clave: string, id: string) =>
    errores[clave] ? (
      <p id={`${id}-error`} className={estilos.error}>
        <IconoAlto />
        <span>{errores[clave]}</span>
      </p>
    ) : null;

  return (
    <form className={estilos.form} onSubmit={enviar} noValidate>
      <div className={estilos.campo}>
        <label htmlFor="f-nombre">Nombre</label>
        <input
          className={estilos.entrada}
          type="text"
          autoComplete="off"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            if (slugManual) limpiar("nombre");
            else {
              setSlug(slugDesde(e.target.value));
              limpiar("nombre", "slug");
            }
          }}
          {...campo("nombre", "f-nombre")}
        />
        {mensaje("nombre", "f-nombre")}
      </div>

      <div className={estilos.campo}>
        <label htmlFor="f-slug">Slug</label>
        <input
          className={estilos.entrada}
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugManual(e.target.value !== "");
            limpiar("slug");
          }}
          {...campo("slug", "f-slug", "x")}
        />
        <p id="f-slug-ayuda" className={estilos.ayuda}>
          Va en la dirección: /productos/{slug.trim() || "mi-tienda"}. Se genera
          desde el nombre.
        </p>
        {mensaje("slug", "f-slug")}
      </div>

      <div className={estilos.campo}>
        <label htmlFor="f-repo">Repositorio de GitHub</label>
        <input
          className={estilos.entrada}
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="dueño/repositorio"
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            limpiar("repo");
          }}
          {...campo("repo", "f-repo")}
        />
        {mensaje("repo", "f-repo")}
      </div>

      <label className={estilos.casilla}>
        <input
          type="checkbox"
          checked={publico}
          onChange={(e) => setPublico(e.target.checked)}
        />
        Mostrar en la página pública
      </label>

      <fieldset className={estilos.grupo}>
        <legend className={estilos.leyenda}>
          Endpoints a vigilar ({renglones.length} de {MAX_ENDPOINTS})
        </legend>
        {renglones.map((r, i) => {
          const base = `f-ep-${i}`;
          const k = `endpoints.${i}`;
          return (
            <div key={r.id} className={estilos.renglon}>
              <div className={estilos.renglonCabeza}>
                <h3>Endpoint {i + 1}</h3>
                {renglones.length > 1 ? (
                  <button
                    type="button"
                    className={panel.boton}
                    onClick={() => quitar(r.id)}
                    aria-label={`Quitar el endpoint ${i + 1}`}
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
              <div className={estilos.numeros}>
                <div className={estilos.campo}>
                  <label htmlFor={`${base}-url`}>URL</label>
                  <input
                    className={estilos.entrada}
                    type="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://ejemplo.com/salud"
                    value={r.url}
                    onChange={(e) => {
                      actualizar(r.id, { url: e.target.value });
                      limpiar(`${k}.url`);
                    }}
                    {...campo(`${k}.url`, `${base}-url`, "x")}
                  />
                  <p id={`${base}-url-ayuda`} className={estilos.ayuda}>
                    Debe ser https y pública; no se aceptan direcciones
                    internas.
                  </p>
                  {mensaje(`${k}.url`, `${base}-url`)}
                </div>
                <div className={estilos.campo}>
                  <label htmlFor={`${base}-estadoEsperado`}>
                    Estado esperado
                  </label>
                  <input
                    className={`${estilos.entrada} ${estilos.numero}`}
                    type="number"
                    inputMode="numeric"
                    value={r.estado}
                    onChange={(e) => {
                      actualizar(r.id, { estado: e.target.value });
                      limpiar(`${k}.estadoEsperado`);
                    }}
                    {...campo(`${k}.estadoEsperado`, `${base}-estadoEsperado`)}
                  />
                  {mensaje(`${k}.estadoEsperado`, `${base}-estadoEsperado`)}
                </div>
                <div className={estilos.campo}>
                  <label htmlFor={`${base}-latenciaMaximaMs`}>
                    Latencia máxima (ms)
                  </label>
                  <input
                    className={`${estilos.entrada} ${estilos.numero}`}
                    type="number"
                    inputMode="numeric"
                    value={r.latencia}
                    onChange={(e) => {
                      actualizar(r.id, { latencia: e.target.value });
                      limpiar(`${k}.latenciaMaximaMs`);
                    }}
                    {...campo(
                      `${k}.latenciaMaximaMs`,
                      `${base}-latenciaMaximaMs`,
                    )}
                  />
                  {mensaje(`${k}.latenciaMaximaMs`, `${base}-latenciaMaximaMs`)}
                </div>
              </div>
            </div>
          );
        })}
        <div className={estilos.acciones}>
          <button
            id="agregar-endpoint"
            type="button"
            className={panel.boton}
            disabled={renglones.length >= MAX_ENDPOINTS}
            onClick={() => {
              setRenglones((rs) => [...rs, nuevoRenglon(siguienteId)]);
              setSiguienteId((n) => n + 1);
            }}
          >
            Agregar endpoint
          </button>
        </div>
        {errores.endpoints ? (
          <p className={estilos.error}>
            <IconoAlto />
            <span>{errores.endpoints}</span>
          </p>
        ) : null}
      </fieldset>

      {general.length > 0 ? (
        <div role="alert" className={estilos.general}>
          {general.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
      ) : null}

      <div className={estilos.acciones}>
        <button
          type="submit"
          className={`${panel.boton} ${panel.primario}`}
          disabled={pendiente}
          style={{ minHeight: 44 }}
        >
          {pendiente ? "Registrando…" : "Registrar producto"}
        </button>
      </div>
    </form>
  );
}
