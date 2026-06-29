'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/layout/Logo'
import {
  Wrench, Shield, Clock, Phone, MapPin, MessageCircle,
  ChevronRight, Zap, Settings, Palette, Truck, CheckCircle,
} from 'lucide-react'
import { api } from '@/lib/api-client'

interface GarageSettings {
  garage_name?: string
  garage_address?: string
  garage_phone?: string
  garage_hours?: string
  garage_email?: string
}

const SERVICES = [
  {
    icon: Wrench,
    name: 'Moteur & Transmission',
    desc: 'Diagnostic, révision et réparation moteur',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Shield,
    name: 'Freins & Suspension',
    desc: 'Contrôle et remplacement des systèmes de freinage',
    color: 'text-green-600 bg-green-50',
  },
  {
    icon: Zap,
    name: 'Électrique & Diagnostic',
    desc: 'Diagnostic électronique et réparations électriques',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: Palette,
    name: 'Carrosserie & Peinture',
    desc: 'Débosselage, peinture et traitement anti-rouille',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: Settings,
    name: 'Entretien & Vidange',
    desc: "Vidange, filtres, bougies et entretien préventif",
    color: 'text-orange-600 bg-orange-50',
  },
  {
    icon: Truck,
    name: 'Pneus & Géométrie',
    desc: 'Montage, équilibrage et parallélisme',
    color: 'text-red-600 bg-red-50',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Prenez rendez-vous',
    desc: 'En ligne ou par téléphone, en moins de 2 minutes',
  },
  {
    n: '2',
    title: 'Diagnostic & Réparation',
    desc: "Nos mécaniciens qualifiés s'occupent de votre véhicule",
  },
  {
    n: '3',
    title: 'Suivi en temps réel',
    desc: 'Notifications à chaque étape, transparence totale',
  },
]

export default function PortalLandingPage() {
  const [settings, setSettings] = useState<GarageSettings>({})

  useEffect(() => {
    // Load garage settings from API
    api.get<{ data: GarageSettings }>('/settings/public')
      .then(res => setSettings(res.data))
      .catch(() => {
        // Fallback to defaults on error
        setSettings({
          garage_name: 'Garage Sagman',
          garage_address: 'Casablanca, Maroc',
          garage_phone: '+212 5XX XXX XXX',
          garage_hours: 'Lun–Sam 08:00–18:00',
          garage_email: 'contact@sagman.ma'
        })
      })
  }, [])

  return (
    <div className="-mx-4 -my-6">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-portal-hero relative overflow-hidden px-6 py-20 text-white md:py-28">
        {/* Decorative background gears */}
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 -translate-y-1/2 translate-x-1/3 opacity-[0.04]">
          <Logo size="xl" className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 -translate-x-1/3 translate-y-1/2 opacity-[0.04]">
          <Logo size="xl" className="h-full w-full" />
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          {/* Certified badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <span>🔧</span>
            <span>Garage certifié · {settings.garage_address?.split(',')[0] || 'Casablanca'}</span>
          </div>

          {/* Animated gear logo */}
          <div className="mb-6 flex justify-center">
            <div className="gear-spin-slow">
              <Logo size="xl" />
            </div>
          </div>

          <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight md:text-5xl">
            Votre véhicule entre
            <br />
            <span className="text-blue-300">de bonnes mains</span>
          </h1>
          <p className="mb-8 text-lg text-blue-100 md:text-xl">
            Suivez l&apos;état de votre réparation en temps réel
            <br className="hidden md:block" />
            et prenez rendez-vous en ligne
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/portal/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-bold text-primary shadow-lg transition-all hover:scale-105 hover:bg-blue-50 active:scale-100"
            >
              Suivre ma réparation
              <ChevronRight className="h-5 w-5" />
            </Link>
            <Link
              href="/portal/book"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-8 py-3.5 text-base font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
            >
              Prendre rendez-vous
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <section className="border-b bg-white px-6 py-8">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4 divide-x divide-border text-center">
          {[
            { value: '500+', label: 'Clients satisfaits' },
            { value: '15 ans', label: "d'expérience" },
            { value: '≈ 2j', label: 'Délai moyen' },
          ].map(stat => (
            <div key={stat.label} className="px-4">
              <div className="text-2xl font-black text-primary md:text-3xl">{stat.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground md:text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Services ──────────────────────────────────────────────────────── */}
      <section className="bg-muted/30 px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">Nos services</h2>
            <p className="mt-2 text-muted-foreground">
              Une expertise complète pour tous vos besoins automobiles
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {SERVICES.map(service => (
              <div
                key={service.name}
                className="group rounded-xl border bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${service.color}`}
                >
                  <service.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold leading-tight text-foreground">{service.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Comment ça marche&nbsp;?</h2>
            <p className="mt-2 text-muted-foreground">Simple, rapide et transparent</p>
          </div>

          <div className="relative space-y-6">
            {/* Vertical connector line */}
            <div className="absolute left-5 top-6 h-[calc(100%-3rem)] w-0.5 bg-border" />

            {STEPS.map((step, i) => (
              <div key={step.n} className="relative flex items-start gap-5">
                <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-primary-foreground shadow-md">
                  {step.n}
                </div>
                <div className="pt-1.5">
                  <h3 className="font-bold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/portal/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
            >
              Accéder à mon espace
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonial strip ─────────────────────────────────────────────── */}
      <section className="bg-accent/40 px-6 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { quote: 'Suivi impeccable, je savais exactement où en était ma voiture.', author: 'Karim B.' },
              { quote: 'Rendez-vous pris en 2 min, délai respecté. Je recommande !', author: 'Samira L.' },
              { quote: 'Transparent, professionnel et rapide. Vraiment top.', author: 'Mohammed A.' },
            ].map(t => (
              <div key={t.author} className="rounded-xl border bg-white p-4 shadow-card">
                <div className="mb-2 flex gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <CheckCircle key={i} className="h-3.5 w-3.5" />
                  ))}
                </div>
                <p className="text-sm italic text-foreground">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">— {t.author}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <section className="bg-sidebar px-6 py-12 text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 text-xl font-bold">Nous contacter</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: MapPin, label: 'Adresse', value: settings.garage_address ?? 'Casablanca, Maroc' },
              { icon: Phone, label: 'Téléphone', value: settings.garage_phone ?? '+212 5XX XXX XXX' },
              { icon: Clock, label: 'Horaires', value: settings.garage_hours ?? 'Lun–Sam 08:00–18:00' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-blue-300">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <a
            href={`https://wa.me/${(settings.garage_phone ?? '').replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-green-400"
          >
            <MessageCircle className="h-4 w-4" />
            Écrire sur WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
