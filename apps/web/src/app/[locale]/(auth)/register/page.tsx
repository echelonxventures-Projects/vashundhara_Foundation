'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/components/providers/auth-provider'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('auth.register')
  const { register } = useAuth()
  const locale = searchParams.get('locale') || 'en'

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    tenantSlug: '',
    agreeTerms: false
  })

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [passwordStrength, setPasswordStrength] = useState(0)

  const validateField = (name: string, value: string) => {
    switch (name) {
      case 'firstName':
        if (!value) return t('errors.firstNameRequired')
        if (value.length < 2) return t('errors.firstNameTooShort')
        break
      case 'lastName':
        if (!value) return t('errors.lastNameRequired')
        if (value.length < 2) return t('errors.lastNameTooShort')
        break
      case 'email':
        if (!value) return t('errors.emailRequired')
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t('errors.invalidEmail')
        break
      case 'password':
        if (!value) return t('errors.passwordRequired')
        if (value.length < 8) return t('errors.passwordTooShort')
        if (!/[A-Z]/.test(value)) return t('errors.passwordUppercase')
        if (!/[a-z]/.test(value)) return t('errors.passwordLowercase')
        if (!/[0-9]/.test(value)) return t('errors.passwordNumber')
        if (!/[^A-Za-z0-9]/.test(value)) return t('errors.passwordSpecial')
        break
      case 'confirmPassword':
        if (!value) return t('errors.confirmPasswordRequired')
        if (value !== formData.password) return t('errors.passwordsMismatch')
        break
      case 'tenantSlug':
        if (value && !/^[a-z0-9-]+$/.test(value)) return t('errors.invalidTenantSlug')
        break
      case 'agreeTerms':
        if (!value) return t('errors.termsRequired')
        break
    }
    return ''
  }

  const calculatePasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))

    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value))
      if (formData.confirmPassword && value !== formData.confirmPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: t('errors.passwordsMismatch') }))
      }
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const error = validateField(name, value)
    if (error) setErrors(prev => ({ ...prev, [name]: error }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    Object.keys(formData).forEach(key => {
      const value = formData[key as keyof typeof formData]
      const error = validateField(key, String(value))
      if (error) newErrors[key] = error
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        tenantSlug: formData.tenantSlug || undefined
      })
      toast({ title: t('success.title'), description: t('success.description') })
      router.push(`/${locale}/dashboard`)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.generic')
      toast({ title: t('errors.title'), description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const passwordRequirements = [
    { label: t('passwordRequirements.length'), met: formData.password.length >= 8 },
    { label: t('passwordRequirements.uppercase'), met: /[A-Z]/.test(formData.password) },
    { label: t('passwordRequirements.lowercase'), met: /[a-z]/.test(formData.password) },
    { label: t('passwordRequirements.number'), met: /[0-9]/.test(formData.password) },
    { label: t('passwordRequirements.special'), met: /[^A-Za-z0-9]/.test(formData.password) }
  ]

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">{t('fields.firstName.label')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder={t('fields.firstName.placeholder')}
                      value={formData.firstName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={cn('pl-10', errors.firstName && 'border-destructive focus:border-destructive focus:ring-destructive/20')}
                      disabled={isLoading}
                      autoComplete="given-name"
                      aria-invalid={errors.firstName ? 'true' : 'false'}
                      aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                    />
                  </div>
                  {errors.firstName && (
                    <p id="firstName-error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.firstName}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName">{t('fields.lastName.label')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder={t('fields.lastName.placeholder')}
                      value={formData.lastName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={cn('pl-10', errors.lastName && 'border-destructive focus:border-destructive focus:ring-destructive/20')}
                      disabled={isLoading}
                      autoComplete="family-name"
                      aria-invalid={errors.lastName ? 'true' : 'false'}
                      aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                    />
                  </div>
                  {errors.lastName && (
                    <p id="lastName-error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('fields.email.label')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t('fields.email.placeholder')}
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={cn('pl-10', errors.email && 'border-destructive focus:border-destructive focus:ring-destructive/20')}
                    disabled={isLoading}
                    autoComplete="email"
                    aria-invalid={errors.email ? 'true' : 'false'}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('fields.password.label')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('fields.password.placeholder')}
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={cn('pl-10 pr-10', errors.password && 'border-destructive focus:border-destructive focus:ring-destructive/20')}
                    disabled={isLoading}
                    autoComplete="new-password"
                    aria-invalid={errors.password ? 'true' : 'false'}
                    aria-describedby={errors.password ? 'password-error' : 'password-hint'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? t('fields.password.hide') : t('fields.password.show')}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.password}
                  </p>
                )}

                {/* Password Strength */}
                <div id="password-hint" className="space-y-2" aria-live="polite">
                  <div className="flex gap-1" role="progressbar" aria-valuenow={passwordStrength} aria-valuemin={0} aria-valuemax={5} aria-label="Password strength">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1.5 flex-1 rounded transition-colors',
                          i < passwordStrength
                            ? passwordStrength <= 2
                              ? 'bg-red-500'
                              : passwordStrength <= 3
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                            : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {passwordStrength === 0 ? t('passwordStrength.enter') :
                      passwordStrength <= 2 ? t('passwordStrength.weak') :
                        passwordStrength <= 3 ? t('passwordStrength.fair') :
                          passwordStrength <= 4 ? t('passwordStrength.good') :
                            t('passwordStrength.strong')}
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1" role="list">
                    {passwordRequirements.map((req, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        {req.met ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                        ) : (
                          <span className="h-3.5 w-3.5 text-muted-foreground/50">○</span>
                        )}
                        <span className={cn(req.met ? 'text-green-600 dark:text-green-400' : '')}>{req.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t('fields.confirmPassword.label')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('fields.confirmPassword.placeholder')}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={cn('pl-10', errors.confirmPassword && 'border-destructive focus:border-destructive focus:ring-destructive/20')}
                    disabled={isLoading}
                    autoComplete="new-password"
                    aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                    aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                  />
                </div>
                {errors.confirmPassword && (
                  <p id="confirmPassword-error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Tenant Slug (Optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug">{t('fields.tenantSlug.label')}</Label>
                <div className="relative">
                  <Input
                    id="tenantSlug"
                    name="tenantSlug"
                    placeholder={t('fields.tenantSlug.placeholder')}
                    value={formData.tenantSlug}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={cn(errors.tenantSlug && 'border-destructive focus:border-destructive focus:ring-destructive/20')}
                    disabled={isLoading}
                    aria-invalid={errors.tenantSlug ? 'true' : 'false'}
                    aria-describedby={errors.tenantSlug ? 'tenantSlug-error' : 'tenantSlug-hint'}
                  />
                </div>
                {errors.tenantSlug && (
                  <p id="tenantSlug-error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.tenantSlug}
                  </p>
                )}
                <p id="tenantSlug-hint" className="text-xs text-muted-foreground">{t('fields.tenantSlug.hint')}</p>
              </div>

              {/* Terms Agreement */}
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, agreeTerms: e.target.checked }))
                      if (errors.agreeTerms) setErrors(prev => ({ ...prev, agreeTerms: '' }))
                    }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    required
                    aria-invalid={errors.agreeTerms ? 'true' : 'false'}
                  />
                  <span className="text-sm text-muted-foreground">
                    {t('fields.agreeTerms.text', {
                      termsUrl: `/${locale}/terms`,
                      privacyUrl: `/${locale}/privacy`
                    })}
                  </span>
                </label>
                {errors.agreeTerms && (
                  <p className="text-sm text-destructive flex items-center gap-1" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.agreeTerms}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('buttons.loading')}
                  </>
                ) : (
                  t('buttons.submit')
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Separator className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              {t('hasAccount')} {' '}
              <Link href={`/${locale}/login`} className="text-primary hover:underline font-medium">
                {t('loginLink')}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  )
}