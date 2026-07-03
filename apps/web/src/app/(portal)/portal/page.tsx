'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/layout/Logo'
import {
  Wrench, Shield, Clock, Phone, MapPin, MessageCircle,
  ChevronRight, Zap, Settings, Palette, Truck, CheckCircle,
  Circle
} from 'lucide-react'
import { api } from '@/lib/api-client'

interface GarageSettings {
  garage_name?: string
  garage_address?: string
  garage_phone?: string
  garage_hours?: string
  garage_email?: string
}

// Define the specific services requested in French
const SERVICES = [
  {
    icon: Wrench,
    name: 'Mécanique générale',
    desc: 'Entretien, révision et réparations mécaniques',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600'
  },
  {
    icon: Zap,
    name: 'Hydraulique',
    desc: 'Systèmes de direction assistée, freinage et suspension hydraulique',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600'
  },
  {
    icon: Settings,
    name: 'Électricité automobile',
    desc: 'Câblage, batterie, alternateur et systèmes électroniques',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600'
  },
  {
    icon: Shield,
    name: 'Diagnostique avancé',
    desc: 'Analyse électronique complète et recherche de pannes',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600'
  },
  {
    icon: Palette,
    name: 'Tôlerie',
    desc: 'Réparation de carrosserie, débosselage et redressage',
    bg: 'bg-white/10',
    border: 'border-white/20',
    text: 'text-gray-800'
  },
  {
    icon: Truck,
    name: 'Cabine de peinture',
    desc: 'Peinture complète, retouches et finitions professionnelles',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600'
  },
  {
    icon: CheckCircle,
    name: 'Vidange & Entretien',
    desc: 'Vidange d\'huile, remplacement de filtres et contrôles périodiques',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600'
  },
  {
    icon: MapPin,
    name: 'Lavage & Détailing',
    desc: 'Lavage intérieur/extérieur, cire protection et traitement esthétique',
    bg: 'bg-white/10',
    border: 'border-white/20',
    text: 'text-gray-800'
  }
]

const STEPS = [
  {
    n: '1',
    title: 'Prenez rendez-vous',
    desc: 'Réservez en ligne ou par téléphone en moins de 2 minutes',
  },
  {
    n: '2',
    title: 'Diagnostic & Réparation',
    desc: "Notre équipe effectue un diagnostic complet puis les réparations nécessaires",
  },
  {
    n: '3',
    title: 'Suivi & Livraison',
    desc: 'Suivez l\'avancement en temps réel et récupérez votre véhicule',
  },
]

