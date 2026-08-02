import type { AnalysisProvider, AnalysisRequest, AnalyzedMoment } from "../providers/types";

export const ANALYSIS_PROVIDERS = {
  openai: { requiredEnv: ["OPENAI_API_KEY"] },
  anthropic: { requiredEnv: ["ANTHROPIC_API_KEY"] },
  gemini: { requiredEnv: ["GEMINI_API_KEY"] },
  custom: { requiredEnv: ["AI_ANALYSIS_API_URL", "AI_ANALYSIS_API_KEY"] },
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/**
 * The AI module only ever receives a transcript. It never touches video,
 * storage or database concerns, which keeps providers interchangeable.
 */
function buildPrompt(request: AnalysisRequest): string {
  const duration = request.targetDuration === 0 ? "auto (choose the natural length)" : `${request.targetDuration}s`;
  return [
    "You are a short-form video strategist. From the transcript below, find the moments most likely to perform as vertical shorts.",
    "Look for: hooks, curiosity loops, open loops, storytelling, high emotion, strong opinions, funny moments, educational moments, questions, calls to action and pattern interruptions.",
    `Return at most ${request.maxClips} moments. Target clip length: ${duration}.`,
    'Respond with JSON only: { "clips": AnalyzedMoment[] } where AnalyzedMoment =',
    '{ "title": string, "hookText": string, "transcriptExcerpt": string, "startSeconds": number, "endSeconds": number,',
    '"category": "hook"|"curiosity_loop"|"open_loop"|"storytelling"|"emotional"|"strong_opinion"|"funny"|"educational"|"question"|"call_to_action"|"pattern_interrupt",',
    '"sentiment": "positive"|"negative"|"neutral"|"mixed",',
    '"scores": { "virality": 0-100, "engagement": 0-100, "retention": 0-100, "emotion": 0-100, "curiosity": 0-100 },',
    '"predictedWatchTime": number, "shareProbability": 0-1,',
    '"social": { "tiktokCaption": string, "instagramCaption": string, "youtubeDescription": string, "hashtags": string[], "seoTitle": string, "thumbnailTitle": string, "hookSuggestion": string, "pinnedComment": string, "callToAction": string } }',
    `Language: ${request.language ?? "auto"}`,
    "TRANSCRIPT:",
    request.transcript.slice(0, 120_000),
  ].join("\n");
}

function parseMoments(raw: string): AnalyzedMoment[] {
  const json = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const parsed = JSON.parse(json);
  const clips = Array.isArray(parsed) ? parsed : parsed.clips;
  if (!Array.isArray(clips)) throw new Error("AI provider returned no clips array");
  return clips as AnalyzedMoment[];
}

async function expectOk(response: Response, provider: string): Promise<any> {
  const body = await response.text();
  if (!response.ok) throw new Error(`${provider} analysis failed [${response.status}]: ${body}`);
  return JSON.parse(body);
}

const openai: AnalysisProvider = {
  id: "openai",
  async analyze(request) {
    const data = await expectOk(
      await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
        },
        body: JSON.stringify({
          model: process.env["OPENAI_ANALYSIS_MODEL"] ?? "gpt-4.1",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: buildPrompt(request) }],
        }),
      }),
      "openai",
    );
    return parseMoments(data.choices?.[0]?.message?.content ?? "");
  },
};

const anthropic: AnalysisProvider = {
  id: "anthropic",
  async analyze(request) {
    const data = await expectOk(
      await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env["ANTHROPIC_ANALYSIS_MODEL"] ?? "claude-sonnet-4-5",
          max_tokens: 8000,
          messages: [{ role: "user", content: buildPrompt(request) }],
        }),
      }),
      "anthropic",
    );
    return parseMoments(data.content?.[0]?.text ?? "");
  },
};

const gemini: AnalysisProvider = {
  id: "gemini",
  async analyze(request) {
    const model = process.env["GEMINI_ANALYSIS_MODEL"] ?? "gemini-2.5-pro";
    const data = await expectOk(
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${requireEnv("GEMINI_API_KEY")}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(request) }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      ),
      "gemini",
    );
    return parseMoments(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
  },
};

const custom: AnalysisProvider = {
  id: "custom",
  async analyze(request) {
    const data = await expectOk(
      await fetch(requireEnv("AI_ANALYSIS_API_URL"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${requireEnv("AI_ANALYSIS_API_KEY")}`,
        },
        body: JSON.stringify(request),
      }),
      "custom",
    );
    return (Array.isArray(data) ? data : data.clips) as AnalyzedMoment[];
  },
};

const REGISTRY: Record<string, AnalysisProvider> = { openai, anthropic, gemini, custom };

export function createAnalysisProvider(id: string): AnalysisProvider {
  const provider = REGISTRY[id];
  if (!provider) throw new Error(`Unknown AI analysis provider "${id}"`);
  return provider;
}