"use client";

import { useEffect, useRef, useState } from "react";

type ShareStatus = "idle" | "sharing" | "copied" | "error";

type PublicShareButtonProps = {
  title: string;
  text?: string;
};

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="h-4 w-4"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  const copied = document.execCommand("copy");

  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("The browser could not copy the page link.");
  }
}

export default function PublicShareButton({
  title,
  text,
}: PublicShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");

  const resetTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const scheduleReset = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      setStatus("idle");
    }, 2200);
  };

  const handleShare = async () => {
    if (status === "sharing") {
      return;
    }

    const pageUrl = window.location.href.split("#")[0];

    const shareText =
      text?.trim() || `Read ${title} on PravixoEduTech.`;

    setStatus("sharing");

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: pageUrl,
        });

        setStatus("idle");
        return;
      }
      catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setStatus("idle");
          return;
        }
      }
    }

    try {
      await copyToClipboard(pageUrl);
      setStatus("copied");
      scheduleReset();
    }
    catch {
      setStatus("error");
      scheduleReset();
    }
  };

  const buttonLabel =
    status === "copied"
      ? "Link copied"
      : status === "error"
        ? "Copy failed"
        : status === "sharing"
          ? "Sharing..."
          : "Share";

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={handleShare}
        disabled={status === "sharing"}
        aria-label={`Share ${title}`}
        className="inline-flex min-h-10 min-w-[6.5rem] items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "copied" ? <CheckIcon /> : <ShareIcon />}
        <span>{buttonLabel}</span>
      </button>

      <span className="sr-only" aria-live="polite">
        {status === "copied"
          ? "Page link copied to clipboard."
          : status === "error"
            ? "The page link could not be copied."
            : ""}
      </span>
    </div>
  );
}