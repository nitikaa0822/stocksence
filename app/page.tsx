import StockSense from "./stock-sense";
import { getAppUser } from "@/lib/auth";
import { Boxes, ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAppUser();
  if (!user) {
    return (
      <main className="sign-in-page">
        <section className="sign-in-card">
          <span className="welcome-icon">
            <Boxes size={38} />
          </span>
          <p className="eyebrow">STOCKSENSE</p>
          <h1>Welcome to your inventory workspace.</h1>
          <p>
            Track what you have, where it lives, and every move along the way.
          </p>
          <a
            className="sign-in-button"
            href="/signin-with-chatgpt?return_to=%2F"
            target="_top"
          >
            Sign in with ChatGPT <ArrowRight size={18} />
          </a>
          <a className="logout-link" href="/auth">
            Sign up or sign in with email
          </a>
          <small>
            <ShieldCheck size={16} /> Your inventory stays private to your
            account.
          </small>
        </section>
      </main>
    );
  }
  return <StockSense />;
}
