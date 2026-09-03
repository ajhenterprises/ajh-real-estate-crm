"use client";

import { useActionState } from "react";
import { updateBrandingAction } from "@/lib/settings/actions";
import type { BrandSettings } from "@/lib/settings/brand";

export function BrandingForm({ settings, hasLogo }: { settings: BrandSettings; hasLogo: boolean }) {
  const [state, formAction, pending] = useActionState(updateBrandingAction, undefined);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="companyName" className="text-sm font-medium text-foreground">
          Brokerage / company name
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          defaultValue={settings.companyName ?? ""}
          placeholder="AJH Real Estate CRM"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Logo</span>
        {hasLogo ? (
          <img
            src="/api/branding/logo"
            alt="Current logo"
            className="h-16 w-auto rounded border border-border bg-surface-muted object-contain p-2"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No logo uploaded yet.</p>
        )}
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or SVG. Up to 2 MB.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="primaryColor" className="text-sm font-medium text-foreground">
            Primary color
          </label>
          <div className="flex items-center gap-2">
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              defaultValue={settings.primaryColor}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-surface"
            />
            <input
              type="text"
              defaultValue={settings.primaryColor}
              onChange={(e) => {
                const target = document.getElementById("primaryColor") as HTMLInputElement | null;
                if (target && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) target.value = e.target.value;
              }}
              className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accentColor" className="text-sm font-medium text-foreground">
            Accent color
          </label>
          <div className="flex items-center gap-2">
            <input
              id="accentColor"
              name="accentColor"
              type="color"
              defaultValue={settings.accentColor}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-surface"
            />
            <input
              type="text"
              defaultValue={settings.accentColor}
              onChange={(e) => {
                const target = document.getElementById("accentColor") as HTMLInputElement | null;
                if (target && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) target.value = e.target.value;
              }}
              className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {state?.error ? (
        <p className="rounded-md bg-status-attention-bg px-3 py-2 text-sm text-status-attention">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="rounded-md bg-status-ontrack-bg px-3 py-2 text-sm text-status-ontrack">Branding saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
