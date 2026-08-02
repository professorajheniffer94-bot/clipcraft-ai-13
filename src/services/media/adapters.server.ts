import type { RenderProvider, RenderRequest, RenderResult } from "../providers/types";

export const RENDER_PROVIDERS = {
  ffmpeg: { requiredEnv: ["RENDER_WORKER_URL", "RENDER_WORKER_KEY"] },
  shotstack: { requiredEnv: ["SHOTSTACK_API_KEY"] },
  creatomate: { requiredEnv: ["CREATOMATE_API_KEY"] },
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function expectOk(response: Response, provider: string): Promise<any> {
  const body = await response.text();
  if (!response.ok) throw new Error(`${provider} render failed [${response.status}]: ${body}`);
  return JSON.parse(body);
}

/** Self-hosted FFmpeg worker: vertical reframe, subtitle burn-in and export. */
const ffmpeg: RenderProvider = {
  id: "ffmpeg",
  async render(request: RenderRequest): Promise<RenderResult> {
    const data = await expectOk(
      await fetch(`${requireEnv("RENDER_WORKER_URL").replace(/\/$/, "")}/render`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${requireEnv("RENDER_WORKER_KEY")}`,
        },
        body: JSON.stringify(request),
      }),
      "ffmpeg",
    );
    return { provider: "ffmpeg", fileUrl: data.fileUrl ?? data.url, sizeBytes: data.sizeBytes ?? null };
  },
};

const shotstack: RenderProvider = {
  id: "shotstack",
  async render(request: RenderRequest): Promise<RenderResult> {
    const host = process.env["SHOTSTACK_HOST"] ?? "https://api.shotstack.io/edit/v1";
    const data = await expectOk(
      await fetch(`${host}/render`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": requireEnv("SHOTSTACK_API_KEY") },
        body: JSON.stringify({
          timeline: {
            tracks: [
              {
                clips: [
                  {
                    asset: {
                      type: "video",
                      src: request.sourceUrl,
                      trim: request.startSeconds,
                    },
                    start: 0,
                    length: Math.max(1, request.endSeconds - request.startSeconds),
                    fit: "crop",
                  },
                ],
              },
            ],
          },
          output: { format: "mp4", fps: request.fps, size: { width: request.width, height: request.height } },
        }),
      }),
      "shotstack",
    );
    return { provider: "shotstack", fileUrl: data.response?.url ?? data.response?.id ?? "", sizeBytes: null };
  },
};

const creatomate: RenderProvider = {
  id: "creatomate",
  async render(request: RenderRequest): Promise<RenderResult> {
    const data = await expectOk(
      await fetch("https://api.creatomate.com/v1/renders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${requireEnv("CREATOMATE_API_KEY")}`,
        },
        body: JSON.stringify({
          output_format: "mp4",
          frame_rate: request.fps,
          width: request.width,
          height: request.height,
          elements: [
            {
              type: "video",
              source: request.sourceUrl,
              trim_start: request.startSeconds,
              trim_duration: Math.max(1, request.endSeconds - request.startSeconds),
            },
          ],
        }),
      }),
      "creatomate",
    );
    const first = Array.isArray(data) ? data[0] : data;
    return { provider: "creatomate", fileUrl: first?.url ?? "", sizeBytes: null };
  },
};

const REGISTRY: Record<string, RenderProvider> = { ffmpeg, shotstack, creatomate };

export function createRenderProvider(id: string): RenderProvider {
  const provider = REGISTRY[id];
  if (!provider) throw new Error(`Unknown render provider "${id}"`);
  return provider;
}