export default function PortalLandingPage() {
  const [settings, setSettings] = useState<GarageSettings>({})

  useEffect(() => {
    // Load garage settings from API
    api.get<{ data: GarageSettings }>('/settings/public')
      .then(res => {
        setSettings(res.data);
      })
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
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-[rgba(220,38,38,0.1)]">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-3">
              <Logo size="sm" className="h-8 w-8" />
              <div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-600 via-white to-blue-600">
                  SAGMAN
                </span>
                <span className="text-sm text-gray-500 uppercase tracking-wider">
                  Auto Service
                </span>
              </div>
            </div>

            <nav className="hidden md:flex space-x-6">
              <Link
                href="/portal/login"
                className="text-gray-500 hover:text-gray-900 transition-colors font-medium"
              >
                Connexion
              </Link>
              <Link
                href="/portal/book"
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium text-gray-500 hover:text-gray-900 border border-[rgba(220,38,38,0.2)] hover:border-red-500/30 transition-all"
              >
                Rendez-vous
                <ChevronRight className="h-4 w-4" />
              </Link>
            </nav>

            <div className="md:hidden">
              <Link
                href="/portal/login"
                className="p-2 rounded-md hover:bg-[rgba(220,38,38,0.1)]"
              >
                <svg className="h-5 w-5 text-gray-500 hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14M5 15h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2z"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-20 relative overflow-hidden">
        <div className="mx-auto px-6">
          <div className="text-center">
            <div className="inline-flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-[radial-gradient(circle_at_30%_30%,rgba(220,38,38,0.1),rgba(220,38,38,0)) rounded-full"></div>
              <div className="w-12 h-12 bg-[radial-gradient(circle_at_30%_30%,rgba(30,64,175,0.1),rgba(30,64,175,0)) rounded-full"></div>
              <div className="w-12 h-12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.05),rgba(255,255,255,0)) rounded-full"></div>
            </div>

            <h1 className="mb-6 text-5xl font-black font-display bg-clip-text text-transparent bg-gradient-to-r from-red-600 via-white to-blue-600 sm:text-6xl">
              Votre véhicule mérite
              <br className="hidden sm:inline" />
              le meilleur service
            </h1>
            <p className="mb-8 text-lg text-gray-600 max-w-2xl mx-auto">
              Garage Sagman vous offre une expertise complète pour tous vos besoins automobiles,
              avec un suivi transparent et des interventions de qualité.
            </p>

            <div className="flex flex-col sm:flex-row sm:space-x-4 justify-center">
              <Link
                href="/portal/login"
                className="flex-1 sm:flex-none sm:w-64 sm:max-w-xs inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-md shadow-lg hover:shadow-xl transform transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]"
              >
                Accéder à mon espace
                <ChevronRight className="h-4 w-4 ms-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <Link
                href="/portal/book"
                className="flex-1 sm:flex-none sm:w-64 sm:max-w-xs inline-flex items-center justify-center px-5 py-3 border-[2px] border-[rgba(220,38,38,0.3)] hover:border-red-500 bg-[rgba(220,38,38,0.05)] hover:bg-[rgba(220,38,38,0.1)] text-white font-semibold rounded-md shadow hover:shadow-md transform transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]"
              >
                Prendre rendez-vous
              </Link>
            </div>
          </div>

          {/* Floating decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/10 w-20 h-20 bg-texture-noise opacity-20 animate-float" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-1/3 right-1/10 w-16 h-16 bg-gradient-primary opacity-15 animate-float" style={{ animationDelay: '1.5s' }}></div>
            <div className="absolute bottom-1/4 left-1/5 w-24 h-24 bg-gradient-secondary opacity-10 animate-float" style={{ animationDelay: '0.8s' }}></div>
            <div className="absolute bottom-1/3 right-1/8 w-12 h-12 bg-accent-metallic/20 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
          </div>
          {/* Floating decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/10 w-24 h-24 bg-gradient-primary opacity-10 animate-float" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-1/2 right-1/8 w-20 h-20 bg-gradient-secondary opacity-8 animate-float" style={{ animationDelay: '1.2s' }}></div>
            <div className="absolute bottom-1/4 left-1/3 w-28 h-28 bg-accent-metallic/10 animate-pulse-slow" style={{ animationDelay: '0.6s' }}></div>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ───────────────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto px-6">
          <h2 className="mb-8 text-4xl font-bold font-display text-center bg-clip-text text-transparent bg-gradient-to-r from-red-600 via-white to-blue-600 sm:text-5xl">
            Pourquoi choisir Sagman ?
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="relative bg-white p-6 rounded-xl border border-[rgba(220,38,38,0.1)] hover:bg-[rgba(220,38,38,0.05)] hover:shadow-xl transition-all duration-400 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==') bg-[length:200px_200px]">
              <div className="absolute inset-0 -z-10 bg-texture-noise opacity-5 pointer-events-none"></div>
              <div className="flex items-center justify-center w-12 h-12 mb-4 bg-[radial-gradient(circle_at_30%_30%,rgba(220,38,38,0.1),rgba(220,38,38,0)) rounded-full relative z-10">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.758 0 3.42 3.42 0 001.946.806 3.42 3.42 0 014.758 0 3.42 3.42 0 001.946.806V18a2 2 0 01-2 2h-1L9 16l-2-2h-1a2 2 0 01-2-2V6.697a3.42 3.42 0 00-.513-.993z"/>
                </svg>
              </div>
              <h3 className="mb-3 text-lg font-semibold font-display text-gray-900">Expertise certifiée</h3>
              <p className="text-gray-600">Nos mécaniciens sont formés aux dernières technologies et bénéficient de certifications constructeur.</p>
            </div>

            <div className="relative bg-white p-6 rounded-xl border border-[rgba(30,64,175,0.1)] hover:bg-[rgba(30,64,175,0.05)] hover:shadow-xl transition-all duration-400 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==') bg-[length:200px_200px]">
              <div className="absolute inset-0 -z-10 bg-texture-noise opacity-5 pointer-events-none"></div>
              <div className="flex items-center justify-center w-12 h-12 mb-4 bg-[radial-gradient(circle_at_30%_30%,rgba(30,64,175,0.1),rgba(30,64,175,0)) rounded-full relative z-10">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H3m8 9V4m-8 9h4l5-5M3 16l4-4m4 4V3"/>
                </svg>
              </div>
              <h3 className="mb-3 text-lg font-semibold font-display text-gray-900">Équipement professionnel</h3>
              <p className="text-gray-600">Atelier équipé de valises diagnostiques, banc de géométrie et cabine de peinture conforme aux normes.</p>
            </div>

            <div className="relative bg-white p-6 rounded-xl border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.02)] hover:shadow-xl transition-all duration-400 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==') bg-[length:200px_200px]">
              <div className="absolute inset-0 -z-10 bg-texture-noise opacity-5 pointer-events-none"></div>
              <div className="flex items-center justify-center w-12 h-12 mb-4 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.05),rgba(255,255,255,0)) rounded-full relative z-10">
                <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3"/>
                </svg>
              </div>
              <h3 className="mb-3 text-lg font-semibold font-display text-gray-900">Transparence totale</h3>
              <p className="text-gray-600">Suivez chaque étape de l'intervention de votre véhicule avec photos et compte-rendu détaillé.</p>
            </div>
          </div>
          {/* Floating decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/10 w-24 h-24 bg-gradient-primary opacity-10 animate-float" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-1/2 right-1/8 w-20 h-20 bg-gradient-secondary opacity-8 animate-float" style={{ animationDelay: '1.2s' }}></div>
            <div className="absolute bottom-1/4 left-1/3 w-28 h-28 bg-accent-metallic/10 animate-pulse-slow" style={{ animationDelay: '0.6s' }}></div>
          </div>
        </div>
      </section>

      {/* ── Services Section ────────────────────────────────────────────────── */}
      <section className="py-16 relative overflow-hidden">
        <div className="mx-auto px-6">
          <h2 className="mb-10 text-4xl font-bold font-display text-center bg-clip-text text-transparent bg-gradient-to-r from-red-600 via-white to-blue-600 sm:text-5xl">
            Nos prestations
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service, index) => (
              <div
                key={service.name}
                className="group relative overflow-hidden bg-white p-6 border border-[rgba(220,38,38,0.1)] rounded-xl hover:bg-[rgba(220,38,38,0.05)] hover:border-[rgba(220,38,38,0.2)] hover:shadow-xl transition-all duration-400 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iI2VlZSIvPjwvc3ZnPg')] bg-[length:200px_200px]"
              >
                <div className="absolute inset-0 -z-10 bg-texture-noise opacity-3 pointer-events-none"></div>
                {/* Icon with animated background */}
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl relative z-10" style={{
                  '--bg-color': service.bg.replace('bg-[', '').replace(']', ''),
                  '--border-color': service.border.replace('border-[', '').replace(']', '')
                } as React.CSSProperties}>
                  <div className={`absolute inset-0 rounded-xl ${service.bg} ${service.border} opacity-70`}></div>
                  <div className={`relative z-10 flex h-10 w-10 items-center justify-center`}>
                    <service.icon className={`h-5 w-5 ${service.text} transition-colors duration-400 group-hover:text-white`} />
                  </div>
                </div>

                <h3 className="mb-3 text-lg font-semibold font-display text-gray-900">{service.name}</h3>
                <p className="text-gray-600 leading-relaxed">{service.desc}</p>

                {/* Decorative accent line */}
                <div className="mt-2 h-0.5 w-0 bg-[${service.text}] group-hover:w-full transition-width duration-400"></div>

                {/* Floating icon decoration */}
                <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[${service.text}]/10 backdrop-blur-sm pointer-events-none"></div>
              </div>
            ))}
          </div>

          {/* Floating decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/10 w-28 h-28 bg-gradient-primary opacity-8 animate-float" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-1/3 right-1/8 w-24 h-24 bg-gradient-secondary opacity-6 animate-float" style={{ animationDelay: '1.0s' }}></div>
            <div className="absolute bottom-1/4 left-1/5 w-32 h-32 bg-accent-metallic/8 animate-pulse-slow" style={{ animationDelay: '0.5s' }}></div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto px-6">
          <h2 className="mb-10 text-4xl font-bold font-display text-center bg-clip-text text-transparent bg-gradient-to-r from-red-600 via-white to-blue-600 sm:text-5xl">
            Comment ça fonctionne ?
          </h2>

          <div className="relative">
            {/* Vertical timeline */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[radial-gradient(to_top,transparent_0%,rgba(220,38,38,0.2)_100%)]"/>

            {/* Timeline dots */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-start space-y-12">
              {STEPS.map((step, i) => (
                <div key={step.n} className="w-4 h-4 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(220,38,38,0.3),rgba(220,38,38,0))] relative z-10">
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),rgba(220,38,38,0)) blur-sm"></div>
                </div>
              ))}
            </div>

            {/* Timeline content */}
            <div className="space-y-12">
              {STEPS.map((step, index) => (
                <div key={step.n} className={`relative pl-8 pr-4 lg:pl-12 lg:pr-6`}>
                  {/* Step indicator */}
                  <div className={`absolute left-0 -translate-x-1/2 top-0 w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-red-600 via-white to-blue-600 text-white font-bold font-display shadow-xl hover:shadow-2xl transition-all duration-400 group-hover:-rotate-3 group-hover:scale-105`}>
                    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(220,38,38,0.2),rgba(220,38,38,0)) blur-sm" />
                    {step.n}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-gray-900">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                  </div>

                  {/* Connector line (except for last step) */}
                  {index < STEPS.length - 1 && (
                    <div className={`absolute left-1/2 -translate-x-1/2 top-14 -translate-y-1/2 w-px h-[50%] bg-[radial-gradient(to_bottom,transparent_0%,rgba(220,38,38,0.2)_100%)]`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/portal/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-semibold font-display rounded-lg shadow hover:shadow-md transform transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]"
            >
              Commencer maintenant
              <ChevronRight className="h-4 w-4 ms-2 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
          {/* Floating decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/10 w-24 h-24 bg-gradient-primary opacity-10 animate-float" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-1/2 right-1/8 w-20 h-20 bg-gradient-secondary opacity-8 animate-float" style={{ animationDelay: '1.2s' }}></div>
            <div className="absolute bottom-1/4 left-1/3 w-28 h-28 bg-accent-metallic/10 animate-pulse-slow" style={{ animationDelay: '0.6s' }}></div>
          </div>
        </div>
      </section>

      {/* ── Contact Section ───────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto px-6">
          <h2 className="mb-8 text-4xl font-bold font-display text-center bg-clip-text text-transparent bg-gradient-to-r from-red-600 via-white to-blue-600 sm:text-5xl">
            Contactez-nous
          </h2>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <div className="relative bg-white p-4 rounded-xl border border-[rgba(220,38,38,0.1)] hover:bg-[rgba(220,38,38,0.05)] hover:shadow-lg transition-all duration-400 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==') bg-[length:100px_100px]">
                <div className="absolute inset-0 -z-10 bg-texture-noise opacity-3 pointer-events-none"></div>
                <div className="flex items-start space-x-4 relative z-10">
                  <div className="flex-shrink-0 h-10 w-10 items-center justify-center rounded-xl bg-[rgba(220,38,38,0.1)]">
                    <MapPin className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Adresse</p>
                    <p className="text-gray-900 font-medium font-display">{settings.garage_address ?? 'Casablanca, Maroc'}</p>
                  </div>
                </div>
              </div>

              <div className="relative bg-white p-4 rounded-xl border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.02)] hover:shadow-lg transition-all duration-400 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==') bg-[length:100px_100px]">
                <div className="absolute inset-0 -z-10 bg-texture-noise opacity-3 pointer-events-none"></div>
                <div className="flex items-start space-x-4 relative z-10">
                  <div className="flex-shrink-0 h-10 w-10 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.1)]">
                    <Phone className="h-5 w-5 text-gray-900" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Téléphone</p>
                    <p className="text-gray-900 font-medium font-display">{settings.garage_phone ?? '+212 5XX XXX XXX'}</p>
                  </div>
                </div>
              </div>

              <div className="relative bg-white p-4 rounded-xl border border-[rgba(30,64,175,0.1)] hover:bg-[rgba(30,64,175,0.05)] hover:shadow-lg transition-all duration-400 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==') bg-[length:100px_100px]">
                <div className="absolute inset-0 -z-10 bg-texture-noise opacity-3 pointer-events-none"></div>
                <div className="flex items-start space-x-4 relative z-10">
                  <div className="flex-shrink-0 h-10 w-10 items-center justify-center rounded-xl bg-[rgba(30,64,175,0.1)]">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Horaires</p>
                    <p className="text-gray-900 font-medium font-display">{settings.garage_hours ?? 'Lun–Sam 08:00–18:00'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <p className="mb-4 text-gray-600 leading-relaxed">
                Besoin d'un renseignement, d'un devis ou de prendre rendez-vous ?
                Notre équipe est à votre écoute pour répondre à toutes vos questions.
              </p>

              <Link
                href="https://wa.me/${(settings.garage_phone ?? '').replace(/\D/g, '')}"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg shadow hover:shadow-md transform transition-transform duration-200 hover:-translate-y-1"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Écrire sur WhatsApp
              </Link>
            </div>
          </div>
          {/* Floating decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/10 w-24 h-24 bg-gradient-primary opacity-10 animate-float" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-1/2 right-1/8 w-20 h-20 bg-gradient-secondary opacity-8 animate-float" style={{ animationDelay: '1.2s' }}></div>
            <div className="absolute bottom-1/4 left-1/3 w-28 h-28 bg-accent-metallic/10 animate-pulse-slow" style={{ animationDelay: '0.6s' }}></div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[rgba(220,38,38,0.1)] py-8">
        <div className="mx-auto px-6 text-center text-gray-500">
          <p className="text-sm">
            © {new Date().getFullYear()} Garage Sagman. Tous droits réservés.
          </p>
          <p className="mt-2 text-xs">
            Suivez-nous :
            <a href="#" className="text-gray-500 hover:text-red-600 transition-colors">Facebook</a> |
            <a href="#" className="text-gray-500 hover:text-blue-600 transition-colors">Instagram</a> |
            <a href="#" className="text-gray-500 hover:text-gray-600 transition-colors">Google</a>
          </p>
        </div>
      </footer>
    </div>
  )
}