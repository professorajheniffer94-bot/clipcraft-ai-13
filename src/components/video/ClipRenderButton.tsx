import { useState } from "react";
import { Download, Loader2, Scissors } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { exportsApi, mediaApi, type ClipRow, type VideoRow } from "@/api/queries";
import { buildCaptionChunks } from "@/lib/captions";
import type { TranscriptWord } from "@/services/providers/types";

interface Props {
  clip: ClipRow;
  video: VideoRow;
  words: TranscriptWord[];
}

/**
 * Cuts, reframes to 9:16 and burns animated captions in the browser,
 * then stores the result as an export.
 */
export function ClipRenderButton({ clip, video, words }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function render() {
    setBusy(true);
    setProgress(0);
    setStatus("Preparing…");
    try {
      const { renderVerticalClip } = await import("@/lib/clip-render");
      const sourceUrl = await mediaApi.sourceUrl(video);
      const captions = buildCaptionChunks(words, clip.start_seconds, clip.end_seconds);
      const blob = await renderVerticalClip({
        sourceUrl,
        startSeconds: clip.start_seconds,
        endSeconds: clip.end_seconds,
        captions,
        onProgress: (ratio, message) => {
          setProgress(Math.round(ratio * 100));
          setStatus(message);
        },
      });
      setStatus("Saving export…");
      const saved = await exportsApi.saveRendered({
        clipId: clip.id,
        blob,
        width: 1080,
        height: 1920,
        fps: 30,
      });
      setDownloadUrl(saved.url || URL.createObjectURL(blob));
      toast.success("Clip rendered in 9:16 with captions");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Render failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void render()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Scissors className="size-4" />}
          Render 9:16 + captions
        </Button>
        {downloadUrl ? (
          <Button asChild size="sm" variant="ghost">
            <a href={downloadUrl} download={`${clip.title ?? "clip"}.mp4`}>
              <Download className="size-4" /> Download
            </a>
          </Button>
        ) : null}
      </div>
      {busy ? (
        <div>
          <Progress value={progress} className="h-1.5" />
          <p className="mt-1 text-xs text-muted-foreground">{status}</p>
        </div>
      ) : null}
    </div>
  );
}
