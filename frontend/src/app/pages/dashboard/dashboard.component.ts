import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

type NavId = 'dashboard' | 'subscriptions' | 'analytics' | 'alerts' | 'payments' | 'cancelled' | 'settings';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  totals: any = null;
  analytics: any = null;
  subscriptions: any[] = [];
  alerts: any[] = [];
  loading = true;
  error: string | null = null;
  searchQuery = '';
  subsPage = 1;
  subsPages = 1;
  subsTotal = 0;
  readonly subsLimit = 20;

  cancelledSubs: any[] = [];
  payments: any[] = [];

  settingsForm = {
    displayName: '',
    defaultCurrency: 'USD',
    reminderDays: 7,
    timezone: 'UTC',
    alertsRenewal: true,
    alertsWeekly: false
  };

  drawerOpen = false;
  deleteConfirmId: string | null = null;
  selectedSub: any = null;
  newSubForm = {
    name: '',
    cost_usd: null as number | null,
    category: 'entertainment',
    customCategory: '',
    next_renewal: ''
  };
  submitting = false;
  userMenuOpen = false;
  notificationsOpen = false;
  activeNav: NavId = 'dashboard';

  currentMonth = new Date();
  calendarDays: {date: Date, isCurrentMonth: boolean, isStart: boolean, isEnd: boolean, inRange: boolean, today: boolean, formatted: number}[] = [];
  weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  selectedStartDate: Date | null = null;
  selectedEndDate: Date | null = null;
  currentStep = 1;

  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';

  filteredCompanies: any[] = [];
  showCompanySuggestions = false;
  companySearchTimeout: any;

  authService = inject(AuthService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  user = this.authService.user;

  navItems: { id: NavId; label: string }[] = [
    { id: 'dashboard',     label: 'Dashboard' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'analytics',     label: 'Analytics' },
    { id: 'alerts',        label: 'Alerts' },
    { id: 'payments',      label: 'Payments' },
  ];

  get userFirstName(): string {
    return this.userDisplayName.split(' ')[0] || this.userDisplayName;
  }

  get userInitials(): string {
    const u = this.user();
    if (!u) return '?';
    return (u.displayName || u.email || '?').charAt(0).toUpperCase();
  }

  get userDisplayName(): string {
    const u = this.user();
    return u?.displayName || u?.email?.split('@')[0] || 'User';
  }

  get mostExpensiveSubscription() {
    if (!this.subscriptions.length) return null;
    return this.subscriptions.reduce((p, c) => p.cost_usd > c.cost_usd ? p : c);
  }

  get filteredSubs() {
    if (!this.searchQuery) return this.subscriptions;
    const q = this.searchQuery.toLowerCase();
    return this.subscriptions.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.vendor?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q)
    );
  }

  get spendTrend(): number[] {
    return (this.analytics?.monthly_spend_trend || []).map((m: any) => m.total_usd ?? 0);
  }

  get activeSubCount(): number {
    return this.subscriptions.filter(s => s.status === 'active' || !s.status).length;
  }

  get upcomingRenewalCount(): number {
    return this.subscriptions.filter(s => this.daysUntilRenewal(s.next_renewal) <= 30).length;
  }

  get alertsCritical() {
    return this.alerts.filter(a => this.daysUntilRenewal(a.next_renewal ?? a.date) <= 3);
  }
  get alertsSoon() {
    return this.alerts.filter(a => {
      const d = this.daysUntilRenewal(a.next_renewal ?? a.date);
      return d > 3 && d <= 7;
    });
  }
  get alertsUpcoming() {
    return this.alerts.filter(a => {
      const d = this.daysUntilRenewal(a.next_renewal ?? a.date);
      return d > 7 && d <= 30;
    });
  }

  get paymentsSucceeded() { return this.payments.filter(p => p.status === 'paid'); }
  get paymentsFailed()    { return this.payments.filter(p => p.status === 'failed'); }
  get paymentsTotal()     { return this.paymentsSucceeded.reduce((s, p) => s + (p.cost_usd || 0), 0); }

  get cancelledSavings(): number {
    return this.cancelledSubs.reduce((s, c) => s + (c.cost_usd || 0), 0);
  }

  get categoryBreakdown() {
    return this.totals?.by_category || [];
  }

  get maxSpend(): number {
    return this.spendTrend.length ? Math.max(...this.spendTrend) : 0;
  }

  get analyticsBarData(): { label: string; value: number; pct: number }[] {
    const trend = this.spendTrend;
    if (trend.length === 0) return [];
    const max = Math.max(...trend, 1);
    const now = new Date();
    return trend.slice(-6).map((v: number, i: number, arr: number[]) => {
      const monthOffset = arr.length - 1 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      return {
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        value: v,
        pct: Math.max(4, (v / max) * 100)
      };
    });
  }

  ngOnInit() {
    if (this.user()) this.fetchData();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.userMenuOpen = false;
    this.notificationsOpen = false;
  }

  async fetchData() {
    if (!this.user()) return;
    try {
      this.loading = true;
      this.error = null;
      const [tRes, aRes, sRes, alRes] = await Promise.all([
        this.apiService.fetch('/dashboard/totals'),
        this.apiService.fetch('/analytics').catch(() => null),
        this.apiService.fetch(`/subscriptions?page=${this.subsPage}&limit=${this.subsLimit}`),
        this.apiService.fetch('/alerts').catch(() => []),
      ]);
      this.totals = tRes || {};
      this.analytics = aRes;
      this.subscriptions = sRes?.data ?? (Array.isArray(sRes) ? sRes : []);
      this.subsTotal = sRes?.total ?? this.subscriptions.length;
      this.subsPage = sRes?.page ?? 1;
      this.subsPages = sRes?.pages ?? 1;
      this.alerts = alRes || [];

      this.cancelledSubs = [
        { id: 'c1', name: 'Adobe Creative Cloud', vendor: 'Adobe', category: 'productivity', cost_usd: 54.99, cancel_reason: 'Too expensive, switched to Figma', cancelled_at: new Date(Date.now() - 90*86400000).toISOString() },
        { id: 'c2', name: 'Slack Pro', vendor: 'Slack', category: 'communication', cost_usd: 8.00, cancel_reason: 'Company moved to Microsoft Teams', cancelled_at: new Date(Date.now() - 45*86400000).toISOString() }
      ];

      this.payments = [
        { id: 'p1', name: 'Netflix', vendor: 'Netflix', category: 'entertainment', cost_usd: 15.49, status: 'paid', date: new Date().toISOString() },
        { id: 'p2', name: 'Spotify', vendor: 'Spotify', category: 'entertainment', cost_usd: 10.99, status: 'paid', date: new Date(Date.now() - 2*86400000).toISOString() },
        { id: 'p3', name: 'GitHub Copilot', vendor: 'GitHub', category: 'development', cost_usd: 10.00, status: 'failed', date: new Date(Date.now() - 5*86400000).toISOString() },
        { id: 'p4', name: 'AWS', vendor: 'Amazon', category: 'utilities', cost_usd: 42.10, status: 'paid', date: new Date(Date.now() - 32*86400000).toISOString() },
        { id: 'p5', name: 'Figma', vendor: 'Figma', category: 'design', cost_usd: 15.00, status: 'paid', date: new Date(Date.now() - 7*86400000).toISOString() },
        { id: 'p6', name: 'Linear', vendor: 'Linear', category: 'productivity', cost_usd: 8.00, status: 'paid', date: new Date(Date.now() - 10*86400000).toISOString() },
      ];

      this.settingsForm.displayName = this.userDisplayName;
    } catch (err: any) {
      this.error = err.message || 'Could not connect to API';
    } finally {
      this.loading = false;
    }
  }

  showToast(msg: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => { this.toastMessage = null; }, 3500);
  }

  openDrawer(sub: any = null) {
    this.selectedSub = sub;
    this.newSubForm = sub ? {
      name: sub.name || '',
      cost_usd: sub.cost_usd || null,
      category: sub.category || 'entertainment',
      customCategory: '',
      next_renewal: sub.next_renewal ? sub.next_renewal.split('T')[0] : ''
    } : { name: '', cost_usd: null, category: 'entertainment', customCategory: '', next_renewal: '' };
    this.currentStep = 1;
    this.selectedStartDate = null;
    this.selectedEndDate = null;
    this.showCompanySuggestions = false;
    this.filteredCompanies = [];
    this.drawerOpen = true;
    this.generateCalendar();
  }

  closeDrawer() {
    this.drawerOpen = false;
    this.selectedSub = null;
    this.deleteConfirmId = null;
  }

  async deleteSub(id: string) {
    if (this.deleteConfirmId !== id) {
      this.deleteConfirmId = id;
      return;
    }
    try {
      await this.apiService.fetch(`/subscriptions/${id}`, { method: 'DELETE' });
      await this.fetchData();
      this.deleteConfirmId = null;
      this.showToast('Subscription deleted', 'success');
    } catch (err: any) {
      this.showToast('Failed to delete', 'error');
      this.deleteConfirmId = null;
    }
  }

  async filterCompanies() {
    const term = this.newSubForm.name.toLowerCase();
    if (!term) { this.filteredCompanies = []; return; }
    if (this.companySearchTimeout) clearTimeout(this.companySearchTimeout);
    this.companySearchTimeout = setTimeout(async () => {
      try {
        const r = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(term)}`);
        if (r.ok) this.filteredCompanies = await r.json();
      } catch {}
    }, 400);
  }

  selectCompany(company: any) {
    this.newSubForm.name = company.name;
    this.showCompanySuggestions = false;
  }

  hideCompanySuggestions() {
    setTimeout(() => { this.showCompanySuggestions = false; }, 200);
  }

  nextStep() {
    if (this.currentStep < 4) {
      this.currentStep++;
      if (this.currentStep === 4) { this.currentMonth = new Date(); this.generateCalendar(); }
    }
  }
  prevStep() { if (this.currentStep > 1) this.currentStep--; }

  applyDates() {
    if (this.selectedStartDate) {
      const y = this.selectedStartDate.getFullYear();
      const m = String(this.selectedStartDate.getMonth() + 1).padStart(2, '0');
      const d = String(this.selectedStartDate.getDate()).padStart(2, '0');
      this.newSubForm.next_renewal = `${y}-${m}-${d}`;
    }
  }

  cancelDates() {
    this.selectedStartDate = null;
    this.selectedEndDate = null;
    this.generateCalendar();
  }

  generateCalendar() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    let firstDay = new Date(year, month, 1).getDay() - 1;
    if (firstDay === -1) firstDay = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    this.calendarDays = [];
    const today = new Date();
    const isStart = (d: Date) => !!(this.selectedStartDate && d.toDateString() === this.selectedStartDate.toDateString());
    const isEnd   = (d: Date) => !!(this.selectedEndDate && d.toDateString() === this.selectedEndDate.toDateString());
    const inRange = (d: Date) => !!(this.selectedStartDate && this.selectedEndDate && d > this.selectedStartDate && d < this.selectedEndDate);
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      this.calendarDays.push({ date: d, isCurrentMonth: false, isStart: isStart(d), isEnd: isEnd(d), inRange: inRange(d), today: d.toDateString() === today.toDateString(), formatted: d.getDate() });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      this.calendarDays.push({ date: d, isCurrentMonth: true, isStart: isStart(d), isEnd: isEnd(d), inRange: inRange(d), today: d.toDateString() === today.toDateString(), formatted: d.getDate() });
    }
    const remaining = 42 - this.calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      this.calendarDays.push({ date: d, isCurrentMonth: false, isStart: isStart(d), isEnd: isEnd(d), inRange: inRange(d), today: d.toDateString() === today.toDateString(), formatted: d.getDate() });
    }
  }

  prevMonth(e: Event) { e.stopPropagation(); this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1); this.generateCalendar(); }
  nextMonth(e: Event) { e.stopPropagation(); this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1); this.generateCalendar(); }

  selectDate(d: Date, e: Event) {
    e.stopPropagation();
    if (!this.selectedStartDate || (this.selectedStartDate && this.selectedEndDate)) {
      this.selectedStartDate = d; this.selectedEndDate = null;
    } else if (d < this.selectedStartDate) {
      this.selectedStartDate = d;
    } else {
      this.selectedEndDate = d;
    }
    this.generateCalendar();
  }

  get currentMonthName(): string {
    return this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  async saveSubscription() {
    try {
      if (!this.newSubForm.name || !this.newSubForm.cost_usd) {
        this.showToast('Please fill in name and cost', 'error');
        return;
      }
      this.submitting = true;
      const payload = {
        name: this.newSubForm.name,
        cost: { amount: this.newSubForm.cost_usd, currency: 'USD' },
        category: this.newSubForm.category === 'other' && this.newSubForm.customCategory ? this.newSubForm.customCategory : this.newSubForm.category,
        start_date: this.selectedStartDate ? this.selectedStartDate.toISOString() : (this.newSubForm.next_renewal ? new Date(this.newSubForm.next_renewal).toISOString() : new Date().toISOString()),
        next_renewal: this.selectedEndDate ? this.selectedEndDate.toISOString() : (this.newSubForm.next_renewal ? new Date(this.newSubForm.next_renewal).toISOString() : new Date().toISOString()),
        vendor: this.newSubForm.name
      };
      if (this.selectedSub?.id) {
        await this.apiService.fetch(`/subscriptions/${this.selectedSub.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await this.apiService.fetch('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
      }
      this.closeDrawer();
      await this.fetchData();
      this.showToast(this.selectedSub ? 'Subscription updated!' : 'Subscription added!', 'success');
    } catch (err: any) {
      let msg = 'Failed to save subscription';
      if (err.message) msg = err.message;
      else if (err.detail && Array.isArray(err.detail)) msg = err.detail[0].msg;
      this.showToast('Error: ' + msg, 'error');
    } finally {
      this.submitting = false;
    }
  }

  onAddCard() {
    this.showToast('Payment method management coming soon!', 'success');
  }

  toggleUserMenu(e: Event) { e.stopPropagation(); this.userMenuOpen = !this.userMenuOpen; this.notificationsOpen = false; }
  toggleNotifications(e: Event) { e.stopPropagation(); this.notificationsOpen = !this.notificationsOpen; this.userMenuOpen = false; }

  setNav(id: NavId) {
    this.activeNav = id;
    this.deleteConfirmId = null;
  }

  async handleSignOut() {
    await this.authService.signOut();
    this.router.navigate(['/']);
  }

  fmtDate(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  fmtDateShort(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  fmtCur(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
  }

  categoryClass(cat: string): string {
    const c = (cat || 'other').toLowerCase();
    if (c.includes('entertain')) return 'cat-entertainment';
    if (c.includes('product')) return 'cat-productivity';
    if (c.includes('util')) return 'cat-utilities';
    if (c.includes('storage') || c.includes('cloud')) return 'cat-storage';
    if (c.includes('design')) return 'cat-design';
    if (c.includes('dev')) return 'cat-development';
    if (c.includes('comm')) return 'cat-communication';
    if (c.includes('finance')) return 'cat-finance';
    return 'cat-other';
  }

  categoryIcon(cat: string): string {
    const c = (cat || '').toLowerCase();
    if (c.includes('entertain')) return '🎬';
    if (c.includes('product')) return '⚡';
    if (c.includes('util')) return '🔧';
    if (c.includes('cloud') || c.includes('storage')) return '☁️';
    if (c.includes('design')) return '🎨';
    if (c.includes('dev')) return '💻';
    if (c.includes('comm')) return '💬';
    if (c.includes('finance')) return '💰';
    if (c.includes('market')) return '📢';
    return '📦';
  }

  daysUntilRenewal(iso: string): number {
    if (!iso) return 99;
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  }

  renewalUrgency(iso: string): 'critical' | 'soon' | 'normal' {
    const d = this.daysUntilRenewal(iso);
    if (d <= 3) return 'critical';
    if (d <= 7) return 'soon';
    return 'normal';
  }

  generateLinePath(data: number[], width: number, height: number): string {
    if (!data || data.length < 2) return `M 0,${height} L ${width},${height}`;
    const max = Math.max(...data, 1);
    let path = `M 0,${height - (data[0] / max) * height}`;
    const stepX = width / (data.length - 1);
    for (let i = 1; i < data.length; i++) {
      const x = i * stepX;
      const y = height - (data[i] / max) * height;
      const prevX = (i - 1) * stepX;
      const prevY = height - (data[i - 1] / max) * height;
      path += ` C ${prevX + stepX / 2},${prevY} ${x - stepX / 2},${y} ${x},${y}`;
    }
    return path;
  }

  get projectedPath() {
    const data = this.spendTrend.length > 1 ? this.spendTrend : [0, 0, 0, 0];
    return this.generateLinePath(data, 200, 80);
  }

  get topSubPath() {
    const val = this.subscriptions[0]?.cost_usd || 0;
    return this.generateLinePath([val*0.8, val*0.9, val*0.85, val, val*0.9], 200, 60);
  }

  polarToCartesian(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  createArcPath(x: number, y: number, r: number, startAngle: number, endAngle: number): string {
    const start = this.polarToCartesian(x, y, r, endAngle);
    const end   = this.polarToCartesian(x, y, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  get donutSegments() {
    const cats = this.totals?.by_category || [];
    const total = this.totals?.monthly_total_usd || 0;
    const colors = ['#8b1a1a', '#f59e0b', '#6366f1', '#10b981', '#3b82f6'];
    if (total === 0 || cats.length === 0) {
      return [{ path: this.createArcPath(50, 50, 38, 0, 359.9), color: '#e5e7eb', name: 'No data', pct: 0 }];
    }
    let angle = 0;
    return cats.map((cat: any, i: number) => {
      const pct = cat.monthly_usd / total;
      const sweep = Math.min(pct * 360, 359.9);
      const end = angle + sweep;
      const path = this.createArcPath(50, 50, 38, angle, end);
      angle = end;
      return { path, color: colors[i % colors.length], name: cat.category, pct: Math.round(pct * 100) };
    });
  }
}
