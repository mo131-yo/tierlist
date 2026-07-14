"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Link2, Share2, Send, MessageCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyText } from "@/lib/clipboard";

function openPopup(url: string) {
  window.open(url, "_blank", "noopener,noreferrer,width=640,height=560");
}

// lucide-ийн шинэ хувилбарт brand icon байхгүй тул жижиг inline SVG
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1.5 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L7 3.7H5.1L17.8 20Z" />
    </svg>
  );
}

/**
 * Tier list-ийг платформ руу шууд share хийх цэс.
 * trigger-ээ render prop-оор авна (Base UI DropdownMenuTrigger-ийн render).
 */
export function ShareMenu({
  url,
  title,
  trigger,
}: {
  url: string; // бүтэн абсолют URL байж болно, эсвэл path (origin залгана)
  title: string;
  trigger: ReactNode;
}) {
  // Цэсний content зөвхөн client дээр (нээх үед) render хийгддэг тул
  // энд шууд шалгахад hydration зөрөхгүй
  const canNativeShare =
    typeof navigator !== "undefined" && !!navigator.share;

  function fullUrl() {
    return url.startsWith("http") ? url : `${window.location.origin}${url}`;
  }
  const enc = () => encodeURIComponent(fullUrl());
  const encTitle = () => encodeURIComponent(title);

  const isMobile = () =>
    /android|iphone|ipad|mobile/i.test(navigator.userAgent);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton={false}
        render={<span onClick={(e) => e.stopPropagation()}>{trigger}</span>}
      />
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {canNativeShare && (
          <>
            <DropdownMenuItem
              onClick={() =>
                navigator.share({ title, url: fullUrl() }).catch(() => {})
              }
            >
              <Share2 className="h-4 w-4" /> Шэйр…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() =>
            openPopup(`https://www.facebook.com/sharer/sharer.php?u=${enc()}`)
          }
        >
          <FacebookIcon /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            // Messenger deep link утсан дээр; desktop-д FB sharer (тэндээс Messenger сонгогдоно)
            if (isMobile()) {
              window.location.href = `fb-messenger://share/?link=${enc()}`;
            } else {
              openPopup(`https://www.facebook.com/sharer/sharer.php?u=${enc()}`);
            }
          }}
        >
          <MessageCircle className="h-4 w-4" /> Messenger
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openPopup(`https://t.me/share/url?url=${enc()}&text=${encTitle()}`)
          }
        >
          <Send className="h-4 w-4" /> Telegram
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openPopup(`https://wa.me/?text=${encTitle()}%20${enc()}`)}
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openPopup(
              `https://twitter.com/intent/tweet?url=${enc()}&text=${encTitle()}`,
            )
          }
        >
          <XIcon /> X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            const ok = await copyText(fullUrl());
            if (ok) toast.success("Линк хуулагдлаа");
            else toast.error("Хуулж чадсангүй");
          }}
        >
          <Link2 className="h-4 w-4" /> Линк хуулах
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
