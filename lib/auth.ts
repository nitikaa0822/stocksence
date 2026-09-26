import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export function authConfigured() {
  const config = env as unknown as Record<string, string | undefined>;
  return Boolean(config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY);
}

export async function authClient() {
  if (!authConfigured()) return null;
  const config = env as unknown as Record<string, string>;
  const jar = await cookies();
  return createServerClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          // Route handlers persist refreshed sessions; rendering may be read-only.
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, {
                ...options,
                httpOnly: true,
                sameSite: "lax",
              }),
            );
          } catch {}
        },
      },
    },
  );
}

export async function getAppUser() {
  const jar = await cookies();
  const hasEmailSession = jar
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (hasEmailSession) {
    const client = await authClient();
    if (!client) return null;
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return null;
    return {
      userId: `supabase:${user.id}`,
      email: user.email || "",
      displayName:
        user.user_metadata.display_name || user.email || "Inventory manager",
      fullName: null,
    };
  }
  return getChatGPTUser();
}
