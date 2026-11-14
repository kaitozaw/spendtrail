// Model evaluation page: chrome-extension://<id>/eval.html
// Runs each candidate on the evaluation cases with the same prompts and runtime as the extension.
import cases from '../../../eval/cases.json';
import holdout from '../../../eval/holdout.json';
import { log } from '../../lib/log';
import { Model, modelSizeMb } from '../../lib/model';
import { nameMatches } from '../../lib/names';
import type { ArticleInput, PageInput } from '../../lib/prompts';

const CANDIDATES = [
  'SmolLM2-135M-Instruct-q0f16-MLC',
  'SmolLM2-360M-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
];

type Case<T> = { id: string; expected: 'yes' | 'no'; input: T };
// The page cases are the default: the news check uses rules only (eval/run-news-rules.mts).
// ?only=articles runs the earlier model-based article experiment. ?set=holdout runs the held-out page cases.
const params = new URLSearchParams(location.search);
const ONLY = params.get('only') === 'articles' && params.get('set') !== 'holdout' ? 'articles' : 'pages';
const articles = ONLY === 'pages' ? [] : (cases.articles as Case<ArticleInput>[]);
const pages =
  ONLY === 'articles' ? [] : ((params.get('set') === 'holdout' ? holdout.pages : cases.pages) as Case<PageInput>[]);

const $ = (id: string) => document.getElementById(id)!;
const status = (t: string) => ($('status').textContent = t);
const progress = (p: number) => (($('progress') as HTMLElement).style.width = `${Math.round(p * 100)}%`);
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
const short = (id: string) => id.replace(/-q\w+-MLC$/, '');

let running = false;
function lock(on: boolean) {
  running = on;
  document.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = on));
}

async function evaluate(modelId: string): Promise<boolean> {
  const name = short(modelId);
  status(`${name}: loading…`);
  const t0 = performance.now();
  const model = await Model.load(modelId, (text, p) => {
    status(`${name}: ${text}`);
    progress(p);
  });
  const loadMs = performance.now() - t0;
  log('model', `eval ${name}: loaded in ${(loadMs / 1000).toFixed(1)} s (${Math.round(modelSizeMb(modelId))} MB)`);

  const times: number[] = [];
  let articleOk = 0;
  let pageOk = 0;
  // The model extracts names; the rule in names.ts turns them into the yes/no verdict.
  const judge = async (question: 'article_breach' | 'page_impersonation', input: ArticleInput | PageInput) => {
    if (question === 'article_breach') {
      const a = input as ArticleInput;
      const { breached = [] } = await model.extract('article_breached', a);
      return { verdict: breached.some((n) => nameMatches(a.name, n)) ? 'yes' : 'no', extracted: JSON.stringify(breached) };
    }
    const p = input as PageInput;
    const { payee = '' } = await model.extract('page_payee', p);
    return { verdict: nameMatches(p.company, payee) ? 'yes' : 'no', extracted: JSON.stringify(payee) };
  };

  const run = async <T>(question: 'article_breach' | 'page_impersonation', list: Case<T>[]) => {
    for (const c of list) {
      status(`${name}: ${question} ${c.id}`);
      const t = performance.now();
      let verdict: string;
      let extracted = '';
      try {
        ({ verdict, extracted } = await judge(question, c.input as ArticleInput | PageInput));
      } catch (e) {
        verdict = `error: ${(e as Error).message}`;
      }
      times.push(performance.now() - t);
      if (verdict === c.expected) question === 'article_breach' ? articleOk++ : pageOk++;
      else
        $('mistakes').insertAdjacentHTML(
          'beforeend',
          `<tr><td>${name}</td><td><code>${question}</code></td><td><code>${c.id}</code></td><td>${c.expected}</td><td class="ng">${verdict}</td><td><code>${extracted}</code></td></tr>`,
        );
    }
  };
  await run('article_breach', articles);
  await run('page_impersonation', pages);
  await model.unload();

  const passed = articleOk === articles.length && pageOk === pages.length;
  const med = median(times);
  $('summary').insertAdjacentHTML(
    'beforeend',
    `<tr><td><code>${name}</code></td><td>${Math.round(modelSizeMb(modelId))} MB</td><td>${(loadMs / 1000).toFixed(1)} s</td>` +
      `<td class="${articleOk === articles.length ? 'ok' : 'ng'}">${articleOk}/${articles.length}</td>` +
      `<td class="${pageOk === pages.length ? 'ok' : 'ng'}">${pageOk}/${pages.length}</td>` +
      `<td>${Math.round(med)} ms</td><td class="${passed ? 'ok' : 'ng'}">${passed ? 'pass' : 'fail'}</td></tr>`,
  );
  log(
    'model',
    `eval ${name}: articles ${articleOk}/${articles.length}, pages ${pageOk}/${pages.length}, median ${Math.round(med)} ms per answer → ${passed ? 'PASS' : 'fail'}`,
  );
  status(`${name}: done.`);
  return passed;
}

const buttons = $('buttons');
for (const id of CANDIDATES) {
  const b = document.createElement('button');
  b.textContent = `${short(id)} (${Math.round(modelSizeMb(id))} MB)`;
  b.onclick = async () => {
    if (running) return;
    lock(true);
    try {
      await evaluate(id);
    } catch (e) {
      status(`${short(id)} failed: ${(e as Error).message}`);
    }
    lock(false);
  };
  buttons.appendChild(b);
}
const all = document.createElement('button');
all.textContent = 'Run all until one passes';
all.onclick = async () => {
  if (running) return;
  lock(true);
  for (const id of CANDIDATES) {
    try {
      if (await evaluate(id)) {
        status(`Smallest passing model: ${short(id)}`);
        log('model', `eval: smallest passing model is ${short(id)}`);
        break;
      }
    } catch (e) {
      status(`${short(id)} failed: ${(e as Error).message}`);
    }
  }
  lock(false);
};
buttons.appendChild(all);
