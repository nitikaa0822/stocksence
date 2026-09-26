"use client";
import { useState, type FormEvent } from "react";
import { Boxes, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
type Mode = "login" | "signup" | "verify" | "request-reset" | "reset";
const titles: Record<Mode, string> = {
  login: "Welcome back.",
  signup: "Create your workspace.",
  verify: "Verify your email.",
  "request-reset": "Recover your account.",
  reset: "Choose a new password.",
};
export default function AuthScreen({ configured }: { configured: boolean }) {
  const [mode, setMode] = useState<Mode>("login"),
    [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  function switchTo(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setToken("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, token }),
      });
      const result = (await r.json()) as {
        error?: string;
        verify?: boolean;
        message?: string;
      };
      if (!r.ok) throw new Error(result.error);
      if (mode === "signup" && result.verify) {
        switchTo("verify");
        setMessage("Enter the confirmation code sent to your email.");
      } else if (mode === "request-reset") {
        switchTo("reset");
        setMessage(result.message || "Check your email for a recovery code.");
      } else window.location.assign("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="sign-in-page">
      <section className="sign-in-card auth-card">
        <span className="welcome-icon">
          <Boxes size={38} />
        </span>
        <p className="eyebrow">STOCKSENSE</p>
        <h1>{titles[mode]}</h1>
        <p>Clear stock. Confident decisions.</p>
        {!configured && (
          <p className="info-note">
            Email signup and recovery will be available after account setup. You
            can use the sign-in below for the demo.
          </p>
        )}
        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label>
              Your name
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                minLength={2}
              />
            </label>
          )}
          <label>
            Email address
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          {(mode === "verify" || mode === "reset") && (
            <label>
              Email code
              <Input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
          )}
          {!["request-reset", "verify"].includes(mode) && (
            <label>
              {mode === "reset" ? "New password" : "Password"}
              <Input
                type="password"
                required
                minLength={mode === "login" ? 1 : 8}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <Button disabled={!configured || busy} type="submit">
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "request-reset"
                  ? "Send recovery code"
                  : mode === "verify"
                    ? "Verify email"
                    : mode === "reset"
                      ? "Save new password"
                      : "Sign in"}
            <ArrowRight size={16} />
          </Button>
        </form>
        <div className="auth-links">
          <Button
            variant="ghost"
            onClick={() => switchTo(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Create an account" : "Back to sign in"}
          </Button>
          <Button variant="ghost" onClick={() => switchTo("request-reset")}>
            Forgot password?
          </Button>
        </div>
        <a
          className="sign-in-button"
          href="/signin-with-chatgpt?return_to=%2F"
          target="_top"
        >
          Continue with ChatGPT <ArrowRight size={18} />
        </a>
        <a href="/">Return to inventory</a>
      </section>
    </main>
  );
}
