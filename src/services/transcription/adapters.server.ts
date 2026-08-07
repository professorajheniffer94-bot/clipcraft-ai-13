import type { TranscriptionProvider, TranscriptionRequest, TranscriptionResult } from "../providers/types";

export const TRANSCRIPTION_PROVIDERS = {
  groq: { requiredEnv: ["GROQ_API_KEY"] },
  whisper: { requiredEnv: ["OPENAI_API_KEY"] },
  deepgram: { requiredEnv: ["DEEPGRAM_API_KEY"] },
  assemblyai: { requiredEnv: ["ASSEMBLYAI_API_KEY"] },
  custom: { requiredEnv: ["TRANSCRIPTION_API_URL", "TRANSCRIPTION_API_KEY"] },
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function readJson(response: Response, provider: string): Promise<any> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${provider} transcription failed [${response.status}]: ${body}`);
  }
  return JSON.parse(body);
}

function emptyResult(provider: string): TranscriptionResult {
  return { provider, language: null, text: "", words: [], segments: [], speakers: [], confidence: null };
}

const whisper: TranscriptionProvider = {
  id: "whisper",
  async transcribe({ audioUrl, language }: TranscriptionRequest) {
    const audio = await fetch(audioUrl);
    if (!audio.ok) throw new Error(`Unable to read audio [${audio.status}]`);
    const form = new FormData();
    form.append("file", await audio.blob(), "audio.mp3");
    form.append("model", process.env["WHISPER_MODEL"] ?? "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    if (language) form.append("language", language);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
      body: form,
    });
    const data = await readJson(response, "whisper");
    return {
      ...emptyResult("whisper"),
      language: data.language ?? language ?? null,
      text: data.text ?? "",
      words: (data.words ?? []).map((w: any) => ({ text: w.word, start: w.start, end: w.end })),
      segments: (data.segments ?? []).map((s: any) => ({ start: s.start, end: s.end, text: s.text })),
    };
  },
};

/**
 * Groq hosts Whisper large v3 with a generous free tier and word timestamps.
 * Default transcription provider for the pipeline.
 */
const groq: TranscriptionProvider = {
  id: "groq",
  async transcribe({ audioUrl, language }: TranscriptionRequest) {
    const media = await fetch(audioUrl);
    if (!media.ok) {
      throw new Error(
        media.status === 429
          ? "The source refused the download (rate limited). Use a direct file link or upload the video file."
          : `Unable to read media [${media.status}]`,
      );
    }
    const contentType = media.headers.get("content-type") ?? "";
    if (/^text\/|application\/(x)?html|json/i.test(contentType)) {
      throw new Error(
        "That link returned a web page instead of a media file. Upload the video file or use a direct .mp4/.mp3 link.",
      );
    }
    const form = new FormData();
    form.append("file", await media.blob(), "media.mp4");
    form.append("model", process.env["GROQ_TRANSCRIPTION_MODEL"] ?? "whisper-large-v3");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
    if (language) form.append("language", language);

    const data = await readJson(
      await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}` },
        body: form,
      }),
      "groq",
    );
    return {
      ...emptyResult("groq"),
      language: data.language ?? language ?? null,
      text: data.text ?? "",
      words: (data.words ?? []).map((w: any) => ({
        text: w.word ?? w.text,
        start: w.start,
        end: w.end,
      })),
      segments: (data.segments ?? []).map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    };
  },
};

const deepgram: TranscriptionProvider = {
  id: "deepgram",
  async transcribe({ audioUrl, language, diarize = true }: TranscriptionRequest) {
    const params = new URLSearchParams({
      model: process.env["DEEPGRAM_MODEL"] ?? "nova-2",
      smart_format: "true",
      punctuate: "true",
      diarize: String(diarize),
    });
    if (language) params.set("language", language);

    const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${requireEnv("DEEPGRAM_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl }),
    });
    const data = await readJson(response, "deepgram");
    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    const words = (alt?.words ?? []).map((w: any) => ({
      text: w.punctuated_word ?? w.word,
      start: w.start,
      end: w.end,
      speaker: w.speaker != null ? `Speaker ${w.speaker + 1}` : undefined,
      confidence: w.confidence,
    }));
    return {
      ...emptyResult("deepgram"),
      language: data.results?.channels?.[0]?.detected_language ?? language ?? null,
      text: alt?.transcript ?? "",
      words,
      segments: (alt?.paragraphs?.paragraphs ?? []).map((p: any) => ({
        start: p.start,
        end: p.end,
        text: (p.sentences ?? []).map((s: any) => s.text).join(" "),
        speaker: p.speaker != null ? `Speaker ${p.speaker + 1}` : undefined,
      })),
      speakers: [...new Set(words.map((w: any) => w.speaker).filter(Boolean))] as string[],
      confidence: alt?.confidence ?? null,
    };
  },
};

const assemblyai: TranscriptionProvider = {
  id: "assemblyai",
  async transcribe({ audioUrl, language, diarize = true }: TranscriptionRequest) {
    const key = requireEnv("ASSEMBLYAI_API_KEY");
    const created = await readJson(
      await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: { authorization: key, "content-type": "application/json" },
        body: JSON.stringify({
          audio_url: audioUrl,
          speaker_labels: diarize,
          language_code: language,
        }),
      }),
      "assemblyai",
    );

    let data = created;
    for (let attempt = 0; attempt < 120 && data.status !== "completed"; attempt += 1) {
      if (data.status === "error") throw new Error(`assemblyai transcription failed: ${data.error}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      data = await readJson(
        await fetch(`https://api.assemblyai.com/v2/transcript/${created.id}`, {
          headers: { authorization: key },
        }),
        "assemblyai",
      );
    }

    const words = (data.words ?? []).map((w: any) => ({
      text: w.text,
      start: w.start / 1000,
      end: w.end / 1000,
      speaker: w.speaker ? `Speaker ${w.speaker}` : undefined,
      confidence: w.confidence,
    }));
    return {
      ...emptyResult("assemblyai"),
      language: data.language_code ?? language ?? null,
      text: data.text ?? "",
      words,
      segments: (data.utterances ?? []).map((u: any) => ({
        start: u.start / 1000,
        end: u.end / 1000,
        text: u.text,
        speaker: u.speaker ? `Speaker ${u.speaker}` : undefined,
      })),
      speakers: [...new Set(words.map((w: any) => w.speaker).filter(Boolean))] as string[],
      confidence: data.confidence ?? null,
    };
  },
};

/** Generic adapter for a self-hosted transcription service. */
const custom: TranscriptionProvider = {
  id: "custom",
  async transcribe(request: TranscriptionRequest) {
    const response = await fetch(requireEnv("TRANSCRIPTION_API_URL"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${requireEnv("TRANSCRIPTION_API_KEY")}`,
      },
      body: JSON.stringify(request),
    });
    const data = await readJson(response, "custom");
    return { ...emptyResult("custom"), ...data, provider: "custom" };
  },
};

const REGISTRY: Record<string, TranscriptionProvider> = {
  groq,
  whisper,
  deepgram,
  assemblyai,
  custom,
};


export function createTranscriptionProvider(id: string): TranscriptionProvider {
  const provider = REGISTRY[id];
  if (!provider) throw new Error(`Unknown transcription provider "${id}"`);
  return provider;
}