'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { api } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { useTranslations } from 'next-intl'

interface Review {
  id: string
  client_name: string
  rating: number
  comment: string | null
  created_at: string
}

interface GarageSettings {
  garage_name?: string
  garage_address?: string
  garage_phone?: string
  garage_hours?: string
  garage_email?: string
  whatsapp_number?: string
  depannage_number?: string
  facebook_url?: string
  instagram_url?: string
  tiktok_url?: string
}

const SERVICE_KEYS = [
  { icon: 'build',           key: 'generalMechanic' },
  { icon: 'bolt',            key: 'hydraulic' },
  { icon: 'settings',        key: 'electricalAuto' },
  { icon: 'shield',          key: 'advancedDiagnostic' },
  { icon: 'palette',         key: 'bodywork' },
  { icon: 'check_circle',    key: 'oilChange' },
  { icon: 'local_car_wash',  key: 'washing' },
  { icon: 'speed',           key: 'engineTuning' },
]

const IMAGES = {
  hero: 'https://jessesgarage.com/wp-content/uploads/2024/07/hm-welcome-01.jpg',
  services: '/images/portrait.jpeg',
  process: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQhpHH2Wcws1o12PW--P3XV9QUHfFEhRM9_8Sl4GoqZjuJw6pjIyCz0O4IQ&s=10',
  testimonials: '/images/portrait.jpeg',
}

const REVIEWS_PER_PAGE = 6

const STAT_KEYS = [
  { value: '15+',   key: 'yearsExperience' },
  { value: '5 000+', key: 'satisfiedClients' },
  { value: '98%',   key: 'onTimeAppointments' },
  { value: '4.9',   key: 'averageRating' },
]

const WHY_US_KEYS = [
  { icon: 'verified',               key: 'certified' },
  { icon: 'precision_manufacturing', key: 'equipment' },
  { icon: 'visibility',             key: 'transparency' },
  { icon: 'support_agent',          key: 'support' },
]

const HOW_IT_WORKS_KEYS = [
  { n: '01', key: 'book' },
  { n: '02', key: 'diagnosis' },
  { n: '03', key: 'tracking' },
]

function ReviewForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/portal/reviews', { rating, comment: comment.trim() || undefined })
      setSubmitted(true)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unexpectedError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <Icon name="check_circle" size={48} filled className="text-green-600 mx-auto mb-4" />
        <p className="font-title-md text-title-md text-primary">{t('portal.landing.review.thanks')}</p>
        <p className="text-body-md font-body-md text-on-surface-variant mt-1">{t('portal.landing.review.thanksDesc')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-outline-variant rounded-2xl p-8 shadow-sm">
      <div className="mb-6 text-center">
        <p className="font-title-md text-title-md text-primary mb-3">{t('portal.landing.review.yourRating')}</p>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Icon
                name="star"
                size={32}
                filled={star <= (hovered || rating)}
                className={star <= (hovered || rating) ? 'text-amber-400' : 'text-outline-variant'}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="review_comment" className="font-title-md text-title-md text-primary block mb-2">
          {t('portal.landing.review.yourComment')} <span className="text-on-surface-variant font-body-md">{t('portal.landing.review.commentOptional')}</span>
        </label>
        <textarea
          id="review_comment"
          rows={4}
          placeholder={t('portal.landing.review.commentPlaceholder')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-body-md font-body-md text-primary placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-body-md font-body-md text-red-700">
          <Icon name="error" size={16} />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={rating === 0 || submitting}
        className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-8 py-4 font-title-md text-title-md shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {submitting ? t('portal.landing.review.submitting') : t('portal.landing.review.submit')}
        {!submitting && <Icon name="send" size={18} />}
      </button>
    </form>
  )
}

