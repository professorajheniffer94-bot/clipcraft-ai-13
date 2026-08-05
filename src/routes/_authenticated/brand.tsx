import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brandKitsApi, type BrandKitRow } from "@/api/queries";

export const Route = createFileRoute("/_authenticated/brand")({
  head: () => ({
    meta: [
      { title: "Brand kit — ClipMind AI" },
      { name: "description", content: "Fonts, colours, logo and watermark applied to every export." },
      { property: "og:title", content: "Brand kit — ClipMind AI" },
      { property: "og:description", content: "Fonts, colours, logo and watermark applied to every export." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const kits = useQuery({ queryKey: ["brand-kits"], queryFn: brandKitsApi.list });
  const [name, setName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["brand-kits"] });

  const create = useMutation({
    mutationFn: () =>
      brandKitsApi.create({
        name: name.trim() || "New brand kit",
        primary_color: "#b794f6",
        secondary_color: "#f97362",
        font_family: "Inter",
      }),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Brand kit created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<BrandKitRow> }) =>
      brandKitsApi.update(id, patch),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => brandKitsApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Brand kit removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader title="Brand kit" description="Fonts, colours, logo and watermark applied to every export." />

      <div className="surface-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="kit-name">New kit name</Label>
          <Input
            id="kit-name"
            value={name}
            maxLength={80}
            placeholder="Main channel"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-2">
          <Plus className="size-4" /> Create kit
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {(kits.data ?? []).map((kit) => (
          <div key={kit.id} className="surface-panel space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <Input
                defaultValue={kit.name}
                maxLength={80}
                className="max-w-[16rem] font-medium"
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value && value !== kit.name) update.mutate({ id: kit.id, patch: { name: value } });
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={() => remove.mutate(kit.id)}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary colour</Label>
                <input
                  type="color"
                  value={kit.primary_color ?? "#b794f6"}
                  className="h-10 w-full cursor-pointer rounded-lg border border-border bg-surface-2"
                  onChange={(event) =>
                    update.mutate({ id: kit.id, patch: { primary_color: event.target.value } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Accent colour</Label>
                <input
                  type="color"
                  value={kit.secondary_color ?? "#f97362"}
                  className="h-10 w-full cursor-pointer rounded-lg border border-border bg-surface-2"
                  onChange={(event) =>
                    update.mutate({ id: kit.id, patch: { secondary_color: event.target.value } })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subtitle font</Label>
              <Input
                defaultValue={kit.font_family ?? "Inter"}
                maxLength={60}
                onBlur={(event) =>
                  update.mutate({ id: kit.id, patch: { font_family: event.target.value.trim() || null } })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Watermark URL</Label>
              <Input
                defaultValue={kit.watermark_url ?? ""}
                maxLength={1024}
                placeholder="https://…"
                onBlur={(event) =>
                  update.mutate({ id: kit.id, patch: { watermark_url: event.target.value.trim() || null } })
                }
              />
            </div>
          </div>
        ))}

        {kits.data && kits.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No brand kits yet. Create one to apply colours, fonts and watermark to every export.
          </p>
        ) : null}
      </div>
    </>
  );
}
