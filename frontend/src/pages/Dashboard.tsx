import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../utils/api';
import './Dashboard.css';

type NavId = 'dashboard' | 'subscriptions' | 'analytics' | 'alerts' | 'payments' | 'cancelled' | 'settings';

// Count-up animation hook
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

// Category heuristic for auto-suggest based on company domain/name
const DOMAIN_CATEGORY_MAP: Record<string, string> = {
  netflix: 'entertainment', spotify: 'entertainment', youtube: 'entertainment', disney: 'entertainment',
  hulu: 'entertainment', apple: 'entertainment', amazon: 'entertainment',
  github: 'development', gitlab: 'development', jira: 'development', linear: 'development',
  vercel: 'development', heroku: 'development', aws: 'cloud_services', gcp: 'cloud_services',
  azure: 'cloud_services', digitalocean: 'cloud_services', cloudflare: 'cloud_services',
  figma: 'design', canva: 'design', adobe: 'design', sketch: 'design',
  slack: 'communication', zoom: 'communication', teams: 'communication', discord: 'communication',
  notion: 'productivity', asana: 'productivity', monday: 'productivity', trello: 'productivity',
  dropbox: 'cloud_services', gdrive: 'cloud_services', google: 'productivity',
  stripe: 'finance', quickbooks: 'finance', xero: 'finance',
  hubspot: 'marketing', mailchimp: 'marketing', salesforce: 'marketing',
};
function guessCategory(name: string, domain?: string): string | null {
  const haystack = ((domain || '') + ' ' + (name || '')).toLowerCase();
  for (const [key, cat] of Object.entries(DOMAIN_CATEGORY_MAP)) {
    if (haystack.includes(key)) return cat;
  }
  return null;
}

interface Company {
  name: string;
  domain?: string;
  logo?: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { apiFetch } = useApi();

