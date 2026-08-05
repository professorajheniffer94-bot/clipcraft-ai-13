import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { profilesApi } from "@/api/queries";
import { CLIP_DURATIONS } from "@/constants/app";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ClipMind AI" },
      { name: "description", content: "Profile, defaults and subtitle preferences." },
      { property: "og:title", content: "Settings — ClipMind AI" },
      { property: "og:description", content: "Profile, defaults and subtitle preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const profile = useQuery({ queryKey: ["profile"], queryFn: profilesApi.me });

  const [fullName, setFullName] = useState("");
  const [clipLength, setClipLength] = useState("30");
  const [quality, setQuality] = useState("high");
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    if (!profile.data) return;
    setFullName(profile.data.full_name ?? "");
    setClipLength(String(profile.data.default_clip_length));
    setQuality(profile.data.default_export_quality);
    setLanguage(profile.data.language);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      profilesApi.update({
        full_name: fullName.trim() || null,
        default_clip_length: Number(clipLength),
        default_export_quality: quality,
        language,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader title="Settings" description="Profile, defaults and subtitle preferences." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="surface-panel space-y-5 p-5">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={fullName}
              maxLength={100}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Default clip length</Label>
              <Select value={clipLength} onValueChange={setClipLength}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIP_DURATIONS.map((duration) => (
                    <SelectItem key={duration.value} value={String(duration.value)}>
                      {duration.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Export quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard 720p</SelectItem>
                  <SelectItem value="high">High 1080p</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transcription language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="auto">Auto detect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <div className="surface-panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">Account</h2>
          <p className="text-sm text-muted-foreground">
            Plan <span className="capitalize text-foreground">{profile.data?.plan ?? "free"}</span> ·{" "}
            {profile.data?.credits_remaining ?? 0} credits left.
          </p>
          <Button variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </>
  );
}
