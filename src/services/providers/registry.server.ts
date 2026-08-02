import type {
  AnalysisProvider,
  ProviderCapability,
  ProviderDescriptor,
  RenderProvider,
  TranscriptionProvider,
} from "./types";
import { ProviderNotConfiguredError } from "./types";
import { createTranscriptionProvider, TRANSCRIPTION_PROVIDERS } from "../transcription/adapters.server";
import { createAnalysisProvider, ANALYSIS_PROVIDERS } from "../ai/adapters.server";
import { createRenderProvider, RENDER_PROVIDERS } from "../media/adapters.server";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

interface CapabilitySpec {
  selectorEnv: string;
  fallbackId: string;
  providers: Record<string, { readonly requiredEnv: readonly string[] }>;
}

const SPECS: Record<ProviderCapability, CapabilitySpec> = {
  transcription: {
    selectorEnv: "TRANSCRIPTION_PROVIDER",
    fallbackId: "whisper",
    providers: TRANSCRIPTION_PROVIDERS,
  },
  analysis: { selectorEnv: "AI_ANALYSIS_PROVIDER", fallbackId: "openai", providers: ANALYSIS_PROVIDERS },
  render: { selectorEnv: "RENDER_PROVIDER", fallbackId: "ffmpeg", providers: RENDER_PROVIDERS },
  voice: {
    selectorEnv: "VOICE_PROVIDER",
    fallbackId: "elevenlabs",
    providers: { elevenlabs: { requiredEnv: ["ELEVENLABS_API_KEY"] } },
  },
};

export function describeProvider(capability: ProviderCapability): ProviderDescriptor {
  const spec = SPECS[capability];
  const id = env(spec.selectorEnv) ?? spec.fallbackId;
  const requiredEnv = [...(spec.providers[id]?.requiredEnv ?? [])];
  const missing = requiredEnv.filter((name) => !env(name));
  return {
    capability,
    id,
    selectorEnv: spec.selectorEnv,
    requiredEnv,
    configured: requiredEnv.length > 0 && missing.length === 0,
  };
}

export function describeAllProviders(): ProviderDescriptor[] {
  return (Object.keys(SPECS) as ProviderCapability[]).map(describeProvider);
}

function assertConfigured(descriptor: ProviderDescriptor) {
  const missing = descriptor.requiredEnv.filter((name) => !env(name));
  if (descriptor.requiredEnv.length === 0 || missing.length > 0) {
    throw new ProviderNotConfiguredError(
      descriptor.capability,
      descriptor.id,
      missing.length > 0 ? missing : ["<unknown provider>"],
    );
  }
}

export function getTranscriptionProvider(): TranscriptionProvider {
  const descriptor = describeProvider("transcription");
  assertConfigured(descriptor);
  return createTranscriptionProvider(descriptor.id);
}

export function getAnalysisProvider(): AnalysisProvider {
  const descriptor = describeProvider("analysis");
  assertConfigured(descriptor);
  return createAnalysisProvider(descriptor.id);
}

export function getRenderProvider(): RenderProvider {
  const descriptor = describeProvider("render");
  assertConfigured(descriptor);
  return createRenderProvider(descriptor.id);
}