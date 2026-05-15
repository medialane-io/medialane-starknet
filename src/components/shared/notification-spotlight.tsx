"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bell, ArrowRight, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fireConfetti } from "@/lib/confetti";
import { useWallet } from "@/hooks/use-wallet";
import { useNotifications } from "@/hooks/use-notifications";
import { NOTIFICATION_ICON, NOTIFICATION_COLOR, NOTIFICATION_LABEL } from "@/lib/notification-meta";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification";

// ── Spotlight card ────────────────────────────────────────────────────────────

function SpotlightCard({
  notification,
  index,
  total,
  onNext,
  onDone,
}: {
  notification: Notification;
  index: number;
  total: number;
  onNext: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const Icon = NOTIFICATION_ICON[notification.type] ?? Bell;
  // Only the text colour for the badge — strip the bg half from NOTIFICATION_COLOR
  const colorClass = NOTIFICATION_COLOR[notification.type]?.split(" ")[0] ?? "text-primary";
  const isLast = index === total - 1;

  const handleCta = () => {
    onDone();
    router.push(notification.href);
  };

  return (
    <div className="flex flex-col">
      {/* Asset image or icon fallback */}
      <div className="relative w-full aspect-square max-h-64 bg-muted overflow-hidden shrink-0">
        {notification.image ? (
          <Image
            src={notification.image}
            alt={notification.metadata?.assetName ?? notification.title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Icon className={cn("h-16 w-16 opacity-20", colorClass)} />
          </div>
        )}
      </div>

      <div className="px-5 pt-5 pb-6 space-y-5">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", colorClass)} />
          <span className={cn("text-xs font-semibold uppercase tracking-widest", colorClass)}>
            {NOTIFICATION_LABEL[notification.type]}
          </span>
        </div>

        {/* Headline + description */}
        <div className="space-y-1.5">
          <p className="text-2xl font-black leading-tight tracking-tight">
            {notification.title}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {notification.description}
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-2.5">
          <div className="btn-border-animated p-[1px] rounded-xl">
            <Button
              className="w-full h-11 font-semibold text-white rounded-[11px] bg-background/30 gap-2"
              onClick={handleCta}
            >
              {notification.type === "offer" ? "View offer" : "View asset"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full h-10 text-muted-foreground text-sm gap-1.5"
            onClick={isLast ? onDone : onNext}
          >
            {isLast ? "Done" : (
              <>
                Next
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-xs opacity-60">{total - index - 1} more</span>
              </>
            )}
          </Button>
        </div>

        {/* Pagination dots */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === index
                    ? "h-1.5 w-4 bg-primary"
                    : "h-1.5 w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Provider / watcher ────────────────────────────────────────────────────────

export function NotificationSpotlight() {
  const { address, isConnected } = useWallet();
  const { notifications, markRead } = useNotifications(isConnected ? address : null);

  const [queue, setQueue] = useState<Notification[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const shownForRef = useRef<string | null>(null);
  const confettiFiredRef = useRef(false);

  // Build and show the queue once per wallet session, after notifications load
  useEffect(() => {
    if (!isConnected || !address || notifications.length === 0) return;
    if (shownForRef.current === address) return;

    const spotlights = notifications.filter(
      (n) => n.priority === "spotlight" && n.isUnread
    );
    if (spotlights.length === 0) {
      shownForRef.current = address;
      return;
    }

    shownForRef.current = address;
    confettiFiredRef.current = false;
    setQueue(spotlights);
    setIndex(0);
    setOpen(true);
  }, [isConnected, address, notifications]);

  // Fire confetti once when the panel opens for a celebratory item
  useEffect(() => {
    if (open && queue.length > 0 && !confettiFiredRef.current) {
      if (queue[0].celebratory) {
        confettiFiredRef.current = true;
        fireConfetti();
      }
    }
  }, [open, queue]);

  const handleNext = () => {
    const next = index + 1;
    if (next >= queue.length) return;
    // Mark the current item read as the user moves past it
    markRead(queue[index].id);
    if (queue[next].celebratory) fireConfetti();
    setIndex(next);
  };

  // Only mark notifications the user has actually reached as read
  const handleDone = () => {
    for (let i = 0; i <= index; i++) markRead(queue[i].id);
    setOpen(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) handleDone();
  };

  const current = queue[index] ?? null;
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <SpotlightCard
          notification={current}
          index={index}
          total={queue.length}
          onNext={handleNext}
          onDone={handleDone}
        />
      </DialogContent>
    </Dialog>
  );
}
