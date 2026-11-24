'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, HeartHandshake, Users, Target, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { useTenantCurrency, useTenantLocale } from '@/components/providers/tenant-provider'

const statCards = [
  {
    key: 'totalRaised',
    label: 'dashboard.stats.totalRaised',
    value: 245678900,
    change: 23.5,
    trend: 'up',
    icon: DollarSign,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10'
  },
  {
    key: 'activeDonors',
    label: 'dashboard.stats.activeDonors',
    value: 12847,
    change: 12.3,
    trend: 'up',
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  {
    key: 'activeCampaigns',
    label: 'dashboard.stats.activeCampaigns',
    value: 24,
    change: -2.1,
    trend: 'down',
    icon: Target,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10'
  },
  {
    key: 'donationsThisMonth',
    label: 'dashboard.stats.donationsThisMonth',
    value: 3421,
    change: 18.7,
    trend: 'up',
    icon: HeartHandshake,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10'
  }
]

const recentDonations = [
  { id: '1', donor: 'Priya Sharma', amount: 50000, campaign: 'Education for All', date: '2024-01-15', status: 'completed' },
  { id: '2', donor: 'Rajesh Kumar', amount: 25000, campaign: 'Healthcare Initiative', date: '2024-01-14', status: 'completed' },
  { id: '3', donor: 'Anita Patel', amount: 100000, campaign: 'Disaster Relief', date: '2024-01-13', status: 'pending' },
  { id: '4', donor: 'Amit Singh', amount: 15000, campaign: 'Women Empowerment', date: '2024-01-12', status: 'completed' },
  { id: '5', donor: 'Sunita Devi', amount: 75000, campaign: 'Child Welfare', date: '2024-01-11', status: 'failed' }
]

const topCampaigns = [
  { name: 'Education for All', raised: 12500000, target: 20000000, donors: 1247, progress: 62.5 },
  { name: 'Healthcare Initiative', raised: 8750000, target: 15000000, donors: 892, progress: 58.3 },
  { name: 'Disaster Relief Fund', raised: 21000000, target: 25000000, donors: 2156, progress: 84.0 },
  { name: 'Women Empowerment', raised: 5600000, target: 10000000, donors: 567, progress: 56.0 },
  { name: 'Child Welfare Program', raised: 3200000, target: 8000000, donors: 341, progress: 40.0 }
]

function StatCard({ stat, currency, locale }: { stat: typeof statCards[0]; currency: string; locale: string }) {
  const Icon = stat.icon
  const TrendIcon = stat.trend === 'up' ? TrendingUp : TrendingDown

  return (
    <Card className="relative overflow-hidden">
      <div className={cn('absolute top-0 right-0 h-24 w-24 rounded-full opacity-10', stat.bgColor)} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', stat.bgColor)}>
          <Icon className={cn('h-5 w-5', stat.color)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(stat.value, currency, locale)}</div>
        <p className={cn('text-xs flex items-center gap-1 mt-1', stat.trend === 'up' ? 'text-green-500' : 'text-red-500')}>
          <TrendIcon className="h-3 w-3" />
          <span>{stat.change}%</span>
          <span className="text-muted-foreground">vs last month</span>
        </p>
      </CardContent>
    </Card>
  )
}

function RecentDonationsTable() {
  const t = useTranslations('dashboard.recentDonations')
  const currency = useTenantCurrency()
  const locale = useTenantLocale()

  const statusConfig = {
    completed: { label: 'completed', color: 'bg-green-500/10 text-green-500' },
    pending: { label: 'pending', color: 'bg-yellow-500/10 text-yellow-500' },
    failed: { label: 'failed', color: 'bg-red-500/10 text-red-500' }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t('columns.donor')}</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t('columns.amount')}</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t('columns.campaign')}</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t('columns.date')}</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t('columns.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentDonations.map((donation) => {
                const config = statusConfig[donation.status as keyof typeof statusConfig]
                return (
                  <tr key={donation.id} className="hover:bg-muted/50">
                    <td className="p-3">
                      <div className="font-medium">{donation.donor}</div>
                    </td>
                    <td className="p-3 font-medium">{formatCurrency(donation.amount, currency, locale)}</td>
                    <td className="p-3 text-sm text-muted-foreground">{donation.campaign}</td>
                    <td className="p-3 text-sm text-muted-foreground">{new Date(donation.date).toLocaleDateString(locale)}</td>
                    <td className="p-3">
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.color)}>
                        {t(`status.${config.label}`)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function TopCampaignsTable() {
  const t = useTranslations('dashboard.topCampaigns')
  const currency = useTenantCurrency()
  const locale = useTenantLocale()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topCampaigns.map((campaign) => (
            <div key={campaign.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{campaign.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(campaign.donors, locale)} {t('donors')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {formatCurrency(campaign.raised, currency, locale)}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      / {formatCurrency(campaign.target, currency, locale)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{campaign.progress}%</p>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${campaign.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const currency = useTenantCurrency()
  const locale = useTenantLocale()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="border border-input bg-background px-3 py-2 rounded-md text-sm">
            <option value="month">{t('periods.thisMonth')}</option>
            <option value="quarter">{t('periods.thisQuarter')}</option>
            <option value="year">{t('periods.thisYear')}</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard key={stat.key} stat={stat} currency={currency} locale={locale} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('charts.donationsOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-center gap-2">
              {[45, 52, 38, 65, 71, 58, 82, 67, 75, 88, 92, 85].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 max-w-16 bg-primary rounded-t transition-all hover:bg-primary/80"
                  style={{ height: `${height}%` }}
                  title={`${t('months.' + ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][i])}: ${height}%`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('charts.donationsBySource')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="32"
                  strokeDasharray="502"
                  strokeDashoffset="502"
                  className="text-muted"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="32"
                  strokeDasharray="502"
                  strokeDashoffset="190"
                  strokeLinecap="round"
                  className="rotate-[-90deg] transform origin-center"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth="32"
                  strokeDasharray="502"
                  strokeDashoffset="310"
                  strokeLinecap="round"
                  className="rotate-[-90deg] transform origin-center"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth="32"
                  strokeDasharray="502"
                  strokeDashoffset="410"
                  strokeLinecap="round"
                  className="rotate-[-90deg] transform origin-center"
                />
              </svg>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>{t('sources.online')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <span>{t('sources.offline')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <span>{t('sources.recurring')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentDonationsTable />
        <TopCampaignsTable />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickActions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium">
              {t('quickActions.newDonation')}
            </button>
            <button className="px-4 py-2 border border-input bg-background rounded-md hover:bg-accent text-sm font-medium">
              {t('quickActions.newCampaign')}
            </button>
            <button className="px-4 py-2 border border-input bg-background rounded-md hover:bg-accent text-sm font-medium">
              {t('quickActions.sendReceipt')}
            </button>
            <button className="px-4 py-2 border border-input bg-background rounded-md hover:bg-accent text-sm font-medium">
              {t('quickActions.exportReport')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}