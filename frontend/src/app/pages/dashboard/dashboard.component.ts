import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { environment } from '../../../environments/environment';

type NavId = 'dashboard' | 'subscriptions' | 'alerts' | 'analytics' | 'cancelled' | 'payments' | 'settings';

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
  activeNav: NavId = 'dashboard';

  // Custom Datepicker State
  currentMonth = new Date();
  calendarDays: {date: Date, isCurrentMonth: boolean, isStart: boolean, isEnd: boolean, inRange: boolean, today: boolean, formatted: number}[] = [];
  weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  selectedStartDate: Date | null = null;
  selectedEndDate: Date | null = null;

  // Wizard state
  currentStep = 1;

  // Toast State
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';

  notificationsOpen = false;

  // Autocomplete State
  filteredCompanies: any[] = [];
  showCompanySuggestions = false;
  companySearchTimeout: any;

  authService = inject(AuthService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  user = this.authService.user;

  navItems: { id: NavId; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'subscriptions', label: 'Subscriptions', icon: 'layers' },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
  ];

  get userFirstName(): string {
    const name = this.userDisplayName;
    return name.split(' ')[0] || name;
  }

  get mostExpensiveSubscription() {
    if (!this.subscriptions || this.subscriptions.length === 0) return null;
    return this.subscriptions.reduce((prev, current) => (prev.cost_usd > current.cost_usd) ? prev : current);
  }

  ngOnInit() {
    if (this.user()) {
      this.fetchData();
    }
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.userMenuOpen = false;
    this.notificationsOpen = false;
  }

  get filteredSubs() {
    if (!this.searchQuery) return this.subscriptions;
    const q = this.searchQuery.toLowerCase();
    return this.subscriptions.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.vendor?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
    );
  }

  get spendTrend(): number[] {
    const trend = this.analytics?.monthly_spend_trend || [];
    return trend.map((m: any) => m.total_usd ?? 0);
  }

  get alertsUrgent(): boolean {
    return this.alerts.some((a) => this.daysUntilRenewal(a.next_renewal) <= 3);
  }

  get userInitials(): string {
    const u = this.user();
    if (!u) return '?';
    const name = u.displayName || u.email || '?';
    return name.charAt(0).toUpperCase();
  }

  get userDisplayName(): string {
    const u = this.user();
    return u?.displayName || u?.email?.split('@')[0] || 'User';
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
      
      // Mock cancelled data
      this.cancelledSubs = [
        { id: 'c1', name: 'Adobe Creative Cloud', vendor: 'Adobe', category: 'productivity', cost_usd: 54.99, cancel_reason: 'Too expensive, switched to Figma', cancelled_at: new Date(Date.now() - 90*86400000).toISOString() },
        { id: 'c2', name: 'Slack Pro', vendor: 'Slack', category: 'productivity', cost_usd: 8.00, cancel_reason: 'Company moved to Microsoft Teams', cancelled_at: new Date(Date.now() - 45*86400000).toISOString() }
      ];
      
      // Mock payments data
      this.payments = [
        { id: 'p1', name: 'Netflix', vendor: 'Netflix', category: 'entertainment', cost_usd: 15.49, status: 'paid', date: new Date().toISOString() },
        { id: 'p2', name: 'Spotify', vendor: 'Spotify', category: 'entertainment', cost_usd: 10.99, status: 'paid', date: new Date(Date.now() - 2*86400000).toISOString() },
        { id: 'p3', name: 'GitHub Copilot', vendor: 'GitHub', category: 'productivity', cost_usd: 10.00, status: 'failed', date: new Date(Date.now() - 5*86400000).toISOString() },
        { id: 'p4', name: 'AWS', vendor: 'Amazon', category: 'utilities', cost_usd: 42.10, status: 'paid', date: new Date(Date.now() - 32*86400000).toISOString() },
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
    setTimeout(() => {
      this.toastMessage = null;
    }, 3000);
  }

  async changePage(delta: number) {
    const next = this.subsPage + delta;
    if (next < 1 || next > this.subsPages) return;
    this.subsPage = next;
    await this.fetchData();
    this.scrollToTable();
  }

  scrollToTable() {
    document.getElementById('subs-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openDrawer(sub: any = null) {
    this.selectedSub = sub;
    if (sub) {
      this.newSubForm = {
        name: sub.name || '',
        cost_usd: sub.cost_usd || null,
        category: sub.category || 'entertainment',
        customCategory: '',
        next_renewal: sub.next_renewal ? sub.next_renewal.split('T')[0] : ''
      };
    } else {
      this.newSubForm = {
        name: '',
        cost_usd: null,
        category: 'entertainment',
        customCategory: '',
        next_renewal: ''
      };
    }
    this.currentStep = 1;
    this.selectedStartDate = null;
    this.selectedEndDate = null;
    this.showCompanySuggestions = false;
    this.filteredCompanies = [];
    this.drawerOpen = true;
    this.generateCalendar();
  }

  async filterCompanies() {
    const term = this.newSubForm.name.toLowerCase();
    if (!term) {
      this.filteredCompanies = [];
      return;
    }

    if (this.companySearchTimeout) clearTimeout(this.companySearchTimeout);
    
    this.companySearchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(term)}`);
        
        if (response.ok) {
          const data = await response.json();
          this.filteredCompanies = Array.isArray(data) ? data : [];
        } else {
          console.error('Clearbit API Error:', response.status, await response.text());
        }
      } catch (err) {
        console.error('Failed to fetch companies:', err);
      }
    }, 400);
  }

  selectCompany(company: any) {
    this.newSubForm.name = company.name;
    this.showCompanySuggestions = false;
  }

  hideCompanySuggestions() {
    setTimeout(() => {
      this.showCompanySuggestions = false;
    }, 200);
  }

  closeDrawer() {
    this.drawerOpen = false;
    this.selectedSub = null;
  }

  nextStep() {
    if (this.currentStep < 4) {
      this.currentStep++;
      if (this.currentStep === 4) {
        // Guarantee calendar loads correctly by updating right before rendering
        this.currentMonth = new Date();
        this.generateCalendar();
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  applyDates() {
    if (this.selectedStartDate) {
      const y = this.selectedStartDate.getFullYear();
      const m = String(this.selectedStartDate.getMonth() + 1).padStart(2, '0');
      const day = String(this.selectedStartDate.getDate()).padStart(2, '0');
      this.newSubForm.next_renewal = `${y}-${m}-${day}`;
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
    // Monday as first day of week
    let firstDay = new Date(year, month, 1).getDay() - 1;
    if (firstDay === -1) firstDay = 6;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    this.calendarDays = [];
    const today = new Date();
    
    const isStart = (d: Date) => this.selectedStartDate && d.toDateString() === this.selectedStartDate.toDateString();
    const isEnd = (d: Date) => this.selectedEndDate && d.toDateString() === this.selectedEndDate.toDateString();
    const inRange = (d: Date) => {
      if (!this.selectedStartDate || !this.selectedEndDate) return false;
      return d > this.selectedStartDate && d < this.selectedEndDate;
    };

    // Prev month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      this.calendarDays.push({
        date: d,
        isCurrentMonth: false,
        isStart: isStart(d) || false,
        isEnd: isEnd(d) || false,
        inRange: inRange(d),
        today: d.toDateString() === today.toDateString(),
        formatted: d.getDate()
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      this.calendarDays.push({
        date: d,
        isCurrentMonth: true,
        isStart: isStart(d) || false,
        isEnd: isEnd(d) || false,
        inRange: inRange(d),
        today: d.toDateString() === today.toDateString(),
        formatted: d.getDate()
      });
    }
    
    // Next month
    const remaining = 42 - this.calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      this.calendarDays.push({
        date: d,
        isCurrentMonth: false,
        isStart: isStart(d) || false,
        isEnd: isEnd(d) || false,
        inRange: inRange(d),
        today: d.toDateString() === today.toDateString(),
        formatted: d.getDate()
      });
    }
  }

  prevMonth(event: Event) {
    event.stopPropagation();
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth(event: Event) {
    event.stopPropagation();
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    this.generateCalendar();
  }

  selectDate(d: Date, event: Event) {
    event.stopPropagation();
    if (!this.selectedStartDate || (this.selectedStartDate && this.selectedEndDate)) {
      this.selectedStartDate = d;
      this.selectedEndDate = null;
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

  get formattedDisplayDate(): string {
    if (!this.newSubForm.next_renewal) return '';
    const parts = this.newSubForm.next_renewal.split('-');
    if (parts.length !== 3) return this.newSubForm.next_renewal;
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async saveSubscription() {
    try {
      if (!this.newSubForm.name || !this.newSubForm.cost_usd) {
        alert('Please fill in the name and cost');
        return;
      }
      this.submitting = true;
      const payload = {
        name: this.newSubForm.name,
        cost: {
          amount: this.newSubForm.cost_usd,
          currency: 'USD'
        },
        category: this.newSubForm.category === 'other' && this.newSubForm.customCategory ? this.newSubForm.customCategory : this.newSubForm.category,
        start_date: this.selectedStartDate ? this.selectedStartDate.toISOString() : (this.newSubForm.next_renewal ? new Date(this.newSubForm.next_renewal).toISOString() : new Date().toISOString()),
        next_renewal: this.selectedEndDate ? this.selectedEndDate.toISOString() : (this.newSubForm.next_renewal ? new Date(this.newSubForm.next_renewal).toISOString() : new Date().toISOString()),
        vendor: this.newSubForm.name
      };

      if (this.selectedSub?.id) {
        await this.apiService.fetch(`/subscriptions/${this.selectedSub.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await this.apiService.fetch('/subscriptions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      this.closeDrawer();
      await this.fetchData();
      this.showToast('Subscription saved successfully!', 'success');
    } catch (err: any) {
      let msg = 'Failed to save subscription';
      if (err.message && typeof err.message === 'string') msg = err.message;
      else if (err.detail && Array.isArray(err.detail)) msg = err.detail[0].msg;
      else if (typeof err === 'object') msg = JSON.stringify(err);
      this.showToast('Error: ' + msg, 'error');
    } finally {
      this.submitting = false;
    }
  }

  onAddFirst() {
    alert('Add subscription flow — connect to POST /subscriptions from your admin UI.');
  }

  onAddCard() {
    alert('Add Payment Method functionality will open here.');
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
    this.notificationsOpen = false;
  }

  toggleNotifications(event: Event) {
    event.stopPropagation();
    this.notificationsOpen = !this.notificationsOpen;
    this.userMenuOpen = false;
  }

  setNav(id: NavId) {
    this.activeNav = id;
    if (id !== 'dashboard') {
      document.getElementById(id === 'subscriptions' ? 'subs-table' : 'dash-top')?.scrollIntoView({
        behavior: 'smooth',
      });
    }
  }

  async handleSignOut() {
    await this.authService.signOut();
    this.router.navigate(['/']);
  }

  fmtDate(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  fmtCur(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
  }

  initial(v: string) {
    return v ? v.charAt(0).toUpperCase() : '?';
  }

  avatarHue(name: string): number {
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return Math.abs(h) % 360;
  }

  categoryClass(cat: string): string {
    const c = (cat || 'other').toLowerCase();
    if (c.includes('entertain')) return 'cat-entertainment';
    if (c.includes('product')) return 'cat-productivity';
    if (c.includes('util')) return 'cat-utilities';
    if (c.includes('stor')) return 'cat-storage';
    return 'cat-other';
  }

  daysUntilRenewal(iso: string): number {
    if (!iso) return 99;
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  }

  isRenewingSoon(iso: string) {
    return this.daysUntilRenewal(iso) <= 7;
  }

  isRenewingCritical(iso: string) {
    return this.daysUntilRenewal(iso) <= 3;
  }

  sparklineBars(values: number[]): { height: string; opacity: number }[] {
    if (!values.length) return [];
    const max = Math.max(...values, 1);
    return values.map((v, i) => ({
      height: `${Math.max(8, (v / max) * 100)}%`,
      opacity: 0.45 + (i / values.length) * 0.55,
    }));
  }

  alertBarWidth(): string {
    if (!this.alerts.length) return '0%';
    const urgent = this.alerts.filter((a) => this.daysUntilRenewal(a.next_renewal) <= 3).length;
    const pct = Math.min(100, (urgent / Math.max(this.alerts.length, 1)) * 100 + 20);
    return `${pct}%`;
  }

  // Dynamic SVG Helpers
  generateLinePath(data: number[], width: number, height: number): string {
    if (!data || data.length < 2) {
      return `M 0,${height} L ${width},${height}`; // flat line
    }
    const max = Math.max(...data, 1);
    
    let path = `M 0,${height - (data[0] / max) * height}`;
    const stepX = width / (data.length - 1);
    
    for (let i = 1; i < data.length; i++) {
      const x = i * stepX;
      const y = height - (data[i] / max) * height;
      const prevX = (i - 1) * stepX;
      const prevY = height - (data[i - 1] / max) * height;
      const cp1x = prevX + stepX / 2;
      const cp1y = prevY;
      const cp2x = x - stepX / 2;
      const cp2y = y;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
    }
    return path;
  }

  get projectedPath() {
    const trend = this.spendTrend;
    const data = trend.length > 1 ? trend : [0, 0, 0, 0];
    return this.generateLinePath(data, 200, 80);
  }

  get topSubPath() {
    // Fake a trend for the top sub for now
    const val = this.subscriptions[0]?.cost_usd || 0;
    return this.generateLinePath([val*0.8, val*0.9, val*0.85, val, val*0.9], 200, 60);
  }

  polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  createArcPath(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
    const start = this.polarToCartesian(x, y, radius, endAngle);
    const end = this.polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  }

  get donutSegments() {
    const cats = this.totals?.by_category || [];
    const total = this.totals?.monthly_total_usd || 0;
    const colors = ['#f04438', '#f59e0b', '#7b3aed', '#10b981'];
    
    if (total === 0 || cats.length === 0) {
      return [{ path: this.createArcPath(50, 50, 40, 0, 359.9), color: '#e5e7eb', name: 'No data' }];
    }

    let currentAngle = 0;
    return cats.map((cat: any, i: number) => {
      const pct = cat.monthly_usd / total;
      const angle = pct * 360;
      // Ensure we don't draw exactly 360 which might break the arc
      const safeAngle = angle >= 360 ? 359.9 : angle;
      const endAngle = currentAngle + safeAngle;
      const path = this.createArcPath(50, 50, 40, currentAngle, endAngle);
      currentAngle = endAngle;
      return {
        path,
        color: colors[i % colors.length],
        name: cat.category,
      };
    });
  }
}
