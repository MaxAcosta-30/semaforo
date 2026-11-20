import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Placa } from "@/components/Placa";
import { Senal } from "@/components/Senal";
import { Tramo } from "@/components/Tramo";
import { Veredicto } from "@/components/Veredicto";
import estilos from "@/components/panel.module.css";
import { obtenerSesion, puedeEscribir } from "@/lib/auth/sesion";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { ciDesdeGitHub } from "@/lib/estado/fuentes";
import { estadoDeProducto, porcentaje } from "@/lib/estado/producto";

export default function Tablero() {
  return (
    <Suspense
      fallback={
        <main className={estilos.main}>
          <div className={estilos.esqueleto} role="status">
            <h1 className={estilos.oculto}>Cargando el tablero</h1>
          </div>
        </main>
      }
    >
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await connection();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/entrar");

  const db = getDb();
  const lista = await db
    .select({ slug: products.slug })
    .from(products)
    .orderBy(products.name);
  const estados = (
    await Promise.all(
      lista.map((p) => estadoDeProducto(db, p.slug, { ci: ciDesdeGitHub })),
    )
  ).filter((e) => e !== null);
  const cuenta = (c: string) =>
    estados.filter((e) => e.semaforo.color === c).length;

  return (
    <>
      <Placa quien={sesion.demo ? "Demo (solo lectura)" : sesion.login} />
      <main className={estilos.main}>
        <div className={estilos.titular}>
          <h1>¿Se puede liberar?</h1>
          {estados.length > 0 ? (
            <p className={estilos.motivo}>
              {cuenta("verde")} en verde · {cuenta("amarillo")} en precaución ·{" "}
              {cuenta("rojo")} en alto
            </p>
          ) : null}
        </div>
        <div className={estilos.cuadro}>
          {estados.length === 0 ? (
            <div className={estilos.vacio}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Sin productos</h2>
              <p>
                Todavía no vigilas ningún producto. Registra su URL de salud y
                su repositorio para empezar.
              </p>
              {puedeEscribir(sesion) ? (
                <p>
                  <Link
                    className={`${estilos.boton} ${estilos.primario}`}
                    href="/productos/nuevo"
                  >
                    Registrar producto
                  </Link>
                </p>
              ) : null}
            </div>
          ) : (
            <ul className={estilos.vias}>
              {estados.map((e) => (
                <li key={e.producto.id} className={estilos.fila}>
                  <div>
                    <h2>
                      <Link href={`/productos/${e.producto.slug}`}>
                        {e.producto.nombre}
                      </Link>
                    </h2>
                    <p className={estilos.repo}>{e.producto.repo}</p>
                  </div>
                  <Tramo
                    bloques={e.bloques}
                    derecha={`${porcentaje(e.disponibilidad24h)} en 24 h`}
                  />
                  <div className={estilos.senalMotivo}>
                    <Senal color={e.semaforo.color} />
                    <div>
                      <Veredicto color={e.semaforo.color} />
                      <p className={estilos.motivo}>
                        {e.semaforo.motivos[0]?.texto ?? "Sin observaciones"}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
