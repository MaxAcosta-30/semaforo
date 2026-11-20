"use client";

import { signIn, signOut } from "next-auth/react";
import estilos from "./panel.module.css";

export function EntrarDemo() {
  return (
    <button
      type="button"
      className={`${estilos.boton} ${estilos.primario}`}
      onClick={() => signIn("demo", { callbackUrl: "/" })}
    >
      Entrar como demo
    </button>
  );
}

export function EntrarGitHub() {
  return (
    <button
      type="button"
      className={estilos.boton}
      onClick={() => signIn("github", { callbackUrl: "/" })}
    >
      Entrar con GitHub
    </button>
  );
}

export function Salir() {
  return (
    <button
      type="button"
      className={estilos.boton}
      onClick={() => signOut({ callbackUrl: "/entrar" })}
    >
      Salir
    </button>
  );
}
