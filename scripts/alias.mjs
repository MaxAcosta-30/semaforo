// Permite correr TypeScript de src/ con Node 24 (sin dependencias nuevas):
// resuelve el alias "@/" y los imports relativos sin extensión.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const src = new URL("../src/", import.meta.url);

function conExtension(url) {
  for (const ext of [".ts", ".tsx", "/index.ts"]) {
    const candidato = new URL(url.href + ext);
    if (existsSync(fileURLToPath(candidato))) return candidato.href;
  }
  return null;
}

registerHooks({
  resolve(especificador, contexto, siguiente) {
    let destino = null;
    if (especificador.startsWith("@/"))
      destino = conExtension(new URL(especificador.slice(2), src));
    else if (especificador.startsWith(".") && contexto.parentURL)
      destino = conExtension(new URL(especificador, contexto.parentURL));
    if (destino) return siguiente(destino, contexto);
    return siguiente(especificador, contexto);
  },
});
