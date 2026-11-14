// Data kept by the agent (DESIGN.md, Data).

export type SystemKind = 'booking_system' | 'payment_provider' | 'other';
export type KnownSystem = { name: string; kind: SystemKind; domain_patterns: string[] };

export type PaymentDetails = { reference: string | null; dates: string | null; place: string | null };

export type MapEntry = {
  company: string;
  domain: string;
  systems: { name: string; kind: SystemKind }[];
  logo_hashes: string[];
  payment_details: PaymentDetails[];
  first_paid_at: string;
  last_paid_at: string;
};

export type Incident = {
  target: string;
  article: { url: string; title: string; source: string; published_at: string };
  detected_at: string;
};

export type Level = 'L0' | 'L1' | 'L2' | 'L3';
export type Outcome = 'pass' | 'pass_with_alert' | 'alert';

export type CheckResult = {
  domain: string;
  ended_at: Level;
  outcome: Outcome;
  company: string | null;
  checked_at: string;
};

/** Signals the content script collects for L2. */
export type PageSignals = {
  title: string;
  siteName: string | null;
  nearText: string; // text around the payment form
  pageText: string; // visible text of the page, truncated
  logoHashes: string[];
};