export default function PortalLandingPage() {
  const t = useTranslations()
  const [settings, setSettings] = useState<GarageSettings>({})
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewPage, setReviewPage] = useState(0)

  useEffect(() => {
    const token = authStorage.getAccessToken();
    setIsAuthenticated(!!token);
  }, [])

  useEffect(() => {
    api.get<{ data: GarageSettings }>('/settings/public')
      .then(res => {
        setSettings(res.data);
      })
      .catch(() => {
        setSettings({
          garage_name: 'SAGMAN AUTO',
          garage_address: 'Casablanca, Maroc',
          garage_phone: '+2126947222954',
          garage_hours: 'Lun–Sam 08:00–18:00',
          garage_email: 'contact@sagman.ma',
          whatsapp_number: '+2126947222954',
          depannage_number: '+2126947222954',
        })
      })
  }, [])

  const fetchReviews = useCallback(async () => {
    try {
      const res = await api.get<{ data: Review[] }>('/portal/reviews')
      setReviews(res.data)
      setReviewPage(0)
    } catch {
      // fallback: show nothing
    }
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const paginatedReviews = reviews.slice(reviewPage * REVIEWS_PER_PAGE, (reviewPage + 1) * REVIEWS_PER_PAGE)
  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE)

  const defaultTestimonials = [
    { name: t('portal.landing.testimonials.fallback.0.name'), text: t('portal.landing.testimonials.fallback.0.text'), rating: 5 },
    { name: t('portal.landing.testimonials.fallback.1.name'), text: t('portal.landing.testimonials.fallback.1.text'), rating: 5 },
    { name: t('portal.landing.testimonials.fallback.2.name'), text: t('portal.landing.testimonials.fallback.2.text'), rating: 5 },
  ]

  return (
    <div className="min-h-screen bg-surface">

      {/* ═══════════════════════════════════════════════════════════════════
          HERO
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url('${IMAGES.hero}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/60" />

        {/* Decorative circle */}
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-on-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-on-primary/5 blur-3xl" />

        <div className="relative mx-auto w-full px-6 py-24 sm:py-32">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-on-primary/20 bg-on-primary/10 px-4 py-1.5 text-sm text-on-primary/80 backdrop-blur-sm">
              <Icon name="verified" size={14} filled />
              {t('portal.landing.hero.badge')}
            </div>

            <h1 className="font-headline-xl text-headline-xl text-on-primary mb-6 leading-tight">
              {t('portal.landing.hero.title1')}
              <br />
              <span className="text-on-primary">{t('portal.landing.hero.title2')}</span>
            </h1>

            <p className="text-body-lg font-body-lg text-on-primary/80 max-w-xl mb-10">
              {t('portal.landing.hero.description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {isAuthenticated ? (
                <Link
                  href="/portal/book"
                  className="inline-flex items-center justify-center gap-2 bg-on-primary text-primary rounded-xl px-8 py-4 font-title-md text-title-md shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                >
                  {t('portal.landing.bookAppointment')}
                  <Icon name="chevron_right" size={18} />
                </Link>
              ) : (
                <Link
                  href="/portal/login"
                  className="inline-flex items-center justify-center gap-2 bg-on-primary text-primary rounded-xl px-8 py-4 font-title-md text-title-md shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                >
                  {t('portal.landing.accessAccount')}
                  <Icon name="chevron_right" size={18} />
                </Link>
              )}
              <a
                href={`tel:${settings.garage_phone ?? '+2126947222954'}`}
                className="inline-flex items-center justify-center gap-2 border border-on-primary/30 text-on-primary rounded-xl px-8 py-4 font-title-md text-title-md hover:bg-on-primary/10 transition-all"
              >
                <Icon name="call" size={18} />
                {t('portal.landing.callGarage')}
              </a>
            </div>
          </div>
        </div>

        {/* Floating stats bar at bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur-md border-t border-white/10">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
              {STAT_KEYS.map((stat) => (
                <div key={stat.key} className="py-5 px-6 text-center">
                  <p className="font-headline-lg text-headline-lg text-on-primary">{stat.value}</p>
                  <p className="text-label-sm font-label-sm text-on-primary/70">{t('portal.landing.stats.' + stat.key)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SERVICES
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-4">
            <span className="text-label-sm font-label-sm uppercase tracking-widest text-primary font-semibold">
              {t('portal.landing.servicesBadge')}
            </span>
          </div>
          <h2 className="font-headline-xl text-headline-xl text-primary mb-4 leading-tight">
            {t('portal.landing.servicesHeading1')}
            <br className="hidden sm:block" />
            <span className="text-on-surface-variant">{t('portal.landing.servicesHeading2')}</span>
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mt-12">
            {SERVICE_KEYS.map((service) => (
              <div
                key={service.key}
                className="group relative bg-white border border-outline-variant rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white group-hover:scale-110 transition-transform duration-300">
                  <Icon name={service.icon} size={22} />
                </div>
                <h3 className="font-title-md text-title-md text-primary mb-2">{t('portal.landing.servicesList.' + service.key + '.name')}</h3>
                <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                  {t('portal.landing.servicesList.' + service.key + '.desc')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SPLIT IMAGE + TRUST
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-surface-container-low overflow-hidden">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 md:grid-cols-2 items-center">
            {/* Left — Image */}
            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl">
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${IMAGES.services}')` }}
                />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-4 -right-4 bg-secondary text-on-secondary rounded-2xl px-6 py-4 shadow-lg">
                <p className="font-title-md text-title-md">{t('portal.landing.floatingBadge')}</p>
                <p className="text-label-sm font-label-sm text-on-secondary/80">{t('portal.landing.floatingBadgeDesc')}</p>
              </div>
            </div>

            {/* Right — Trust points */}
            <div className="space-y-8">
              <div>
                <span className="text-label-sm font-label-sm uppercase tracking-widest text-primary font-semibold">
                  {t('portal.landing.whyUs.title')}
                </span>
              </div>
              <h2 className="font-headline-xl text-headline-xl text-primary leading-tight">
                {t('portal.landing.whyUs.heading1')}
                <br />
                <span className="text-on-surface-variant">{t('portal.landing.whyUs.heading2')}</span>
              </h2>

              <div className="space-y-6">
                {WHY_US_KEYS.map((item) => (
                  <div key={item.key} className="flex gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container">
                      <Icon name={item.icon as any} size={20} className="text-on-primary" />
                    </div>
                    <div>
                      <h3 className="font-title-md text-title-md text-primary">{t('portal.landing.whyUs.items.' + item.key + '.title')}</h3>
                      <p className="text-body-md font-body-md text-on-surface-variant">{t('portal.landing.whyUs.items.' + item.key + '.desc')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS — SPLIT
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 md:grid-cols-2 items-center">
            {/* Left — Steps */}
            <div>
              <div className="mb-4">
                <span className="text-label-sm font-label-sm uppercase tracking-widest text-primary font-semibold">
                  {t('portal.landing.howItWorks.badge')}
                </span>
              </div>
              <h2 className="font-headline-xl text-headline-xl text-primary mb-12 leading-tight">
                {t('portal.landing.howItWorks.title')}
              </h2>

              <div className="space-y-8">
                {HOW_IT_WORKS_KEYS.map((step) => (
                  <div key={step.n} className="flex gap-5 group">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white font-title-md text-title-md group-hover:scale-110 transition-transform">
                      {step.n}
                    </div>
                    <div className="pt-1">
                      <h3 className="font-title-md text-title-md text-primary mb-1">{t('portal.landing.howItWorks.steps.' + step.key + '.title')}</h3>
                      <p className="text-body-md font-body-md text-on-surface-variant">{t('portal.landing.howItWorks.steps.' + step.key + '.desc')}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link
                  href="/portal/login"
                  className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-8 py-4 font-title-md text-title-md shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  {t('portal.landing.howItWorks.cta')}
                  <Icon name="chevron_right" size={18} />
                </Link>
              </div>
            </div>

            {/* Right — Image */}
            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl">
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${IMAGES.process}')` }}
                />
              </div>
              {/* Decorative dot pattern */}
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          TESTIMONIALS
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-surface-container-low relative overflow-hidden">
        {/* Background image with overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url('${IMAGES.testimonials}')` }}
        />
        <div className="absolute inset-0 bg-surface-container-low/90" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <span className="text-label-sm font-label-sm uppercase tracking-widest text-primary font-semibold">
              {t('portal.landing.testimonials.badge')}
            </span>
            <h2 className="font-headline-xl text-headline-xl text-primary mt-2 leading-tight">
              {t('portal.landing.testimonials.title')}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {(paginatedReviews.length > 0 ? paginatedReviews : defaultTestimonials).map((item) => {
              const name = 'client_name' in item ? item.client_name : item.name
              const text = 'comment' in item ? item.comment : item.text
              const rating = item.rating
              const key = 'id' in item ? item.id : name
              return (
                <div key={key} className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: rating }).map((_, i) => (
                      <Icon key={i} name="star" size={16} filled className="text-amber-400" />
                    ))}
                  </div>
                  <div className="mb-4">
                    <Icon name="format_quote" size={28} className="text-primary/20" />
                  </div>
                  <p className="text-body-md font-body-md text-on-surface-variant mb-5 italic leading-relaxed">
                    &ldquo;{text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white text-label-sm font-label-sm">
                      {name.charAt(0)}
                    </div>
                    <p className="font-title-md text-title-md text-primary">{name}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-10">
              <button
                onClick={() => setReviewPage(p => Math.max(0, p - 1))}
                disabled={reviewPage === 0}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-outline-variant bg-white text-primary text-label-sm font-label-sm hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Icon name="chevron_left" size={16} />
                {t('common.previous')}
              </button>
              <span className="text-body-sm font-body-sm text-on-surface-variant">
                {reviewPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setReviewPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={reviewPage >= totalPages - 1}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-outline-variant bg-white text-primary text-label-sm font-label-sm hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {t('common.next')}
                <Icon name="chevron_right" size={16} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          REVIEW FORM
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-2xl px-6">
          <div className="text-center mb-10">
            <span className="text-label-sm font-label-sm uppercase tracking-widest text-primary font-semibold">
              {t('portal.landing.review.badge')}
            </span>
            <h2 className="font-headline-xl text-headline-xl text-primary mt-2 leading-tight">
              {t('portal.landing.review.title')}
            </h2>
            <p className="text-body-lg font-body-lg text-on-surface-variant mt-3">
              {t('portal.landing.review.description')}
            </p>
          </div>

          <ReviewForm onSuccess={fetchReviews} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTACT
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <span className="text-label-sm font-label-sm uppercase tracking-widest text-primary font-semibold">
              {t('portal.landing.contactBadge')}
            </span>
            <h2 className="font-headline-xl text-headline-xl text-primary mt-2 leading-tight">
              {t('portal.landing.contactTitle')}
            </h2>
            <p className="text-body-lg font-body-lg text-on-surface-variant mt-3 max-w-xl mx-auto">
              {t('portal.landing.contactDescription')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container mb-4">
                <Icon name="location_on" size={22} className="text-on-primary" />
              </div>
              <p className="text-label-sm font-label-sm text-on-surface-variant mb-1">{t('portal.landing.addressLabel')}</p>
              <p className="font-title-md text-title-md text-primary">{settings.garage_address ?? 'Casablanca, Maroc'}</p>
            </div>

            <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container mb-4">
                <Icon name="call" size={22} className="text-on-primary" />
              </div>
              <p className="text-label-sm font-label-sm text-on-surface-variant mb-1">{t('common.phone')}</p>
              <p className="font-title-md text-title-md text-primary">{settings.garage_phone ?? '+2126947222954'}</p>
            </div>

            <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container mb-4">
                <Icon name="schedule" size={22} className="text-on-primary" />
              </div>
              <p className="text-label-sm font-label-sm text-on-surface-variant mb-1">{t('portal.landing.openingHours')}</p>
              <p className="font-title-md text-title-md text-primary">{settings.garage_hours ?? 'Lun–Sam 08:00–18:00'}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`tel:${settings.garage_phone ?? '+2126947222954'}`}
              className="inline-flex items-center justify-center gap-2 border-2 border-primary text-primary rounded-xl px-8 py-4 font-title-md text-title-md hover:bg-primary hover:text-white transition-all"
            >
              <Icon name="call" size={18} />
              {t('portal.landing.callNow')}
            </a>
            <a
              href={`https://wa.me/${(settings.whatsapp_number ?? settings.garage_phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(t('portal.landing.whatsappMessage'))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary rounded-xl px-8 py-4 font-title-md text-title-md hover:bg-secondary/90 transition-all"
            >
              <Icon name="chat" size={18} />
              {t('portal.landing.whatsapp')}
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
         ═══════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-outline-variant bg-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-title-md text-title-md text-primary mb-3">SAGMAN AUTO</h3>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                {t('portal.landing.footer.description')}
              </p>
            </div>
            <div>
              <h3 className="font-title-md text-title-md text-primary mb-3">{t('portal.landing.openingHours')}</h3>
              <p className="text-body-md font-body-md text-on-surface-variant">
                {settings.garage_hours ?? 'Lun–Sam 08:00–18:00'}
              </p>
            </div>
            <div>
              <h3 className="font-title-md text-title-md text-primary mb-3">{t('portal.landing.footer.followUs')}</h3>
              <div className="flex gap-4">
                {settings.facebook_url && (
                  <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white transition-all">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
                    </svg>
                  </a>
                )}
                {settings.instagram_url && (
                  <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white transition-all">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                    </svg>
                  </a>
                )}
                {settings.tiktok_url && (
                  <a href={settings.tiktok_url} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white transition-all">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-outline-variant text-center">
            <p className="text-label-sm font-label-sm text-on-surface-variant">
              &copy; {new Date().getFullYear()} SAGMAN AUTO. {t('common.allRightsReserved')}
            </p>
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════
          FAB — Emergency Towing
         ═══════════════════════════════════════════════════════════════════ */}
      <a
        href={`tel:${settings.depannage_number ?? settings.garage_phone ?? '+2126947222954'}`}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-secondary text-on-secondary rounded-full px-6 py-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        aria-label={t('portal.landing.towingAriaLabel')}
      >
        <Icon name="local_taxi" size={22} />
        <span className="font-title-md text-title-md">{t('portal.landing.towing')}</span>
      </a>
    </div>
  )
}
