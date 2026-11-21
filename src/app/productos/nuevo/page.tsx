import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormularioProducto } from "@/components/FormularioProducto";
import { Placa } from "@/components/Placa";
import estilos from "@/components/panel.module.css";
import { obtenerSesion, puedeEscribir } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Registrar producto · Semáforo" };

export default function Nuevo() {
  return (
    <Suspense
      fallback={
        <main className={estilos.main}>
          <div className={estilos.esqueleto} role="status">
            <h1 className={estilos.oculto}>Cargando el formulario</h1>
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

  return (
    <>
      <Placa quien={sesion.demo ? "Demo (solo lectura)" : sesion.login} />
      <main className={estilos.main}>
        <div className={estilos.titular}>
          <h1>Registrar producto</h1>
        </div>
        {puedeEscribir(sesion) ? (
          <FormularioProducto />
        ) : (
          <>
            <p className={estilos.motivo}>
              Solo el administrador puede registrar productos. La demo es de
              solo lectura.
            </p>
            <p style={{ marginTop: 16 }}>
              <Link href="/" className={estilos.boton}>
                Volver al tablero
              </Link>
            </p>
          </>
        )}
      </main>
    </>
  );
}