  const [totals, setTotals] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subsPage, setSubsPage] = useState(1);
  const [subsPages, setSubsPages] = useState(1);
  const [subsTotal, setSubsTotal] = useState(0);
  const subsLimit = 20;

  const [cancelledSubs, setCancelledSubs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Optimistic update: track pending deletes with undo capability
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const [undoToast, setUndoToast] = useState<{ id: string; name: string } | null>(null);

  // Sort + filter state for subscriptions
  const [sortBy, setSortBy] = useState<'renewal' | 'cost' | 'name'>('renewal');
  const [filterCategory, setFilterCategory] = useState<string>('');

  // Cmd+K palette
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const paletteInputRef = useRef<HTMLInputElement>(null);

  const [settingsForm, setSettingsForm] = useState({
    displayName: '',
    defaultCurrency: 'USD',
    reminderDays: 7,
    timezone: 'UTC',
    alertsRenewal: true,
    alertsWeekly: false
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [newSubForm, setNewSubForm] = useState({
    name: '',
    cost_usd: '' as string | number,
    category: 'entertainment',
    customCategory: '',
    next_renewal: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>('dashboard');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const companySearchTimeout = useRef<any>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const userDisplayName = useMemo(() => {
    return user?.displayName || user?.email?.split('@')[0] || 'User';
  }, [user]);

  const userFirstName = useMemo(() => {
    return userDisplayName.split(' ')[0] || userDisplayName;
  }, [userDisplayName]);

  const userInitials = useMemo(() => {
    if (!user) return '?';
    return (user.displayName || user.email || '?').charAt(0).toUpperCase();
  }, [user]);

  const mostExpensiveSubscription = useMemo(() => {
    if (!subscriptions.length) return null;
    return subscriptions.reduce((p, c) => ((p.cost_usd || 0) > (c.cost_usd || 0) ? p : c));
  }, [subscriptions]);

  const filteredSubs = useMemo(() => {
    let result = subscriptions;
    if (filterCategory) result = result.filter(s => s.category === filterCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.vendor?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'cost') result = [...result].sort((a, b) => (b.cost_usd || 0) - (a.cost_usd || 0));
    else if (sortBy === 'name') result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else result = [...result].sort((a, b) => new Date(a.next_renewal || '').getTime() - new Date(b.next_renewal || '').getTime());
    return result;
  }, [subscriptions, searchQuery, sortBy, filterCategory]);

  // Highlight matched substring in text
  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query || !text) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
  };

  // Unique categories for filter chips
  const allCategories = useMemo(() => {
    const cats = Array.from(new Set(subscriptions.map(s => s.category).filter(Boolean))) as string[];
    return cats.sort();
  }, [subscriptions]);

  // Palette search results
  type PaletteResult = { type: string; id: string; label: string; sub: string };
  const paletteResults = useMemo((): PaletteResult[] => {
    const q = paletteQuery.toLowerCase();
    const subMatches: PaletteResult[] = subscriptions
      .filter(s => !q || s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(s => ({ type: 'sub', id: s.id as string, label: s.name as string, sub: (s.category || '') as string }));
    const navMatches: PaletteResult[] = ([
      { type: 'nav', id: 'dashboard',     label: 'Go to Dashboard',     sub: '' },
      { type: 'nav', id: 'subscriptions', label: 'Go to Subscriptions', sub: '' },
      { type: 'nav', id: 'analytics',     label: 'Go to Analytics',     sub: '' },
      { type: 'nav', id: 'alerts',        label: 'Go to Alerts',        sub: '' },
      { type: 'nav', id: 'payments',      label: 'Go to Payments',      sub: '' },
    ] as PaletteResult[]).filter(n => !q || n.label.toLowerCase().includes(q));
    const addMatch: PaletteResult[] = (!q || 'add subscription'.includes(q))
      ? [{ type: 'action', id: 'add', label: '+ Add subscription', sub: '' }]
      : [];
    return [...addMatch, ...navMatches, ...subMatches];
  }, [subscriptions, paletteQuery]);


  const spendTrend = useMemo((): number[] => {
    return (analytics?.monthly_spend_trend || []).map((m: any) => m.total_usd ?? 0);
  }, [analytics]);

  const activeSubCount = useMemo(() => {
    return subscriptions.filter(s => s.status === 'active' || !s.status).length;
  }, [subscriptions]);

  const upcomingRenewalCount = useMemo(() => {
    return subscriptions.filter(s => daysUntilRenewal(s.next_renewal) <= 30).length;
  }, [subscriptions]);

  const alertsCritical = useMemo(() => {
    return alerts.filter(a => daysUntilRenewal(a.next_renewal ?? a.date) <= 3);
  }, [alerts]);

  const alertsSoon = useMemo(() => {
    return alerts.filter(a => {
      const d = daysUntilRenewal(a.next_renewal ?? a.date);
      return d > 3 && d <= 7;
    });
  }, [alerts]);

  const alertsUpcoming = useMemo(() => {
    return alerts.filter(a => {
      const d = daysUntilRenewal(a.next_renewal ?? a.date);
      return d > 7 && d <= 30;
    });
  }, [alerts]);

  const paymentsSucceeded = useMemo(() => payments.filter(p => p.status === 'paid'), [payments]);
  const paymentsFailed = useMemo(() => payments.filter(p => p.status === 'failed'), [payments]);
  const paymentsTotal = useMemo(() => paymentsSucceeded.reduce((s, p) => s + (p.cost_usd || 0), 0), [paymentsSucceeded]);

  const categoryBreakdown = useMemo(() => totals?.by_category || [], [totals]);
  const maxSpend = useMemo(() => (spendTrend.length ? Math.max(...spendTrend) : 0), [spendTrend]);

  const analyticsBarData = useMemo(() => {
    const trend = spendTrend;
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
  }, [spendTrend]);

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const [tRes, aRes, sRes, alRes] = await Promise.all([
        apiFetch('/dashboard/totals'),
        apiFetch('/analytics').catch(() => null),
        apiFetch(`/subscriptions?page=${subsPage}&limit=${subsLimit}`),
        apiFetch('/alerts').catch(() => []),
      ]);
      setTotals(tRes || {});
      setAnalytics(aRes);
      const subs = sRes?.data ?? (Array.isArray(sRes) ? sRes : []);
      setSubscriptions(subs);
      setSubsTotal(sRes?.total ?? subs.length);
      setSubsPage(sRes?.page ?? 1);
      setSubsPages(sRes?.pages ?? 1);
      setAlerts(alRes || []);

      // Fetch real cancelled subs
      apiFetch('/subscriptions?status=cancelled&limit=50').then((cRes: any) => {
        const cancelled = cRes?.data ?? (Array.isArray(cRes) ? cRes : []);
        setCancelledSubs(cancelled);
      }).catch(() => setCancelledSubs([]));

      // Fetch real payments
      setPaymentsLoading(true);
      apiFetch('/payments').then((pRes: any) => {
        setPayments(Array.isArray(pRes) ? pRes : []);
      }).catch(() => setPayments([])).finally(() => setPaymentsLoading(false));

      setSettingsForm(prev => ({
        ...prev,
        displayName: user?.displayName || user?.email?.split('@')[0] || 'User'
      }));
    } catch (err: any) {
      setError(err.message || 'Could not connect to API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Cmd+K palette global listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        if (drawerOpen) setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  // Auto-focus palette input
  useEffect(() => {
    if (paletteOpen && paletteInputRef.current) {
      paletteInputRef.current.focus();
    }
  }, [paletteOpen]);

  // Drawer keyboard: Enter advances step, Esc closes
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const active = document.activeElement as HTMLElement;
        if (active?.tagName === 'BUTTON' || active?.tagName === 'TEXTAREA') return;
        if (currentStep < 4) {
          if (currentStep === 1 && !newSubForm.name) return;
          if (currentStep === 2 && !newSubForm.cost_usd) return;
          setCurrentStep(s => s + 1);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen, currentStep, newSubForm]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setUserMenuOpen(false);
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  const openDrawer = (sub: any = null) => {
    setSelectedSub(sub);
    setNewSubForm(sub ? {
      name: sub.name || '',
      cost_usd: sub.cost_usd ?? '',
      category: sub.category || 'entertainment',
      customCategory: '',
      next_renewal: sub.next_renewal ? sub.next_renewal.split('T')[0] : ''
    } : { name: '', cost_usd: '', category: 'entertainment', customCategory: '', next_renewal: '' });
    setCurrentStep(1);
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    setShowCompanySuggestions(false);
    setFilteredCompanies([]);
    setDrawerOpen(true);
    setCurrentMonth(new Date());
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedSub(null);
  };

  const deleteSub = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic: remove immediately from list
    setSubscriptions(prev => prev.filter(s => s.id !== id));
    setUndoToast({ id, name });

    // Schedule actual API delete with 5s grace period
    const timer = setTimeout(async () => {
      try {
        await apiFetch(`/subscriptions/${id}`, { method: 'DELETE' });
        setUndoToast(null);
        setPendingDeletes(prev => { const n = { ...prev }; delete n[id]; return n; });
      } catch {
        // Rollback on failure
        setSubscriptions(prev => [...prev]);
        await fetchData();
        showToast('Failed to delete subscription', 'error');
        setUndoToast(null);
      }
    }, 5000);
    setPendingDeletes(prev => ({ ...prev, [id]: timer }));
  };

  const undoDelete = (id: string) => {
    const timer = pendingDeletes[id];
    if (timer) clearTimeout(timer);
    setPendingDeletes(prev => { const n = { ...prev }; delete n[id]; return n; });
    setUndoToast(null);
    // Restore: refetch data
    fetchData();
    showToast('Delete cancelled', 'success');
  };

  const filterCompanies = async (val: string) => {
    setNewSubForm(prev => ({ ...prev, name: val }));
    const term = val.toLowerCase();
    if (!term) {
      setFilteredCompanies([]);
      return;
    }
    if (companySearchTimeout.current) clearTimeout(companySearchTimeout.current);
    companySearchTimeout.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(term)}`);
        if (r.ok) {
          const data = await r.json();
          setFilteredCompanies(data);
        }
      } catch {}
    }, 400);
  };

  const selectCompany = (company: Company) => {
    const suggestedCat = guessCategory(company.name, company.domain);
    setNewSubForm(prev => ({
      ...prev,
      name: company.name,
      ...(suggestedCat ? { category: suggestedCat } : {})
    }));
    setShowCompanySuggestions(false);
  };

  const hideCompanySuggestions = () => {
    setTimeout(() => {
      setShowCompanySuggestions(false);
    }, 200);
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
      if (currentStep + 1 === 4) {
        setCurrentMonth(new Date());
      }
    }
  };
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const cancelDates = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmtDateShort = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const fmtCur = (n: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
  };

  const categoryClass = (cat: string): string => {
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
  };

  const categoryIcon = (cat: string): string => {
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
  };

  const daysUntilRenewal = (iso: string): number => {
    if (!iso) return 99;
    const diff = new Date(iso).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const renewalUrgency = (iso: string): 'critical' | 'soon' | 'normal' => {
    const d = daysUntilRenewal(iso);
    if (d <= 3) return 'critical';
    if (d <= 7) return 'soon';
    return 'normal';
  };

  const generateLinePath = (data: number[], width: number, height: number): string => {
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
  };

  const projectedPath = useMemo(() => {
    const data = spendTrend.length > 1 ? spendTrend : [0, 0, 0, 0];
    return generateLinePath(data, 200, 80);
  }, [spendTrend]);

  const topSubPath = useMemo(() => {
    const val = subscriptions[0]?.cost_usd || 0;
    return generateLinePath([val*0.8, val*0.9, val*0.85, val, val*0.9], 200, 60);
  }, [subscriptions]);

  const polarToCartesian = (cx: number, cy: number, r: number, deg: number) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const createArcPath = (x: number, y: number, r: number, startAngle: number, endAngle: number): string => {
    const start = polarToCartesian(x, y, r, endAngle);
    const end   = polarToCartesian(x, y, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  const donutSegments = useMemo(() => {
    const cats = totals?.by_category || [];
    const total = totals?.monthly_total_usd || 0;
    const colors = ['#8b1a1a', '#f59e0b', '#6366f1', '#10b981', '#3b82f6'];
    if (total === 0 || cats.length === 0) {
      return [{ path: createArcPath(50, 50, 38, 0, 359.9), color: '#e5e7eb', name: 'No data', pct: 0 }];
    }
    let angle = 0;
    return cats.map((cat: any, i: number) => {
      const pct = cat.monthly_usd / total;
      const sweep = Math.min(pct * 360, 359.9);
      const end = angle + sweep;
      const path = createArcPath(50, 50, 38, angle, end);
      angle = end;
      return { path, color: colors[i % colors.length], name: cat.category, pct: Math.round(pct * 100) };
    });
  }, [totals]);

  // Calendar Day generation based on state variables
  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    let firstDay = new Date(year, month, 1).getDay() - 1;
    if (firstDay === -1) firstDay = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const list: any[] = [];
    const today = new Date();

    const isStart = (d: Date) => !!(selectedStartDate && d.toDateString() === selectedStartDate.toDateString());
    const isEnd   = (d: Date) => !!(selectedEndDate && d.toDateString() === selectedEndDate.toDateString());
    const inRange = (d: Date) => !!(selectedStartDate && selectedEndDate && d > selectedStartDate && d < selectedEndDate);

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      list.push({ date: d, isCurrentMonth: false, isStart: isStart(d), isEnd: isEnd(d), inRange: inRange(d), today: d.toDateString() === today.toDateString(), formatted: d.getDate() });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      list.push({ date: d, isCurrentMonth: true, isStart: isStart(d), isEnd: isEnd(d), inRange: inRange(d), today: d.toDateString() === today.toDateString(), formatted: d.getDate() });
    }
    const remaining = 42 - list.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      list.push({ date: d, isCurrentMonth: false, isStart: isStart(d), isEnd: isEnd(d), inRange: inRange(d), today: d.toDateString() === today.toDateString(), formatted: d.getDate() });
    }
    return list;
  }, [currentMonth, selectedStartDate, selectedEndDate]);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const selectDate = (d: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      setSelectedStartDate(d);
      setSelectedEndDate(null);
    } else if (d < selectedStartDate) {
      setSelectedStartDate(d);
    } else {
      setSelectedEndDate(d);
    }
  };

  const currentMonthName = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  const saveSubscription = async () => {
    try {
      if (!newSubForm.name || !newSubForm.cost_usd) {
        showToast('Please fill in name and cost', 'error');
        return;
      }
      setSubmitting(true);
      const parsedCost = parseFloat(newSubForm.cost_usd as string);
      const payload = {
        name: newSubForm.name,
        cost: { amount: parsedCost, currency: 'USD' },
        category: newSubForm.category === 'other' && newSubForm.customCategory ? newSubForm.customCategory : newSubForm.category,
        start_date: selectedStartDate ? selectedStartDate.toISOString() : (newSubForm.next_renewal ? new Date(newSubForm.next_renewal).toISOString() : new Date().toISOString()),
        next_renewal: selectedEndDate ? selectedEndDate.toISOString() : (newSubForm.next_renewal ? new Date(newSubForm.next_renewal).toISOString() : new Date().toISOString()),
        vendor: newSubForm.name
      };
      if (selectedSub?.id) {
        await apiFetch(`/subscriptions/${selectedSub.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeDrawer();
      await fetchData();
      showToast(selectedSub ? 'Subscription updated!' : 'Subscription added!', 'success');
    } catch (err: any) {
      let msg = 'Failed to save subscription';
      if (err.message) msg = err.message;
      else if (err.detail && Array.isArray(err.detail)) msg = err.detail[0].msg;
      showToast('Error: ' + msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="skeleton skeleton-logo" />
          </div>
          <nav className="sidebar-nav">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton skeleton-nav-item" />)}
          </nav>
        </aside>
        <main className="main-content">
          <div className="page-header">
            <div>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-sub" style={{ marginTop: '0.5rem' }} />
            </div>
          </div>
          <div className="kpi-row">
            {[...Array(4)].map((_, i) => <div key={i} className="kpi-card"><div className="skeleton skeleton-kpi" /></div>)}
          </div>
          <div className="dash-grid" style={{ marginTop: '1.5rem' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="dash-col">
                <div className="card"><div className="skeleton skeleton-card-body" /></div>
                <div className="card mt-card"><div className="skeleton skeleton-card-body" /></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }


  if (error) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#0b0b0d] gap-4 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-white text-base font-semibold">Failed to load dashboard</h2>
        <p className="text-white/40 text-sm max-w-xs leading-relaxed">{error}</p>
        <button onClick={fetchData} className="mt-2 px-5 py-2.5 bg-[#8b1a1a] text-white text-sm font-medium rounded-xl hover:bg-[#a52222] transition-colors">
          Try again
        </button>
      </div>
    );
  }


  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <a onClick={() => setActiveNav('dashboard')} className="sidebar-brand" style={{ cursor: 'pointer' }}>
          <img src="/logo.png" alt="Prixm" className="sidebar-logo" />
        </a>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={`nav-link ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveNav(item.id);
              }}
            >
              <span className="nav-icon">
                {item.id === 'dashboard' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                )}
                {item.id === 'subscriptions' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                )}
                {item.id === 'analytics' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><path d="M22 20H2"/></svg>
                )}
                {item.id === 'alerts' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                )}
                {item.id === 'payments' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                )}
              </span>
              {item.label}
              {item.id === 'alerts' && alertsCritical.length > 0 && (
                <span className="nav-badge">{alertsCritical.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="cmd-k-btn"
            onClick={() => setPaletteOpen(true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Quick search</span>
            <kbd>⌘K</kbd>
          </button>
          <button
            type="button"
            className={`nav-link ${activeNav === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('settings');
            }}
          >
            <span className="nav-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </span>
            Settings
          </button>

          <button
            type="button"
            className="user-sidebar-btn"
            onClick={(e) => {
              e.stopPropagation();
              setUserMenuOpen(!userMenuOpen);
            }}
          >
            <span className="user-avatar">{userInitials}</span>
            <div className="user-sidebar-info">
              <span className="user-name">{userDisplayName}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          </button>
          {userMenuOpen && (
            <div className="user-dropdown" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="dropdown-item danger" onClick={handleSignOut}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">

        {/* ════════════════════ DASHBOARD ════════════════════ */}
        {activeNav === 'dashboard' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Good morning, {userFirstName}</h1>
                <p className="page-sub">Here's your subscription overview for today.</p>
              </div>
              <button className="btn-primary" onClick={() => openDrawer()}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add subscription
              </button>
            </div>

            {/* KPI Row */}
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon-red">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{fmtCur(totals?.monthly_total_usd || 0)}</div>
                  <div className="kpi-label">Monthly spend</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon-yellow">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{fmtCur(totals?.yearly_total_usd || 0)}</div>
                  <div className="kpi-label">Annual total</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon-blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{activeSubCount}</div>
                  <div className="kpi-label">Active subscriptions</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className={`kpi-icon ${alertsCritical.length > 0 ? 'kpi-icon-red' : 'kpi-icon-green'}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{upcomingRenewalCount}</div>
                  <div className="kpi-label">Renewing this month</div>
                </div>
              </div>
            </div>

            {/* Main Grid */}
            <div className="dash-grid">
              {/* Col 1: Payment + Renewals */}
              <div className="dash-col">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Payment method</h3>
                    <button className="btn-ghost-sm" onClick={() => showToast('Payment method management coming soon!', 'success')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add card
                    </button>
                  </div>
                  <div className="credit-card">
                    <div className="cc-inner">
                      <div className="cc-top">
                        <div className="cc-chip"></div>
                        <svg className="cc-wifi" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                      </div>
                      <div className="cc-number">•••• •••• •••• 0000</div>
                      <div className="cc-bottom-row">
                        <div>
                          <div className="cc-label">Card holder</div>
                          <div className="cc-value">{userDisplayName}</div>
                        </div>
                        <div>
                          <div className="cc-label">Expires</div>
                          <div className="cc-value">00/00</div>
                        </div>
                        <div className="cc-brand">VISA</div>
                      </div>
                    </div>
                  </div>
                  <div className="spend-summary">
                    <div className="spend-row">
                      <span className="spend-label">Monthly spend</span>
                      <span className="spend-val">{fmtCur(totals?.monthly_total_usd || 0)}</span>
                    </div>
                    <div className="spend-row">
                      <span className="spend-label">Annual projection</span>
                      <span className="spend-val">{fmtCur(totals?.yearly_total_usd || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="card mt-card">
                  <div className="card-header">
                    <h3 className="card-title">Upcoming renewals</h3>
                    <button className="btn-link" onClick={() => setActiveNav('alerts')}>View all</button>
                  </div>
                  {alerts.length > 0 ? (
                    <div className="renewal-list">
                      {alerts.slice(0, 5).map(a => {
                        const urgency = renewalUrgency(a.next_renewal ?? a.date);
                        return (
                          <div
                            key={a.subscription_id}
                            className={`renewal-row ${urgency === 'critical' ? 'renewal-critical' : urgency === 'soon' ? 'renewal-soon' : ''}`}
                          >
                            <div className="renewal-avatar" style={{ background: `hsl(${(a.name?.charCodeAt(0) * 13 % 360)},60%,65%)` }}>
                              {(a.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="renewal-info">
                              <div className="renewal-name">{a.name}</div>
                              <div className="renewal-date">{fmtDateShort(a.next_renewal ?? a.date)}</div>
                            </div>
                            <div className="renewal-cost">{fmtCur(a.cost_usd || 0)}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state-sm">No upcoming renewals</div>
                  )}
                </div>
              </div>

              {/* Col 2: Spending Overview */}
              <div className="dash-col">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Monthly spending</h3>
                    <button className="btn-link" onClick={() => setActiveNav('analytics')}>View analytics</button>
                  </div>
                  <div className="big-metric">
                    <span className="big-currency">$</span>
                    <span className="big-amount">{Math.round(totals?.monthly_total_usd || 0)}</span>
                    <span className="big-label">this month</span>
                  </div>
                  {/* Mini bar chart */}
                  <div className="mini-bars">
                    {analyticsBarData.length > 0 ? (
                      analyticsBarData.map((item, idx) => (
                        <div className="mini-bar-col" key={item.label}>
                          <div className="mini-bar-wrap">
                            <div
                              className={`mini-bar ${idx === analyticsBarData.length - 1 ? 'mini-bar-active' : ''}`}
                              style={{ height: `${item.pct}%` }}
                            ></div>
                          </div>
                          <div className="mini-bar-label">{item.label}</div>
                        </div>
                      ))
                    ) : (
                      <div className="mini-bars-empty">No trend data yet</div>
                    )}
                  </div>
                </div>

                <div className="card mt-card">
                  <div className="card-header">
                    <h3 className="card-title">Annual projection</h3>
                    <span className="trend-up">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                      16.4%
                    </span>
                  </div>
                  <div className="projection-metric">{fmtCur(totals?.yearly_total_usd || 0)}</div>
                  <div className="line-chart">
                    <svg viewBox="0 0 200 70" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b1a1a" stopOpacity="0.15"/>
                          <stop offset="100%" stopColor="#8b1a1a" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d={`${projectedPath} L 200,70 L 0,70 Z`} fill="url(#lineGrad)"/>
                      <path d={projectedPath} fill="none" stroke="#8b1a1a" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Col 3: Category Donut + Top Sub */}
              <div className="dash-col">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">By category</h3>
                  </div>
                  <div className="donut-wrap">
                    <div className="donut-chart-wrap">
                      <svg viewBox="0 0 100 100" className="donut-svg">
                        {donutSegments.map((seg: any, i: number) => (
                          <path key={seg.name + i} d={seg.path} fill="none" stroke={seg.color} strokeWidth="10" strokeLinecap="round"/>
                        ))}
                      </svg>
                      <div className="donut-center-label">
                        <div className="donut-total">{fmtCur(totals?.monthly_total_usd || 0)}</div>
                        <div className="donut-sub">total</div>
                      </div>
                    </div>
                    <div className="donut-legend">
                      {donutSegments.map((seg: any, i: number) => (
                        <div className="legend-row" key={seg.name + i}>
                          <span className="legend-dot" style={{ background: seg.color }}></span>
                          <span className="legend-name">{seg.name}</span>
                          {seg.pct > 0 && <span className="legend-pct">{seg.pct}%</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card mt-card card-accent">
                  <div className="card-header">
                    <h3 className="card-title card-title-white">Top subscription</h3>
                    <button className="btn-link-white" onClick={() => setActiveNav('subscriptions')}>View all</button>
                  </div>
                  <div className="top-sub-val">{fmtCur(mostExpensiveSubscription?.cost_usd || 0)}</div>
                  <div className="top-sub-name">{mostExpensiveSubscription?.name || 'None added yet'}</div>
                  <div className="top-sub-chart">
                    <svg viewBox="0 0 200 60" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                      <path d={topSubPath} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="5,3"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════ SUBSCRIPTIONS ════════════════════ */}
        {activeNav === 'subscriptions' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Subscriptions</h1>
                <p className="page-sub">{subsTotal} subscription{subsTotal !== 1 ? 's' : ''} tracked</p>
              </div>
              <button className="btn-primary" onClick={() => openDrawer()}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add subscription
              </button>
            </div>

            <div className="card">
              <div className="table-toolbar">
                <div className="search-box">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search subscriptions…"
                  />
                  {searchQuery && (
                    <button className="search-clear-btn" onClick={() => setSearchQuery('')} title="Clear search">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
                <div className="toolbar-right">
                  <div className="sort-controls">
                    <span className="sort-label">Sort:</span>
                    {(['renewal', 'cost', 'name'] as const).map(s => (
                      <button
                        key={s}
                        className={`sort-btn ${sortBy === s ? 'sort-btn-active' : ''}`}
                        onClick={() => setSortBy(s)}
                      >
                        {s === 'renewal' ? 'Renewal' : s === 'cost' ? 'Cost' : 'Name'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {allCategories.length > 0 && (
                <div className="filter-chips">
                  <button
                    className={`filter-chip ${filterCategory === '' ? 'filter-chip-active' : ''}`}
                    onClick={() => setFilterCategory('')}
                  >All</button>
                  {allCategories.map(cat => (
                    <button
                      key={cat}
                      className={`filter-chip ${filterCategory === cat ? 'filter-chip-active' : ''}`}
                      onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
                    >
                      {categoryIcon(cat)} {cat}
                    </button>
                  ))}
                </div>
              )}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Next renewal</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map(sub => {
                      const urgency = renewalUrgency(sub.next_renewal);
                      return (
                        <tr className="table-row" key={sub.id}>
                          <td>
                            <div className="sub-name-cell">
                              <div className="sub-avatar" style={{ background: `hsl(${(sub.name?.charCodeAt(0) * 13 % 360)},55%,60%)` }}>
                                {(sub.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="sub-name">{highlightMatch(sub.name, searchQuery)}</div>
                                <div className="sub-vendor">{sub.vendor || sub.name}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`cat-badge ${categoryClass(sub.category)}`}>
                              {categoryIcon(sub.category)} {sub.category || 'Other'}
                            </span>
                          </td>
                          <td className="sub-cost">{fmtCur(sub.cost_usd)}<span className="cost-period">/mo</span></td>
                          <td>
                            <span className={`renewal-chip ${urgency === 'critical' ? 'renewal-chip-critical' : urgency === 'soon' ? 'renewal-chip-soon' : ''}`}>
                              {fmtDate(sub.next_renewal)}
                            </span>
                          </td>
                          <td>
                            <span className={`status-dot ${(!sub.status || sub.status === 'active') ? 'status-active' : 'status-inactive'}`}>
                              {sub.status || 'Active'}
                            </span>
                          </td>
                          <td className="row-actions">
                            <button className="action-btn" title="Edit" onClick={() => openDrawer(sub)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              className="action-btn action-btn-danger"
                              title="Delete"
                              onClick={(e) => deleteSub(sub.id, sub.name, e)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSubs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">
                          <div className="empty-state">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            <p>No subscriptions found. Add your first one!</p>
                            <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => openDrawer()}>Add subscription</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════ ANALYTICS ════════════════════ */}
        {activeNav === 'analytics' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Analytics</h1>
                <p className="page-sub">Spending trends and category breakdown</p>
              </div>
            </div>

            <div className="analytics-kpi-row">
              <div className="analytics-kpi">
                <div className="a-kpi-label">Monthly average</div>
                <div className="a-kpi-value">{fmtCur((totals?.yearly_total_usd || 0) / 12)}</div>
              </div>
              <div className="analytics-kpi">
                <div className="a-kpi-label">Highest month</div>
                <div className="a-kpi-value">{fmtCur(maxSpend)}</div>
              </div>
              <div className="analytics-kpi">
                <div className="a-kpi-label">Categories tracked</div>
                <div className="a-kpi-value">{categoryBreakdown.length}</div>
              </div>
              <div className="analytics-kpi">
                <div className="a-kpi-label">Active services</div>
                <div className="a-kpi-value">{activeSubCount}</div>
              </div>
            </div>

            <div className="analytics-grid">
              <div className="card analytics-chart-card">
                <div className="card-header">
                  <h3 className="card-title">Monthly spend trend</h3>
                </div>
                {analyticsBarData.length > 0 ? (
                  <div className="bar-chart">
                    {analyticsBarData.map((item, idx) => (
                      <div className="bar-col" key={item.label}>
                        <div className="bar-amount">{fmtCur(item.value)}</div>
                        <div className="bar-track">
                          <div
                            className={`bar-fill ${idx === analyticsBarData.length - 1 ? 'bar-fill-active' : ''}`}
                            style={{ height: `${item.pct}%` }}
                          ></div>
                        </div>
                        <div className="bar-month">{item.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '3rem 0' }}>
                    <p>No spend trend data available yet. Add subscriptions to see trends.</p>
                  </div>
                )}
              </div>

              <div className="card analytics-donut-card">
                <div className="card-header">
                  <h3 className="card-title">Spend by category</h3>
                </div>
                <div className="donut-wrap donut-wrap-lg">
                  <div className="donut-chart-wrap donut-lg">
                    <svg viewBox="0 0 100 100" className="donut-svg">
                      {donutSegments.map((seg: any, i: number) => (
                        <path key={seg.name + i} d={seg.path} fill="none" stroke={seg.color} strokeWidth="10" strokeLinecap="round"/>
                      ))}
                    </svg>
                    <div className="donut-center-label">
                      <div className="donut-total">{fmtCur(totals?.monthly_total_usd || 0)}</div>
                      <div className="donut-sub">/ month</div>
                    </div>
                  </div>
                  <div className="donut-legend donut-legend-lg">
                    {donutSegments.map((seg: any, i: number) => (
                      <div className="legend-row-lg" key={seg.name + i}>
                        <div className="legend-left">
                          <span className="legend-dot" style={{ background: seg.color }}></span>
                          <span className="legend-name-lg">{seg.name}</span>
                        </div>
                        {seg.pct > 0 && <span className="legend-pct-lg">{seg.pct}%</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Category Breakdown Table */}
            {categoryBreakdown.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Category breakdown</h3>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Category</th><th>Monthly</th><th>Annual estimate</th><th>Share</th></tr>
                    </thead>
                    <tbody>
                      {categoryBreakdown.map((cat: any) => (
                        <tr className="table-row" key={cat.category}>
                          <td><span className={`cat-badge ${categoryClass(cat.category)}`}>{categoryIcon(cat.category)} {cat.category}</span></td>
                          <td className="sub-cost">{fmtCur(cat.monthly_usd)}</td>
                          <td className="sub-cost">{fmtCur((cat.monthly_usd || 0) * 12)}</td>
                          <td>
                            <div className="share-bar-wrap">
                              <div className="share-bar" style={{ width: `${(cat.monthly_usd / (totals?.monthly_total_usd || 1)) * 100}%` }}></div>
                              <span className="share-pct">{Math.round((cat.monthly_usd / (totals?.monthly_total_usd || 1)) * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════ ALERTS ════════════════════ */}
        {activeNav === 'alerts' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Alerts</h1>
                <p className="page-sub">Upcoming renewals and price changes</p>
              </div>
            </div>

            {alertsCritical.length > 0 && (
              <div className="alerts-section">
                <div className="alerts-section-header">
                  <span className="alert-section-dot alert-dot-critical"></span>
                  <h3 className="alerts-section-title">Critical — renewing within 3 days</h3>
                </div>
                <div className="alerts-list">
                  {alertsCritical.map(a => (
                    <div className="alert-card alert-critical" key={a.subscription_id}>
                      <div className="alert-avatar" style={{ background: `hsl(${(a.name?.charCodeAt(0) * 13 % 360)},60%,65%)` }}>
                        {(a.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="alert-info">
                        <div className="alert-name">{a.name}</div>
                        <div className="alert-meta">Renews {fmtDate(a.next_renewal ?? a.date)} · {daysUntilRenewal(a.next_renewal ?? a.date)} day(s) left</div>
                      </div>
                      <div className="alert-cost">{fmtCur(a.cost_usd || 0)}</div>
                      <button className="btn-ghost-sm" onClick={() => openDrawer(a)}>Manage</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alertsSoon.length > 0 && (
              <div className="alerts-section">
                <div className="alerts-section-header">
                  <span className="alert-section-dot alert-dot-soon"></span>
                  <h3 className="alerts-section-title">Soon — renewing within 7 days</h3>
                </div>
                <div className="alerts-list">
                  {alertsSoon.map(a => (
                    <div className="alert-card alert-soon" key={a.subscription_id}>
                      <div className="alert-avatar" style={{ background: `hsl(${(a.name?.charCodeAt(0) * 13 % 360)},60%,65%)` }}>
                        {(a.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="alert-info">
                        <div className="alert-name">{a.name}</div>
                        <div className="alert-meta">Renews {fmtDate(a.next_renewal ?? a.date)} · {daysUntilRenewal(a.next_renewal ?? a.date)} days</div>
                      </div>
                      <div className="alert-cost">{fmtCur(a.cost_usd || 0)}</div>
                      <button className="btn-ghost-sm" onClick={() => openDrawer(a)}>Manage</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alertsUpcoming.length > 0 && (
              <div className="alerts-section">
                <div className="alerts-section-header">
                  <span className="alert-section-dot alert-dot-normal"></span>
                  <h3 className="alerts-section-title">Upcoming — next 30 days</h3>
                </div>
                <div className="alerts-list">
                  {alertsUpcoming.map(a => (
                    <div className="alert-card" key={a.subscription_id}>
                      <div className="alert-avatar" style={{ background: `hsl(${(a.name?.charCodeAt(0) * 13 % 360)},60%,65%)` }}>
                        {(a.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="alert-info">
                        <div className="alert-name">{a.name}</div>
                        <div className="alert-meta">Renews {fmtDate(a.next_renewal ?? a.date)} · {daysUntilRenewal(a.next_renewal ?? a.date)} days</div>
                      </div>
                      <div className="alert-cost">{fmtCur(a.cost_usd || 0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alerts.length === 0 && (
              <div className="empty-state-full">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <h3>All clear!</h3>
                <p>No upcoming renewals right now.</p>
              </div>
            )}
          </>
        )}

        {/* ════════════════════ PAYMENTS ════════════════════ */}
        {activeNav === 'payments' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Payments</h1>
                <p className="page-sub">Recent billing history</p>
              </div>
            </div>

            <div className="kpi-row" style={{ marginBottom: '1.5rem' }}>
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon-green">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{paymentsSucceeded.length}</div>
                  <div className="kpi-label">Successful payments</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon-red">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{paymentsFailed.length}</div>
                  <div className="kpi-label">Failed payments</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon-blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{fmtCur(paymentsTotal)}</div>
                  <div className="kpi-label">Total processed</div>
                </div>
              </div>
            </div>

            <div className="card">
              {paymentsLoading ? (
                <div style={{ padding: '2rem' }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 44, marginBottom: 10, borderRadius: 8 }} />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem 0' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <p>No payment history yet.</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Payments appear automatically as subscriptions renew.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Service</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr className="table-row" key={p.id}>
                          <td>
                            <div className="sub-name-cell">
                              <div className="sub-avatar" style={{ background: `hsl(${(p.name?.charCodeAt(0) * 13 % 360)},55%,60%)` }}>{(p.name||'?').charAt(0).toUpperCase()}</div>
                              <span className="sub-name">{p.name}</span>
                            </div>
                          </td>
                          <td><span className={`cat-badge ${categoryClass(p.category)}`}>{categoryIcon(p.category)} {p.category}</span></td>
                          <td className="sub-cost">{fmtCur(p.cost_usd)}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{fmtDate(p.date)}</td>
                          <td>
                            <span className={`payment-status ${p.status === 'paid' ? 'status-paid' : 'status-failed'}`}>
                              {p.status === 'paid' ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              )}
                              {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}


        {/* ════════════════════ SETTINGS ════════════════════ */}
        {activeNav === 'settings' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Settings</h1>
                <p className="page-sub">Manage your account preferences</p>
              </div>
            </div>

            <div className="settings-grid">
              <div className="card settings-card">
                <h3 className="settings-section-title">Profile</h3>
                <div className="settings-field">
                  <label className="settings-label">Display name</label>
                  <input
                    type="text"
                    className="settings-input"
                    value={settingsForm.displayName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, displayName: e.target.value })}
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Email</label>
                  <input type="email" className="settings-input" value={user?.email || ''} disabled />
                </div>
              </div>

              <div className="card settings-card">
                <h3 className="settings-section-title">Preferences</h3>
                <div className="settings-field">
                  <label className="settings-label">Default currency</label>
                  <select
                    className="settings-input"
                    value={settingsForm.defaultCurrency}
                    onChange={(e) => setSettingsForm({ ...settingsForm, defaultCurrency: e.target.value })}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="AUD">AUD (A$)</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label className="settings-label">Renewal reminder (days before)</label>
                  <select
                    className="settings-input"
                    value={settingsForm.reminderDays}
                    onChange={(e) => setSettingsForm({ ...settingsForm, reminderDays: parseInt(e.target.value) })}
                  >
                    <option value={3}>3 days</option>
                    <option value={5}>5 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                  </select>
                </div>
              </div>

              <div className="card settings-card">
                <h3 className="settings-section-title">Notifications</h3>
                <div className="settings-toggle-row">
                  <div>
                    <div className="settings-toggle-label">Email before renewals</div>
                    <div className="settings-toggle-desc">Get notified before each subscription renews</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settingsForm.alertsRenewal}
                      onChange={(e) => setSettingsForm({ ...settingsForm, alertsRenewal: e.target.checked })}
                    />
                    <span className="toggle-track"></span>
                  </label>
                </div>
                <div className="settings-toggle-row">
                  <div>
                    <div className="settings-toggle-label">Weekly summary</div>
                    <div className="settings-toggle-desc">Receive a weekly digest of your subscription activity</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settingsForm.alertsWeekly}
                      onChange={(e) => setSettingsForm({ ...settingsForm, alertsWeekly: e.target.checked })}
                    />
                    <span className="toggle-track"></span>
                  </label>
                </div>
              </div>

              <div className="settings-save-row">
                <button className="btn-primary" onClick={() => showToast('Settings saved!', 'success')}>Save changes</button>
              </div>
            </div>
          </>
        )}

      </main>

      {/* ── Undo Delete Toast ── */}
      {undoToast && (
        <div className="toast toast-undo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          <span>Deleted <strong>{undoToast.name}</strong></span>
          <button className="toast-undo-btn" onClick={() => undoDelete(undoToast.id)}>Undo</button>
        </div>
      )}

      {/* ── Regular Toast ── */}
      {toastMessage && (
        <div className={`toast ${toastType === 'error' ? 'toast-error' : ''}`}>
          {toastType === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          )}
          {toastMessage}
        </div>
      )}

      {/* ── Cmd+K Palette ── */}
      {paletteOpen && (
        <div className="palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="palette-panel" onClick={e => e.stopPropagation()}>
            <div className="palette-search-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={paletteInputRef}
                className="palette-input"
                placeholder="Search or run a command…"
                value={paletteQuery}
                onChange={e => setPaletteQuery(e.target.value)}
              />
              <kbd className="palette-esc">Esc</kbd>
            </div>
            <div className="palette-results">
              {paletteResults.length === 0 && (
                <div className="palette-empty">No results</div>
              )}
              {paletteResults.map((r, i) => (
                <button
                  key={r.id + i}
                  className={`palette-item palette-item-${r.type}`}
                  onClick={() => {
                    if (r.type === 'nav') { setActiveNav(r.id as NavId); setPaletteOpen(false); }
                    else if (r.type === 'action') { openDrawer(); setPaletteOpen(false); }
                    else if (r.type === 'sub') { openDrawer(subscriptions.find(s => s.id === r.id)); setPaletteOpen(false); }
                  }}
                >
                  <span className="palette-item-label">{r.label}</span>
                  {r.sub && <span className="palette-item-sub">{r.sub}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Subscription Drawer ── */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={closeDrawer}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-top">
              <div className="drawer-progress">
                <div className="drawer-progress-bar" style={{ width: `${(currentStep / 4) * 100}%` }}></div>
              </div>
              <div className="drawer-step-dots">
                {[1,2,3,4].map(s => (
                  <span key={s} className={`drawer-dot ${currentStep === s ? 'drawer-dot-active' : currentStep > s ? 'drawer-dot-done' : ''}`} />
                ))}
              </div>
              <button className="drawer-close" onClick={closeDrawer}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="drawer-form">
              {currentStep === 1 && (
                <div className="drawer-step">
                  <div className="step-label">STEP 1 OF 4</div>
                  <h2 className="drawer-heading">What subscription is this?</h2>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="drawer-input"
                      placeholder="e.g. Netflix, Spotify, AWS…"
                      value={newSubForm.name}
                      onChange={(e) => filterCompanies(e.target.value)}
                      onFocus={() => {
                        filterCompanies(newSubForm.name);
                        setShowCompanySuggestions(true);
                      }}
                      onBlur={hideCompanySuggestions}
                    />
                    {showCompanySuggestions && filteredCompanies.length > 0 && (
                      <div className="company-dropdown">
                        {filteredCompanies.map(company => (
                          <div
                            className="company-option"
                            key={company.name}
                            onMouseDown={() => selectCompany(company)}
                          >
                            {company.logo ? (
                              <img src={company.logo} className="company-logo-img" alt="" />
                            ) : (
                              <div className="company-logo-fallback">{company.name.charAt(0)}</div>
                            )}
                            <div>
                              <div className="company-name">{company.name}</div>
                              {company.domain && <div className="company-domain">{company.domain}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="drawer-step">
                  <div className="step-label">STEP 2 OF 4</div>
                  <h2 className="drawer-heading">How much does it cost per month?</h2>
                  <div className="amount-input-wrap">
                    <span className="amount-symbol">$</span>
                    <input
                      type="number"
                      className="drawer-input amount-input"
                      placeholder="0.00"
                      value={newSubForm.cost_usd}
                      onChange={(e) => setNewSubForm({ ...newSubForm, cost_usd: e.target.value })}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="drawer-step">
                  <div className="step-label">STEP 3 OF 4</div>
                  <h2 className="drawer-heading">Select a category</h2>
                  <div className="category-grid">
                    {[
                      { v: 'entertainment', l: 'Entertainment', e: '🎬' },
                      { v: 'productivity', l: 'Productivity', e: '⚡' },
                      { v: 'utilities', l: 'Utilities', e: '🔧' },
                      { v: 'cloud_services', l: 'Cloud Services', e: '☁️' },
                      { v: 'design', l: 'Design', e: '🎨' },
                      { v: 'development', l: 'Development', e: '💻' },
                      { v: 'communication', l: 'Communication', e: '💬' },
                      { v: 'finance', l: 'Finance', e: '💰' },
                      { v: 'marketing', l: 'Marketing', e: '📢' },
                      { v: 'hr_payroll', l: 'HR & Payroll', e: '👥' },
                      { v: 'operations', l: 'Operations', e: '🏗️' },
                      { v: 'other', l: 'Other', e: '📦' }
                    ].map(cat => (
                      <button
                        key={cat.v}
                        type="button"
                        className={`cat-chip ${newSubForm.category === cat.v ? 'cat-chip-active' : ''}`}
                        onClick={() => setNewSubForm({ ...newSubForm, category: cat.v })}
                      >
                        {cat.e} {cat.l}
                      </button>
                    ))}
                  </div>
                  {newSubForm.category === 'other' && (
                    <input
                      type="text"
                      className="drawer-input"
                      style={{ marginTop: '1rem' }}
                      placeholder="Custom category name…"
                      value={newSubForm.customCategory}
                      onChange={(e) => setNewSubForm({ ...newSubForm, customCategory: e.target.value })}
                    />
                  )}
                </div>
              )}

              {currentStep === 4 && (
                <div className="drawer-step" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="step-label">STEP 4 OF 4</div>
                  <h2 className="drawer-heading">When does it renew?</h2>
                  <div className="cal-wrap">
                    <div className="cal-header">
                      <button type="button" className="cal-nav-btn" onClick={prevMonth}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      <span className="cal-month">{currentMonthName}</span>
                      <button type="button" className="cal-nav-btn" onClick={nextMonth}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>
                    <div className="cal-weekdays">
                      {weekDays.map(d => <div className="cal-weekday" key={d}>{d}</div>)}
                    </div>
                    <div className="cal-grid">
                      {calendarDays.map((d: any, i: number) => (
                        <button
                          key={d.date.toISOString() + i}
                          type="button"
                          className={`cal-day ${!d.isCurrentMonth ? 'cal-other-month' : ''} ${d.today ? 'cal-today' : ''} ${(d.isStart || d.isEnd) ? 'cal-selected' : ''} ${d.inRange ? 'cal-in-range' : ''}`}
                          onClick={(e) => selectDate(d.date, e)}
                        >
                          {d.formatted}
                        </button>
                      ))}
                    </div>
                    {selectedStartDate && (
                      <div className="cal-selection">
                        Selected: <strong>{selectedStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                        {selectedEndDate && (
                          <>
                            {' '}to{' '}
                            <strong>{selectedEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                          </>
                        )}
                        <button type="button" className="btn-link" onClick={cancelDates} style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>Clear</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="drawer-footer">
                {currentStep > 1 && (
                  <button type="button" className="btn-back" onClick={prevStep}>← Back</button>
                )}
                {currentStep < 4 ? (
                  <button
                    type="button"
                    className="btn-primary drawer-next"
                    onClick={nextStep}
                    disabled={currentStep === 1 && !newSubForm.name}
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn-primary drawer-next"
                    disabled={submitting || !selectedStartDate}
                    onClick={saveSubscription}
                  >
                    {submitting ? 'Saving…' : (selectedSub ? 'Update subscription' : 'Add subscription')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

const navItems: { id: NavId; label: string }[] = [
  { id: 'dashboard',     label: 'Dashboard' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'analytics',     label: 'Analytics' },
  { id: 'alerts',        label: 'Alerts' },
  { id: 'payments',      label: 'Payments' },
];
