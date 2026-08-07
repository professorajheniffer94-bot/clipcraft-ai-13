import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type ProfileRow = Tables["profiles"]["Row"];
export type ProjectRow = Tables["projects"]["Row"];
export type VideoRow = Tables["videos"]["Row"];
export type ClipRow = Tables["clips"]["Row"];
export type JobRow = Tables["processing_jobs"]["Row"];
export type BrandKitRow = Tables["brand_kits"]["Row"];
export type UsageRow = Tables["usage"]["Row"];
export type SubscriptionRow = Tables["subscriptions"]["Row"];

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export const profilesApi = {
  async me(): Promise<ProfileRow | null> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const result = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    return unwrap(result);
  },
  async update(patch: Tables["profiles"]["Update"]) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    return unwrap(
      await supabase.from("profiles").update(patch).eq("id", auth.user.id).select("*").single(),
    );
  },
};

export const projectsApi = {
  async list(): Promise<ProjectRow[]> {
    return unwrap(await supabase.from("projects").select("*").order("created_at", { ascending: false }));
  },
  async create(input: { name: string; description?: string }) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    return unwrap(
      await supabase
        .from("projects")
        .insert({ name: input.name, description: input.description ?? null, user_id: auth.user.id })
        .select("*")
        .single(),
    );
  },
  async remove(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

export const videosApi = {
  async list(): Promise<VideoRow[]> {
    return unwrap(await supabase.from("videos").select("*").order("created_at", { ascending: false }));
  },
  async byId(id: string): Promise<VideoRow | null> {
    return unwrap(await supabase.from("videos").select("*").eq("id", id).maybeSingle());
  },
  async remove(id: string) {
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

export const clipsApi = {
  async listByVideo(videoId: string): Promise<ClipRow[]> {
    return unwrap(
      await supabase
        .from("clips")
        .select("*")
        .eq("video_id", videoId)
        .order("virality_score", { ascending: false }),
    );
  },
  async listRecent(limit = 12): Promise<ClipRow[]> {
    return unwrap(
      await supabase.from("clips").select("*").order("created_at", { ascending: false }).limit(limit),
    );
  },
  async update(id: string, patch: Tables["clips"]["Update"]) {
    return unwrap(await supabase.from("clips").update(patch).eq("id", id).select("*").single());
  },
};

export const jobsApi = {
  async listByVideo(videoId: string): Promise<JobRow[]> {
    return unwrap(
      await supabase.from("processing_jobs").select("*").eq("video_id", videoId).order("created_at"),
    );
  },
  async listActive(): Promise<JobRow[]> {
    return unwrap(
      await supabase
        .from("processing_jobs")
        .select("*")
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(20),
    );
  },
};

export const brandKitsApi = {
  async list(): Promise<BrandKitRow[]> {
    return unwrap(await supabase.from("brand_kits").select("*").order("created_at"));
  },
  async create(input: Omit<Tables["brand_kits"]["Insert"], "user_id">) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    return unwrap(
      await supabase.from("brand_kits").insert({ ...input, user_id: auth.user.id }).select("*").single(),
    );
  },
  async update(id: string, patch: Tables["brand_kits"]["Update"]) {
    return unwrap(await supabase.from("brand_kits").update(patch).eq("id", id).select("*").single());
  },
  async remove(id: string) {
    const { error } = await supabase.from("brand_kits").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

export const billingApi = {
  async subscription(): Promise<SubscriptionRow | null> {
    return unwrap(await supabase.from("subscriptions").select("*").maybeSingle());
  },
  async usage(): Promise<UsageRow[]> {
    return unwrap(
      await supabase.from("usage").select("*").order("created_at", { ascending: false }).limit(50),
    );
  },
};
export type TranscriptionRow = Tables["transcriptions"]["Row"];
export type ExportRow = Tables["exports"]["Row"];

export const transcriptionsApi = {
  async byVideo(videoId: string): Promise<TranscriptionRow | null> {
    return unwrap(
      await supabase.from("transcriptions").select("*").eq("video_id", videoId).maybeSingle(),
    );
  },
};

export const mediaApi = {
  /** Short-lived signed URL for the original video file. */
  async sourceUrl(video: VideoRow): Promise<string> {
    if (video.storage_path) {
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(video.storage_path, 60 * 60);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not sign video URL");
      return data.signedUrl;
    }
    if (video.source_url) return video.source_url;
    throw new Error("This video has no downloadable source");
  },
};

export const exportsApi = {
  async listByClip(clipId: string): Promise<ExportRow[]> {
    return unwrap(
      await supabase
        .from("exports")
        .select("*")
        .eq("clip_id", clipId)
        .order("created_at", { ascending: false }),
    );
  },
  /** Stores a rendered clip in storage and records the export row. */
  async saveRendered(input: {
    clipId: string;
    blob: Blob;
    width: number;
    height: number;
    fps: number;
  }): Promise<{ export: ExportRow; url: string }> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    const path = `${auth.user.id}/exports/${input.clipId}-${Date.now()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(path, input.blob, { contentType: "video/mp4", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const row = unwrap<ExportRow>(
      await supabase
        .from("exports")
        .insert({
          user_id: auth.user.id,
          clip_id: input.clipId,
          format: "mp4",
          width: input.width,
          height: input.height,
          fps: input.fps,
          quality: "high",
          file_path: path,
          size_bytes: input.blob.size,
          status: "ready",
        })
        .select("*")
        .single(),
    );

    const { data: signed } = await supabase.storage.from("videos").createSignedUrl(path, 60 * 60);
    return { export: row, url: signed?.signedUrl ?? "" };
  },
};
