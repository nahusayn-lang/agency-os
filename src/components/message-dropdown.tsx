"use client";

import { formatDateTime } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { getLatestInboxMessages } from "@/lib/messages/actions";

interface InboxMessage {
  id: string;
  sender_id: string;
  title: string;
  content: string;
  type: string;
  is_emergency_checkout: boolean;
  created_at: string;
  sender: { name: string; email: string } | null;
}

export function MessageDropdown() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    getLatestInboxMessages().then((data) => {
      if (Array.isArray(data)) setMessages(data);
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpen(open: boolean) {
    setIsOpen(open);
    if (open) {
      // Refresh on every open so it stays reasonably current.
      getLatestInboxMessages().then((data) => {
        if (Array.isArray(data)) setMessages(data);
      });
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => handleOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground focus:outline-none"
        aria-label="Open messages"
      >
        <MessageSquare className="h-5 w-5" />
        {messages.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {messages.length > 9 ? "9+" : messages.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="glass-card absolute right-0 mt-2 z-50 w-80 rounded-md p-2 shadow-md text-popover-foreground">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2 px-2">
            <span className="text-xs font-semibold">Messages</span>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/messages");
              }}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              View all
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1">
            {messages.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No messages.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/messages");
                  }}
                  className="p-2 rounded text-xs bg-popover hover:bg-accent/40 cursor-pointer"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold block break-words">
                      {m.sender?.name || m.sender?.email || "Unknown"}
                    </span>
                    <span className="text-[9px] text-muted-foreground shrink-0 capitalize">
                      {m.is_emergency_checkout ? "Emergency" : m.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate">{m.title}</p>
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    {formatDateTime(m.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>

          {messages.length > 0 && (
            <p className="text-[9px] text-muted-foreground text-center mt-2 pt-1 border-t border-border">
              Tap a message to open your inbox
            </p>
          )}
        </div>
      )}
    </div>
  );
}