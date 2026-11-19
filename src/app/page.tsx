import { connection } from "next/server";
import { Suspense } from "react";
import { isDbReachable } from "@/lib/db/client";

async function DbStatus() {
  await connection();
  const ok = await isDbReachable();
  return <p>Base de datos: {ok ? "conectada" : "sin conexión"}</p>;
}

export default function Home() {
  return (
    <main>
      <h1>Semáforo</h1>
      <p>Saber si se puede liberar, antes de liberar.</p>
      <Suspense fallback={<p>Base de datos: comprobando…</p>}>
        <DbStatus />
      </Suspense>
    </main>
  );
}
