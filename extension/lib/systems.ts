// Matches the domains a page loads against the bundled list of known third-party systems.
import knownSystems from '../data/known-systems.json';
import type { KnownSystem, SystemKind } from './types';

const SYSTEMS = knownSystems as KnownSystem[];

export const KIND_LABEL: Record<SystemKind, string> = {
  booking_system: 'booking system',
  payment_provider: 'payment provider',
  other: 'platform',
};

export function systemsFromHosts(hosts: string[]): { name: string; kind: SystemKind }[] {
  const found = new Map<string, SystemKind>();
  for (const host of hosts) {
    for (const s of SYSTEMS) {
      if (s.domain_patterns.some((p) => host === p || host.endsWith(`.${p}`))) found.set(s.name, s.kind);
    }
  }
  return [...found].map(([name, kind]) => ({ name, kind }));
}
