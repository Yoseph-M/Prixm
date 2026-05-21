import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface FaqItem {
  question: string;
  answer: string;
  open: boolean;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent implements OnInit, AfterViewInit, OnDestroy {
  scrolled = false;
  currentYear = new Date().getFullYear();
  authService = inject(AuthService);
  user = this.authService.user;

  private observer: IntersectionObserver | null = null;

  faqs: FaqItem[] = [
    {
      question: 'What is Prixm?',
      answer:
        'Prixm is all-in-one subscription software that helps you track recurring payments, renewal dates, and spending across every service you use.',
      open: false,
    },
    {
      question: 'How does pricing work?',
      answer:
        'Start free with up to five subscriptions. Upgrade to Pro or Team when you need unlimited tracking, analytics, or shared workspaces.',
      open: false,
    },
    {
      question: 'Can I connect my existing accounts?',
      answer:
        'Yes. Add subscriptions manually or import from email. Bank connections are available on Pro and Team plans.',
      open: false,
    },
    {
      question: 'Are renewal alerts included in all plans?',
      answer:
        'Basic email reminders are included on Free. Pro and Team add smart alerts, calendar sync, and customizable lead times.',
      open: false,
    },
    {
      question: 'How long does setup take?',
      answer:
        'Most users add their first subscriptions and see a full dashboard in under two minutes.',
      open: false,
    },
  ];

  constructor(private host: ElementRef<HTMLElement>) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.scrolled = window.scrollY > 80;
  }

  ngOnInit() {
    this.onWindowScroll();
  }

  ngAfterViewInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    this.host.nativeElement
      .querySelectorAll('.reveal, .reveal-left, .reveal-right')
      .forEach((el) => this.observer?.observe(el));
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  toggleFaq(index: number) {
    this.faqs = this.faqs.map((faq, i) => ({
      ...faq,
      open: i === index ? !faq.open : false,
    }));
  }

  async handleSignOut() {
    await this.authService.signOut();
  }
}
