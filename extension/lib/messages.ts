// Messages between the content script, the service worker, the offscreen document and the popup.
import type { PageInput } from './prompts';
import type { AlertInfo, BannerInfo } from './ui';
import type { PageSignals, PaymentDetails } from './types';

export type PageDetails = PaymentDetails;

/** Content script → service worker when a page opens. The reply says whether L0 passed. */
export type PageOpened = { type: 'page-opened'; url: string; domain: string };
export type PageOpenedReply = { watch: boolean; capture: boolean; banner?: BannerInfo };

/** L1 found no payment field on a page that L0 did not pass. */
export type NoPaymentField = { type: 'no-payment-field'; domain: string };

/** L1 found a payment field: the service worker runs L2 and L3. The reply says whether to alert. */
export type PaymentField = { type: 'payment-field'; domain: string; signals: PageSignals };
export type PaymentFieldReply = { outcome: 'pass' | 'alert'; alert?: AlertInfo };

/** The user submitted a form with a payment field (P1). */
export type PaymentSubmitted = { type: 'payment-submitted'; domain: string; company: string; hosts: string[]; logoHashes: string[] };

/** Payment details read from the page after the payment (P1). */
export type PaymentDetailsFound = { type: 'payment-details'; domain: string; details: PageDetails };

export type CheckNow = { type: 'check-now' };
export type ClearData = { type: 'clear-data' };

export type ToServiceWorker =
  | PageOpened
  | NoPaymentField
  | PaymentField
  | PaymentSubmitted
  | PaymentDetailsFound
  | CheckNow
  | ClearData;

export type OffscreenPing = { target: 'offscreen'; type: 'ping' };
/** Loads the model, extracts the business taking the payment, and unloads the model. */
export type OffscreenExtractPayee = { target: 'offscreen'; type: 'extract-payee'; modelId: string; input: PageInput };
/** Downloads the model once, so the first check does not wait for the download. */
export type OffscreenPrepare = { target: 'offscreen'; type: 'prepare'; modelId: string };
export type ToOffscreen = OffscreenPing | OffscreenExtractPayee | OffscreenPrepare;
export type OffscreenReply = { ok: boolean; payee?: string; error?: string; loadMs?: number; answerMs?: number; downloaded?: boolean };
