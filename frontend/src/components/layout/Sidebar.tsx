"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import {
  Bell,
  ClipboardList,
  HelpCircle,
  MapPin,
  MessageCircle,
  Settings,
} from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { ComingSoonDialog } from "@/components/ui/ComingSoonDialog";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Chat", icon: MessageCircle },
  { href: "/treatment-plan", label: "Treatment Plan", icon: ClipboardList },
  { href: "/outbreaks", label: "Outbreak Alerts", icon: Bell },
  { href: "/nearby-vets", label: "Nearby Vets", icon: MapPin },
] as const;

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const closeComingSoon = useCallback(() => setComingSoon(null), []);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <LogoMark className="h-10 w-10 shrink-0" />
        <div>
          <p className="text-lg font-semibold tracking-tight text-brand">
            LivestockAI
          </p>
          <p className="text-xs text-neutral-500">Livestock health assistant</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-muted text-brand"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-brand" : "text-neutral-500",
                )}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-neutral-100 px-3 py-4">
        <button
          type="button"
          onClick={() => setComingSoon("Help & Support")}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          <HelpCircle className="h-5 w-5 text-neutral-500" strokeWidth={2} />
          Help &amp; Support
        </button>
        <button
          type="button"
          onClick={() => setComingSoon("Settings")}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          <Settings className="h-5 w-5 text-neutral-500" strokeWidth={2} />
          Settings
        </button>
      </div>

      <ComingSoonDialog
        open={comingSoon != null}
        title={comingSoon ?? ""}
        onClose={closeComingSoon}
      />

      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local SVG */}
          <img
            src="/images/cow-avatar.svg"
            alt=""
            width={32}
            height={32}
            className="rounded-full"
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-neutral-800">
              LivestockAI
            </p>
            <p className="truncate text-[11px] text-neutral-500">Assistant</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
