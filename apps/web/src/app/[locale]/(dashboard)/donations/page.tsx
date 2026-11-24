'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Filter, Download, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import { useTenantCurrency, useTenantLocale } from '@/components/providers/tenant-provider'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

const mockDonations = [
  { id: '1', donor: 'Priya Sharma', email: 'priya@example.com', amount: 50000, campaign: 'Education for All', method: 'UPI', date: '2024-01-15T10:30:00Z', status: 'completed', receiptSent: true },
  { id: '2', donor: 'Rajesh Kumar', email: 'rajesh@example.com', amount: 25000, campaign: 'Healthcare Initiative', method: 'Card', date: '2024-01-14T14:22:00Z', status: 'completed', receiptSent: true },
  { id: '3', donor: 'Anita Patel', email: 'anita@example.com', amount: 100000, campaign: 'Disaster Relief', method: 'Net Banking', date: '2024-01-13T09:15:00Z', status: 'pending', receiptSent: false },
  { id: '4', donor: 'Amit Singh', email: 'amit@example.com', amount: 15000, campaign: 'Women Empowerment', method: 'UPI', date: '2024-01-12T16:45:00Z', status: 'completed', receiptSent: true },
  { id: '5', donor: 'Sunita Devi', email: 'sunita@example.com', amount: 75000, campaign: 'Child Welfare', method: 'Wallet', date: '2024-01-11T11:20:00Z', status: 'failed', receiptSent: false },
  { id: '6', donor: 'Vikram Mehta', email: 'vikram@example.com', amount: 500000, campaign: 'Education for All', method: 'Card', date: '2024-01-10T13:10:00Z', status: 'completed', receiptSent: true },
  { id: '7', donor: 'Kavya Reddy', email: 'kavya@example.com', amount: 30000, campaign: 'Healthcare Initiative', method: 'UPI', date: '2024-01-09T08:55:00Z', status: 'completed', receiptSent: true },
  { id: '8', donor: 'Rohit Agarwal', email: 'rohit@example.com', amount: 200000, campaign: 'Disaster Relief', method: 'Net Banking', date: '2024-01-08T12:30:00Z', status: 'refunded', receiptSent: false }
]

const statusConfig = {
  completed: { label: 'completed', color: 'bg-green-500/10 text-green-500' },
  pending: { label: 'pending', color: 'bg-yellow-500/10 text-yellow-500' },
  failed: { label: 'failed', color: 'bg-red-500/10 text-red-500' },
  refunded: { label: 'refunded', color: 'bg-blue-500/10 text-blue-500' }
}

export default function DonationsPage() {
  const t = useTranslations('donations')
  const currency = useTenantCurrency()
  const locale = useTenantLocale()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const filteredDonations = mockDonations.filter(d => {
    const matchesSearch = d.donor.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase()) ||
      d.campaign.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    const matchesMethod = methodFilter === 'all' || d.method === methodFilter
    return matchesSearch && matchesStatus && matchesMethod
  })

  const paginatedDonations = filteredDonations.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filteredDonations.length / pageSize)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <a href={`/${locale}/donations/new`}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newDonation')}
          </a>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('filters.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder={t('filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
                <SelectItem value="completed">{t('status.completed')}</SelectItem>
                <SelectItem value="pending">{t('status.pending')}</SelectItem>
                <SelectItem value="failed">{t('status.failed')}</SelectItem>
                <SelectItem value="refunded">{t('status.refunded')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder={t('filters.method')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allMethods')}</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Net Banking">Net Banking</SelectItem>
                <SelectItem value="Wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              {t('filters.export')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Donations Table */}
      <Card>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t('columns.donor')}</TableHead>
                  <TableHead>{t('columns.amount')}</TableHead>
                  <TableHead>{t('columns.campaign')}</TableHead>
                  <TableHead>{t('columns.method')}</TableHead>
                  <TableHead>{t('columns.date')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead>{t('columns.receipt')}</TableHead>
                  <TableHead className="w-40">{t('columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDonations.map((donation) => {
                  const config = statusConfig[donation.status as keyof typeof statusConfig]
                  return (
                    <TableRow key={donation.id} className="hover:bg-muted/50">
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => {}}>
                              <Eye className="mr-2 h-4 w-4" />
                              {t('actions.view')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => {}}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t('actions.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => {}} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('actions.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{donation.donor}</p>
                          <p className="text-sm text-muted-foreground">{donation.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(donation.amount, currency, locale)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{donation.campaign}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{donation.method}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(donation.date, locale, { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(config.color)}>
                          {t(`status.${config.label}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {donation.receiptSent ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            {t('receipt.sent')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                            {t('receipt.pending')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {t('pagination.showing', {
                  start: (page - 1) * pageSize + 1,
                  end: Math.min(page * pageSize, filteredDonations.length),
                  total: filteredDonations.length
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('pagination.previous')}
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <Button
                      key={p}
                      variant={page === p ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 px-0"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}