'use client';
import type { Workspace } from '@/lib/assistant/engine';
export function forecastUsesLiveClientData() { return true; }
export function workspaceFromStore(s: Workspace): Workspace { return { accounts: s.accounts, entries: s.entries, invoices: s.invoices, expenses: s.expenses }; }
