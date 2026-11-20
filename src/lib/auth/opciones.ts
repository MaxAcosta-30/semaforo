// Caso 1 y caso 9. Solo entran cuentas de GitHub registradas en `members`; "Entrar como
// demo" da acceso de lector. La sesión es un JWT en cookie HttpOnly (sin tabla de sesiones).

import { eq } from "drizzle-orm";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { ipDe, permitir } from "@/lib/limites";

export type Rol = "admin" | "lector";

export interface Miembro {
  rol: Rol;
  login: string;
}

export type BuscarMiembro = (githubId: number) => Promise<Miembro | null>;

export const buscarMiembroEnDb: BuscarMiembro = async (githubId) => {
  const [m] = await getDb()
    .select()
    .from(members)
    .where(eq(members.githubId, githubId));
  return m ? { rol: m.role, login: m.githubLogin } : null;
};

export const DEMO_ID = "demo";

/** Callbacks separados para probarlos sin GitHub ni Next. */
export function callbacks(
  buscar: BuscarMiembro,
): NonNullable<NextAuthOptions["callbacks"]> {
  return {
    async signIn({ account }) {
      if (account?.provider === DEMO_ID) return true;
      if (account?.provider !== "github") return false;
      // Solo entran usuarios de la tabla members (se rechaza con la página de error).
      return (await buscar(Number(account.providerAccountId))) !== null;
    },
    async jwt({ token, account }) {
      if (account?.provider === DEMO_ID) {
        return { ...token, rol: "lector" as Rol, demo: true, login: "demo" };
      }
      if (account?.provider === "github") {
        const m = await buscar(Number(account.providerAccountId));
        return {
          ...token,
          rol: m?.rol ?? "lector",
          demo: false,
          login: m?.login ?? "",
        };
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        rol: (token.rol as Rol) ?? "lector",
        demo: Boolean(token.demo),
        login: String(token.login ?? ""),
      };
    },
  };
}

const proveedores: NextAuthOptions["providers"] = [
  CredentialsProvider({
    id: DEMO_ID,
    name: "Demo",
    credentials: {},
    async authorize(_credenciales, req) {
      // 10 entradas por minuto por IP: suficiente para la demo, inútil para abusar.
      const ip = ipDe((req?.headers ?? {}) as Record<string, string>);
      if (!(await permitir(getDb(), `demo:${ip}`, 10, 60_000))) return null;
      return { id: DEMO_ID, name: "Visitante de la demo" };
    },
  }),
];
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  proveedores.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers: proveedores,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/entrar", error: "/entrar" },
  callbacks: callbacks(buscarMiembroEnDb),
};
