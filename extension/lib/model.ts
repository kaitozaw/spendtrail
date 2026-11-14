// Runs the on-device model with WebLLM. Used inside the offscreen document and the evaluation page.
// The model is loaded only when asked, and unloaded by the caller straight after.
import { CreateMLCEngine, hasModelInCache, prebuiltAppConfig, type MLCEngine } from '@mlc-ai/web-llm';
import { buildPrompt, EXAMPLES, SCHEMAS, type ArticleInput, type PageInput, type Task } from './prompts';

export async function isModelCached(modelId: string): Promise<boolean> {
  return hasModelInCache(modelId);
}

export function modelSizeMb(modelId: string): number {
  return prebuiltAppConfig.model_list.find((m) => m.model_id === modelId)?.vram_required_MB ?? 0;
}

export class Model {
  private constructor(
    private engine: MLCEngine,
    readonly id: string,
  ) {}

  static async load(modelId: string, onProgress?: (text: string, progress: number) => void): Promise<Model> {
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (r) => onProgress?.(r.text, r.progress),
    });
    return new Model(engine, modelId);
  }

  /** Extracts names. The output is constrained to the task's JSON schema. */
  async extract(task: 'article_breached', input: ArticleInput): Promise<{ breached: string[] }>;
  async extract(task: 'page_payee', input: PageInput): Promise<{ payee: string }>;
  async extract(task: Task, input: ArticleInput | PageInput): Promise<unknown> {
    const { system, user } = buildPrompt(task, input);
    const examples = (EXAMPLES[task] ?? []).flatMap((e) => [
      { role: 'user' as const, content: e.user },
      { role: 'assistant' as const, content: e.assistant },
    ]);
    const reply = await this.engine.chat.completions.create({
      messages: [{ role: 'system', content: system }, ...examples, { role: 'user', content: user }],
      temperature: 0,
      max_tokens: 48,
      response_format: { type: 'json_object', schema: SCHEMAS[task] },
    });
    return JSON.parse(reply.choices[0]?.message.content ?? '{}');
  }

  async unload() {
    await this.engine.unload();
  }
}
