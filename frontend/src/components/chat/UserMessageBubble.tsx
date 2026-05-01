import { cn } from "@/lib/utils";

type Props = {
  text: string;
  time: string;
};

export function UserMessageBubble({ text, time }: Props) {
  return (
    <div className="flex justify-end gap-3">
      <div className="max-w-[min(100%,36rem)] space-y-1">
        <div
          className={cn(
            "rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed",
            "bg-brand-muted text-neutral-900 shadow-sm",
          )}
        >
          {text}
        </div>
        <p className="pr-1 text-right text-[11px] text-neutral-400">{time}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- local SVG avatars */}
      <img
        src="/images/user-avatar.svg"
        alt=""
        width={36}
        height={36}
        className="mt-1 h-9 w-9 shrink-0 rounded-full"
      />
    </div>
  );
}
