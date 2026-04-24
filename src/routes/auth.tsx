import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { NeonButton } from "@/components/NeonButton";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowLeft } from "lucide-react";

const searchSchema = z.object({
  guest: z.boolean().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign In — Clutch Squares" },
      { name: "description", content: "Sign in or continue as a guest." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "guest";

function AuthPage() {
  const { user, loading, signIn, signUp, signInWithGoogle, signInAsGuest } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.guest ? "guest" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: search.redirect || "/dashboard" });
    }
  }, [user, loading, navigate, search.redirect]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "guest") {
        if (!displayName.trim()) throw new Error("Display name is required");
        await signInAsGuest(displayName.trim());
        toast.success(`Welcome, ${displayName.trim()}!`);
      } else if (mode === "signup") {
        if (!displayName.trim()) throw new Error("Display name is required");
        await signUp(email.trim(), password, displayName.trim());
        toast.success("Account created — you're in!");
      } else {
        await signIn(email.trim(), password);
        toast.success("Welcome back!");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const google = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-mono uppercase tracking-widest mb-6">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>

        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl tracking-tight">
            <span className="text-[color:var(--neon-blue)]">CLUTCH</span>{" "}
            <span className="text-[color:var(--neon-green)]">SQUARES</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {mode === "guest" ? "Quick join — just pick a name" : mode === "signup" ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[color:var(--surface)] rounded-xl border border-border mb-5">
          <TabBtn active={mode === "signin"} onClick={() => setMode("signin")}>Sign In</TabBtn>
          <TabBtn active={mode === "signup"} onClick={() => setMode("signup")}>Sign Up</TabBtn>
          <TabBtn active={mode === "guest"} onClick={() => setMode("guest")}>Guest</TabBtn>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {(mode === "signup" || mode === "guest") && (
            <Field
              icon={<User className="w-4 h-4" />}
              placeholder="Display name"
              value={displayName}
              onChange={setDisplayName}
              maxLength={40}
            />
          )}
          {mode !== "guest" && (
            <>
              <Field
                icon={<Mail className="w-4 h-4" />}
                type="email"
                placeholder="Email"
                value={email}
                onChange={setEmail}
              />
              <Field
                icon={<Lock className="w-4 h-4" />}
                type="password"
                placeholder="Password"
                value={password}
                onChange={setPassword}
                minLength={6}
              />
            </>
          )}

          <NeonButton
            type="submit"
            variant="blue"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? "..." : mode === "guest" ? "Continue as Guest" : mode === "signup" ? "Create Account" : "Sign In"}
          </NeonButton>
        </form>

        {mode !== "guest" && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <button
              type="button"
              onClick={google}
              className="w-full flex items-center justify-center gap-3 bg-[color:var(--surface)] border border-border hover:border-[color:var(--neon-blue)] rounded-xl px-5 py-3 font-display font-bold text-sm uppercase tracking-wide transition"
            >
              <GoogleIcon /> Continue with Google
            </button>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing you agree to fair play and good vibes. 🏀
        </p>
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition ${
        active ? "bg-[color:var(--neon-blue)] text-background" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  icon, value, onChange, type = "text", placeholder, maxLength, minLength,
}: {
  icon: React.ReactNode; value: string; onChange: (v: string) => void;
  type?: string; placeholder: string; maxLength?: number; minLength?: number;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        minLength={minLength}
        required
        className="w-full bg-[color:var(--surface)] border border-border rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-[color:var(--neon-blue)] transition"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
