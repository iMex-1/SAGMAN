"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { Icon } from "@/components/ui/icon";
import { api, ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth";

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

const HERO_IMG = 'https://images.ctfassets.net/5kq8dse7hipf/3KyG711s6Uiqk19b4BHcCF/adb054f0e7cfc547ff1b57b6ed13e6a5/how-to-hire-a-mechanic.jpg?w=1920&fm=webp'

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await api.post<LoginResponse>("/auth/login", {
        identifier,
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

      if (user.role === "mechanic") {
        router.push("/repairs");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('auth.unexpectedError'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${HERO_IMG}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/80 to-primary/90" />

      {/* Decorative blur */}
      <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-on-primary/5 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-on-primary/5 blur-3xl" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Logo size="md" />
          <div>
            <span className="block text-xl font-black tracking-wide text-on-primary">
              SAGMAN AUTO
            </span>
            <span className="block text-xs uppercase tracking-widest text-on-primary/60">
              Auto Service
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Heading */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Icon name="lock" size={22} className="text-on-primary" />
            </div>
            <h2 className="font-headline-lg text-headline-lg text-primary">{t('auth.signIn')}</h2>
            <p className="mt-1 text-body-md font-body-md text-on-surface-variant">
              {t('auth.subtitle')}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-error/30 bg-error-container px-4 py-3.5 text-sm text-on-error-container">
              <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-sm font-medium text-primary">
                {t('auth.identifierLabel')}
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder={t('auth.identifierPlaceholder')}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base text-primary placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-primary">
                {t('auth.password')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base text-primary placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <Button
              type="submit"
              className="h-12 w-full text-base font-semibold bg-primary text-on-primary rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
              isLoading={isLoading}
            >
              {isLoading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-on-surface-variant">
            {t('auth.forgotPassword')}
          </p>

          {/* Client portal link */}
          <div className="mt-6 space-y-3">
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-outline-variant" />
              <span className="mx-3 bg-white px-1 text-xs text-on-surface-variant">
                {t('auth.clientPortal')}
              </span>
              <div className="flex-1 border-t border-outline-variant" />
            </div>
            <a
              href="/portal"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-3 text-sm font-medium text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-all"
            >
              <Icon name="directions_car" size={16} />
              {t('auth.clientPortalLink')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
