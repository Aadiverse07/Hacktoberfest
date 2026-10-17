'use client';

import { useEffect } from 'react';

const motionTargets = [
  '.lp-hero', '.lp-features', '.lp-trusted', '.lp-sec',
  '.page > .hero-row', '.page > .open-insights', '.page > .stats-grid', '.page > .dashboard-grid',
  '.page > .finance-toolbar', '.page > .journal-toolbar', '.page > .summary-grid',
  '.page > .journal-table-panel', '.page > section.panel', '.module-page > *',
  '.bank-page > section', '.assistant-insights-heading', '.assistant-metric-row',
  '.assistant-chart-card', '.assistant-message', '.open-demo > *',
].join(',');

/** Reversible, reduced-motion-aware scroll zoom and text reveal inspired by NovaPay's home motion. */
export function NovaPayScrollMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('finova-motion-visible', entry.isIntersecting));
    }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' });

    const scan = (root: ParentNode = document) => {
      const roots = root instanceof Element && root.matches(motionTargets) ? [root, ...root.querySelectorAll(motionTargets)] : [...root.querySelectorAll(motionTargets)];
      roots.forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        element.classList.add('finova-motion-target');
        const textNodes = element.querySelectorAll('h1, h2, h3, .hero-subtitle, .lp-eyebrow, .lp-sec-lead');
        textNodes.forEach((node, index) => (node as HTMLElement).style.setProperty('--finova-motion-delay', `${Math.min(index, 5) * 55}ms`));
        observer.observe(element);
      });
    };

    scan();
    const mutations = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) scan(node);
    })));
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => { mutations.disconnect(); observer.disconnect(); };
  }, []);

  return null;
}
