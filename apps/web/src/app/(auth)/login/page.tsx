"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { api, ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth";
import { Wrench, Shield, BarChart3, Car, AlertTriangle } from "lucide-react";

interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  };
}

const FEATURES = [
  { icon: Wrench, text: "Gestion complète des réparations" },
  { icon: Shield, text: "Suivi en temps réel des véhicules" },
  { icon: BarChart3, text: "Rapports et statistiques avancés" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      const { accessToken, refreshToken, user } = res.data;

      authStorage.setTokens(accessToken, refreshToken);
      authStorage.setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: user.role as any,
      });

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left brand panel ────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-gradient flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative background gears */}
        <div className="pointer-events-none absolute -right-16 -top-16 opacity-[0.06]">
          <svg width="320" height="320" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <circle cx="50" cy="50" r="28" fill="white" />
            <circle
              cx="50"
              cy="50"
              r="14"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
          </svg>
        </div>
        <div className="pointer-events-none absolute -left-24 bottom-16 opacity-[0.04]">
          <svg width="280" height="280" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="white" />
          </svg>
        </div>

        {/* Top: wordmark */}
        <div className="flex items-center gap-3 relative z-10">
          <Logo size="md" />
          <div>
            <span className="block text-xl font-black tracking-wide text-white">
              SAGMAN
            </span>
            <span className="block text-xs uppercase tracking-widest text-blue-300">
              Auto Repairs
            </span>
          </div>
        </div>

        {/* Center: hero content */}
        <div className="relative z-10 space-y-6">
          {/* Animated large gear */}
          <div className="flex justify-center mb-6">
            <div className="gear-spin-slow">
              <Logo size="xl" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight">
            Gérez votre garage
            <br />
            <span className="text-blue-300">intelligemment</span>
          </h1>
          <p className="text-blue-200 text-base leading-relaxed max-w-xs">
            Système de gestion intégré pour le suivi des réparations, la gestion
            du stock et la satisfaction client.
          </p>

          <ul className="space-y-3 pt-2">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-blue-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: copyright */}
        <p className="relative z-10 text-xs text-blue-300/70">
          &copy; {new Date().getFullYear()} Sagman — Tous droits réservés
        </p>
      </div>

      {/* ── Right login panel ───────────────────────── */}
      <div className="flex flex-1 flex-col bg-background">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-border/60">
          {/* Mobile-only logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <Logo size="sm" />
            <span className="font-bold text-foreground">SAGMAN</span>
          </div>
          {/* Spacer on desktop so switcher sits on the right */}
          <div className="hidden lg:block" />
          <LanguageSwitcher />
        </div>

        {/* Centered form */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm space-y-8 animate-fade-in">
            {/* Heading */}
            <div>
              <h2 className="text-2xl font-bold text-foreground">Connexion</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Accédez au système de gestion du garage
              </p>
            </div>

            {/* Error alert */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="manager@sagman.garage"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full text-base font-semibold"
                isLoading={isLoading}
              >
                {isLoading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Mot de passe oublié ? Contactez votre responsable.
            </p>

            {/* Client portal link */}
            <div className="space-y-3">
              <div className="relative flex items-center">
                <div className="flex-1 border-t border-border" />
                <span className="mx-3 bg-background px-1 text-xs text-muted-foreground">
                  Vous êtes client&nbsp;?
                </span>
                <div className="flex-1 border-t border-border" />
              </div>

              <a
                href="/portal"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Car className="h-4 w-4" />
                Accéder au portail client
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
