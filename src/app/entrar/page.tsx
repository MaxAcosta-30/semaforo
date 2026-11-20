import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { EntrarDemo, EntrarGitHub } from "@/components/BotonesSesion";
import estilos from "@/components/panel.module.css";

export const metadata: Metadata = {
  title: "Entrar · Semáforo",
  robots: { index: false },
};

export default function Entrar({ searchParams }: PageProps<"/entrar">) {
  return (
    <Suspense fallback={null}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({
  searchParams,
}: {
  searchParams: PageProps<"/entrar">["searchParams"];
}) {
  await connection();
  const { error } = await searchParams;
  const conGitHub = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);
  return (
    <main className={estilos.main} style={{ maxWidth: 480 }}>
      <div className={`${estilos.cuadro} ${estilos.vacio}`}>
        <h1 className={estilos.marca} style={{ fontSize: 40, margin: 0 }}>
          Semáforo
        </h1>
        <p>Saber si se puede liberar, antes de liberar.</p>
        {error ? (
          <p role="alert" className={estilos.rojo}>
            {error === "AccessDenied"
              ? "Tu cuenta de GitHub no está registrada en Semáforo."
              : "No se pudo iniciar sesión. Intenta de nuevo en un minuto."}
          </p>
        ) : null}
        {conGitHub ? <EntrarGitHub /> : null}
        <EntrarDemo />
        <p className={estilos.nota}>
          La demo es de solo lectura: puedes ver todo, pero no registrar ni
          aprobar.
        </p>
      </div>
    </main>
  );
}
