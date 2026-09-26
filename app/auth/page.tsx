import { authConfigured } from "@/lib/auth";
import AuthScreen from "./screen";
export const dynamic = "force-dynamic";
export default function AuthPage() {
  return <AuthScreen configured={authConfigured()} />;
}
