import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Placa } from "@/components/Placa";
import { Senal } from "@/components/Senal";
import { Tramo } from "@/components/Tramo";
import { Icono, Veredicto } from "@/components/Veredicto";
import estilos from "@/components/panel.module.css";
import { obtenerSesion } from "@/lib/auth/sesion";
import { getDb } from "@/lib/db/client";
import { ciDesdeGitHub } from "@/lib/estado/fuentes";
import { estadoDeProducto, porcentaje } from "@/lib/estado/producto";
import { estadoRepositorio } from "@/lib/github/cliente";

const fecha = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mazatlan",
});
const TEXTO_CI = {
  exito: "Pasa",
  fallo: "Falla",
  en_curso: "En curso",
  desconocido: "Sin datos",
} as const;

export default function Detalle({ params }: PageProps<"/productos/[slug]">) {
  return (
    <Suspense
      fallback={
        <main className={estilos.main}>
          <div className={estilos.esqueleto} role="status">
            <h1 className={estilos.oculto}>Cargando el producto</h1>
          </div>
        </main>
      }
    >
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({
  params,
}: {
  params: PageProps<"/productos/[slug]">["params"];
}) {
  await connection();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/entrar");
  const { slug } = await params;
  const db = getDb();
  const e = await estadoDeProducto(db, slug, { ci: ciDesdeGitHub });
  if (!e) notFound();
  const gh = await estadoRepositorio(db, e.producto.repo, {
    token: process.env.GITHUB_TOKEN,
  }).catch(() => null);

  return (
    <>
      <Placa quien={sesion.demo ? "Demo (solo lectura)" : sesion.login} />
      <main className={estilos.main}>
        <section
          className={`${estilos.cuadro} ${estilos.cabeza}`}
          aria-labelledby="nombre"
        >
          <Senal color={e.semaforo.color} grande />
          <div>
            <h1 id="nombre">{e.producto.nombre}</h1>
            <Veredicto color={e.semaforo.color} />
            {e.semaforo.motivos.length > 0 ? (
              <ul className={estilos.motivos}>
                {e.semaforo.motivos.map((m) => (
                  <li key={m.regla} className={estilos[m.color]}>
                    <Icono color={m.color} />{" "}
                    <span style={{ color: "var(--via)" }}>{m.texto}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={estilos.motivo}>
                Sin observaciones: se puede liberar.
              </p>
            )}
          </div>
        </section>

        <div className={estilos.rejilla}>
          <section
            className={`${estilos.cuadro} ${estilos.panel}`}
            aria-labelledby="t-via"
          >
            <h2 id="t-via">Vía de las últimas 24 horas</h2>
            <Tramo bloques={e.bloques} />
            <dl className={estilos.cifras}>
              <div>
                <dt>Disponibilidad 24 h</dt>
                <dd>{porcentaje(e.disponibilidad24h)}</dd>
              </div>
              <div>
                <dt>Disponibilidad 7 días</dt>
                <dd>{porcentaje(e.disponibilidad7d)}</dd>
              </div>
              <div>
                <dt>p95{e.p95 ? ` (máx. ${e.p95.maximo} ms)` : ""}</dt>
                <dd>
                  {e.p95 ? `${e.p95.ms.toLocaleString("es-MX")} ms` : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className={`${estilos.cuadro} ${estilos.panel}`}
            aria-labelledby="t-gh"
          >
            <h2 id="t-gh">Repositorio en GitHub</h2>
            {gh ? (
              <>
                <ul className={estilos.datos}>
                  <li>
                    <span>CI de main</span>
                    <span>{TEXTO_CI[gh.ci.estado]}</span>
                  </li>
                  <li>
                    <span>Último release</span>
                    <span className={estilos.repo}>
                      {gh.release
                        ? `${gh.release.tag} · ${fecha.format(new Date(gh.release.fecha))}`
                        : "Sin releases"}
                    </span>
                  </li>
                  <li>
                    <span>PRs abiertos</span>
                    <span className={estilos.repo}>{gh.prs.length}</span>
                  </li>
                </ul>
                <p className={estilos.nota}>
                  {gh.avisos[0] ??
                    `Datos de GitHub de ${fecha.format(gh.consultado)} (se actualizan cada 5 min).`}
                </p>
              </>
            ) : (
              <p className={estilos.nota} role="status">
                No se pudo consultar GitHub en este momento.
              </p>
            )}
          </section>

          <section
            className={`${estilos.cuadro} ${estilos.panel}`}
            aria-labelledby="t-inc"
          >
            <h2 id="t-inc">Incidentes (7 días)</h2>
            {e.incidentes.length === 0 ? (
              <p className={estilos.motivo}>
                Sin incidentes en los últimos 7 días.
              </p>
            ) : (
              <ol className={estilos.linea}>
                {e.incidentes.map((i) => (
                  <li key={i.id}>
                    <time dateTime={i.abierto.toISOString()}>
                      {fecha.format(i.abierto)}
                    </time>
                    {i.motivo}{" "}
                    {i.cerrado
                      ? `· resuelto el ${fecha.format(i.cerrado)}`
                      : "· en curso"}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
