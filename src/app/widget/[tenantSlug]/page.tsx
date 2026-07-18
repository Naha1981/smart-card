"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Rendered inside an <iframe> that the retailer's embed script injects.
 * See public/embed.js for the loader snippet retailers paste as one
 * <script> tag (onboarding step 6, PRD §7).
 */
export default function WidgetPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setTenantSlug(p.tenantSlug));
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || streaming) return;
    const userMessage = input;
    setMessages((m) => [...m, { role: "user", content: userMessage }]);
    setInput("");
    setStreaming(true);

    const res = await fetch("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, conversationId, message: userMessage }),
    });
    const newConversationId = res.headers.get("x-conversation-id");
    if (newConversationId) setConversationId(newConversationId);

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value, { stream: true });
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: assistantText }]);
    }
    setStreaming(false);
  }

  return (
    <div className="flex h-screen flex-col bg-surface text-text">
      <header className="border-b border-border px-4 py-3 text-sm font-medium">Chat with us</header>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-text-dim text-sm">Try: "I need breakfast for tomorrow" or "Feed me for R500 until Friday."</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-accent-dim text-text" : "bg-bg text-text"}`}>
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border p-3 flex gap-2">
        <input
          className="flex-1 rounded-lg bg-bg border border-border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
          value={input}
          placeholder="Ask for anything..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          disabled={streaming}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
