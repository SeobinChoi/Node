import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "./auth.config";

// 비밀번호 없이 이메일만으로 로그인하는 개발 전용 통로.
// 프로덕션에서는 절대 켜지지 않도록 NODE_ENV와 명시적 플래그를 함께 확인한다.
export const devLoginEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEV_LOGIN === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  logger: {
    error(code, ...message) {
      console.error("[auth][logger][error]", code, ...message);
    },
    warn(code, ...message) {
      console.warn("[auth][logger][warn]", code, ...message);
    },
  },
  ...authConfig,
  // authConfig의 providers를 덮어써야 하므로 스프레드 뒤에 온다.
  providers: [
    ...authConfig.providers,
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev-login",
            name: "Developer login",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              const email =
                typeof credentials?.email === "string"
                  ? credentials.email.trim().toLowerCase()
                  : "";

              if (!email) return null;

              // 로컬 DB가 비어 있어도 바로 들어갈 수 있도록 없으면 만든다.
              const user = await prisma.user.upsert({
                where: { email },
                update: {},
                create: { email, name: email.split("@")[0] },
                select: { id: true, email: true, name: true, image: true },
              });

              return user;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        } else if (session.user.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
          });

          if (dbUser) {
            session.user.id = dbUser.id;
          }
        }
      }

      return session;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    ...authConfig.callbacks,
  },
});
