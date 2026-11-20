import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { IconoAlto, IconoOk, IconoPrecaucion } from "@/components/Iconos";
import { Senal, type ColorSenal } from "@/components/Senal";
import { Tramo } from "@/components/Tramo";
import { getDb } from "@/lib/db/client";
import {
  estadoDeProducto,
  type EstadoPublico,
  porcentaje,
} from "@/lib/estado/producto";
import estilos from "./estilos.module.css";

// Caso 8: estado público. Solo productos marcados como públicos y sin datos internos
// (ni CI, ni checklist, ni URLs de los endpoints).

const TEXTO: Record<
  EstadoPublico,
  { color: ColorSenal; texto: string; Icono: () => React.JSX.Element }
> = {
  normal: {
    color: "verde",
    texto: "Funcionando con normalidad",
    Icono: IconoOk,
  },
  degradado: {
    color: "amarillo",
    texto: "Funcionando con fallas intermitentes",
    Icono: IconoPrecaucion,
  },
  "sin-datos": {
    color: null,
    texto: "Todavía sin datos de monitoreo",
    Icono: IconoPrecaucion,
  },
  incidente: {
    color: "rojo",
    texto: "Con un incidente en curso",
    Icono: IconoAlto,
  },
};

const fecha = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mazatlan",
});

export async function generateMetadata({
  params,
}: PageProps<"/status/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Estado de ${slug} · Semáforo`, robots: { index: false } };
}

export default function Pagina({ params }: PageProps<"/status/[slug]">) {
  return (
    <main className={estilos.pagina}>
      <Link className={estilos.marca} href="/">
        Semáforo
      </Link>
      <Suspense
        fallback={
          <section className={estilos.esqueleto} role="status">
            <h1 className={estilos.oculto}>Cargando el estado del servicio</h1>
          </section>
        }
      >
        <Estado params={params} />
      </Suspense>
    </main>
  );
}

async function Estado({
  params,
}: {
  params: PageProps<"/status/[slug]">["params"];
}) {
  await connection();
  const { slug } = await params;
  const estado = await estadoDeProducto(getDb(), slug);
  if (!estado || !estado.producto.publico) notFound(); // un producto privado es indistinguible de uno inexistente

  const { color, texto, Icono } = TEXTO[estado.publico];
  return (
    <section className={estilos.cuadro} aria-labelledby="nombre">
      <div className={estilos.cabeza}>
        <Senal color={color} grande />
        <div>
          <h1 id="nombre">{estado.producto.nombre}</h1>
          <p className={`${estilos.veredicto} ${estilos[estado.publico]}`}>
            <Icono /> {texto}
          </p>
        </div>
      </div>
      <Tramo bloques={estado.bloques} />
      <dl className={estilos.cifras}>
        <div>
          <dt>Disponibilidad 24 h</dt>
          <dd>{porcentaje(estado.disponibilidad24h)}</dd>
        </div>
        <div>
          <dt>Disponibilidad 7 días</dt>
          <dd>{porcentaje(estado.disponibilidad7d)}</dd>
        </div>
      </dl>
      {estado.incidentes.length === 0 ? (
        <p className={estilos.nota}>
          Sin incidentes en los últimos 7 días. Revisado cada 15 minutos.
        </p>
      ) : (
        <div>
          <h2 className={estilos.nota}>Incidentes de los últimos 7 días</h2>
          <ul className={estilos.incidentes}>
            {estado.incidentes.map((i) => (
              <li key={i.id}>
                <time dateTime={i.abierto.toISOString()}>
                  {fecha.format(i.abierto)}
                </time>
                {i.cerrado
                  ? `Resuelto el ${fecha.format(i.cerrado)}`
                  : "En curso"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
