// The model only extracts names from text. Rules (names.ts) make the decisions.
// The same prompts are used by the evaluation and by the extension.

export type Task = 'article_breached' | 'page_payee';

export type ArticleInput = { name: string; title: string; sentences: string[] };
export type PageInput = { company: string; domain: string; title: string; text: string };

export const SCHEMAS: Record<Task, string> = {
  article_breached: JSON.stringify({
    type: 'object',
    properties: { breached: { type: 'array', items: { type: 'string' }, maxItems: 3 } },
    required: ['breached'],
  }),
  page_payee: JSON.stringify({
    type: 'object',
    properties: { payee: { type: 'string', maxLength: 60 } },
    required: ['payee'],
  }),
};

// Worked examples for the page task. They use businesses that do not appear in the evaluation cases.
export const EXAMPLES: Partial<Record<Task, { user: string; assistant: string }[]>> = {
  page_payee: [
    {
      user: 'Page title: Checkout – TripLane\nPage text:\nTripLane. You are booking Sunrise Lodge, Noosa, through TripLane. TripLane takes the payment. Card number. Expiry. CVC. Pay $410.00.',
      assistant: '{"payee": "TripLane"}',
    },
    {
      user: 'Page title: Order – Bluegum Cafe\nPage text:\nBluegum Cafe online order. Two flat whites and a banana bread. Secured by Stripe. Card number. Expiry. CVC. Pay $18.50.',
      assistant: '{"payee": "Bluegum Cafe"}',
    },
    {
      user: 'Page title: Payment failed\nPage text:\nRiverbend Motel. The payment for your booking has failed. Enter your card again to keep your room. Card number. Expiry. CVC. Confirm.',
      assistant: '{"payee": "Riverbend Motel"}',
    },
    {
      user: 'Page title: Tickets – Noosa Jazz Festival\nPage text:\nNoosa Jazz Festival 2027. Day pass $89. Hotel partner: Sunrise Lodge offers guests a late checkout. Card number. Expiry. CVC. Buy tickets.',
      assistant: '{"payee": "Noosa Jazz Festival"}',
    },
  ],
};

const ARTICLE_SYSTEM = `You read news about cyber security and extract names.
List the companies, organisations or systems that the text says were themselves breached, hacked, compromised, or had a security incident.
Write each name exactly as it appears in the text. Do not list companies that were only affected through another company, not affected, or only mentioned.
If no company is said to be breached, return an empty list.`;

const PAGE_SYSTEM = `You read payment pages and extract one name: the business that is taking the payment.
Write the business name only, exactly as it appears on the page, in a few words.
If the page is a travel agent, marketplace, reseller, comparison site, review site or event, give that business's name, not the companies it sells or mentions.
Ignore payment providers shown as "Secured by" or "Powered by", and ignore partners.`;

export function buildPrompt(task: Task, input: ArticleInput | PageInput): { system: string; user: string } {
  if (task === 'article_breached') {
    const a = input as ArticleInput;
    return {
      system: ARTICLE_SYSTEM,
      user: `Title: ${a.title}\nText:\n${a.sentences.join('\n')}`,
    };
  }
  const p = input as PageInput;
  return {
    system: PAGE_SYSTEM,
    user: `Page title: ${p.title}\nPage text:\n${p.text}`,
  };
}
