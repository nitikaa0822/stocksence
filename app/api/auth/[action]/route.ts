import { authClient } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
export const dynamic = "force-dynamic";
const email = z.string().trim().email().max(254);
const password = z.string().min(8).max(128);
const token = z.string().regex(/^\d{6,10}$/, "Enter the code from your email.");
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "Request origin was not accepted." }, 403);
  try {
    const { action } = await context.params;
    const client = await authClient();
    if (action === "logout") {
      if (client) await client.auth.signOut();
      const jar = await cookies();
      jar
        .getAll()
        .filter((c) => c.name.startsWith("sb-"))
        .forEach((c) => jar.delete(c.name));
      return reply({ ok: true });
    }
    if (!client)
      return reply(
        {
          error:
            "Email accounts are not configured yet. Use the existing sign-in for the demo.",
        },
        503,
      );
    const raw = await request.text();
    if (raw.length > 4096)
      return reply({ error: "Request is too large." }, 413);
    const body = JSON.parse(raw);
    let result;
    if (action === "signup") {
      const input = z
        .object({ email, password, name: z.string().trim().min(2).max(80) })
        .parse(body);
      result = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.name } },
      });
      if (!result.error)
        return reply({ ok: true, verify: !result.data.session });
    } else if (action === "login") {
      result = await client.auth.signInWithPassword(
        z.object({ email, password: z.string().min(1).max(128) }).parse(body),
      );
    } else if (action === "verify") {
      const input = z.object({ email, token }).parse(body);
      result = await client.auth.verifyOtp({ ...input, type: "signup" });
    } else if (action === "request-reset") {
      const input = z.object({ email }).parse(body);
      result = await client.auth.resetPasswordForEmail(input.email);
      if (!result.error)
        return reply({
          ok: true,
          message:
            "If an account exists, a recovery code will arrive by email.",
        });
    } else if (action === "reset") {
      const input = z.object({ email, token, password }).parse(body);
      const verified = await client.auth.verifyOtp({
        email: input.email,
        token: input.token,
        type: "recovery",
      });
      if (verified.error)
        return reply(
          {
            error: "Code is invalid or expired. Request a fresh recovery code.",
          },
          400,
        );
      result = await client.auth.updateUser({ password: input.password });
    } else return reply({ error: "Unknown account action." }, 404);
    if (result.error)
      return reply(
        { error: result.error.message },
        result.error.status === 429 ? 429 : 400,
      );
    return reply({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return reply(
        { error: error.issues.map((i) => i.message).join(" ") },
        400,
      );
    if (error instanceof SyntaxError)
      return reply({ error: "Invalid request." }, 400);
    return reply(
      { error: "Account service is unavailable. Please try again." },
      503,
    );
  }
}
