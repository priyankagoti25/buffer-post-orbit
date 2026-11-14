import { useEffect, useRef, useState } from "react";
import { askAi, type AiTurn } from "../../lib/ai";
import Icon from "../Icon";

type Message = AiTurn & { draft?: string | null };

type Props = {
  /** What is in the editor now. */
  draft: string;
  networks: string[];
  /** The smallest character limit among the chosen channels. */
  limit: number | null;
  onUseInPost: (text: string) => void;
  onSaveAsIdea: (text: string) => Promise<string | null>;
};

const QUICK: { label: string; prompt: (hasText: boolean) => string }[] = [
  {
    label: "Write a post",
    prompt: (has) =>
      has
        ? "Write a post from my text."
        : "Write a short post. Ask me nothing, just suggest one.",
  },
  { label: "Improve", prompt: () => "Improve my text. Keep the meaning." },
  { label: "Shorter", prompt: () => "Make my text shorter." },
  {
    label: "Post ideas",
    prompt: () => "Give me one post idea about my topic as a draft.",
  },
];

/** A small chat that writes or improves posts and ideas. Nothing goes into the editor until you press the button. */
export default function AiAssistant({
  draft,
  networks,
  limit,
  onUseInPost,
  onSaveAsIdea,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError("");
    setNotice("");
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const a = await askAi(next, { draft, networks, limit });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: a.reply || (a.draft ? "Here you go." : "…"),
          draft: a.draft,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The AI did not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[34rem] max-h-[75vh] flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="label-eyebrow !m-0">AI writing helper</p>
        {messages.length > 0 && (
          <button
            className="text-xs text-muted underline"
            onClick={() => {
              setMessages([]);
              setError("");
              setNotice("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="space-y-3 text-sm text-muted">
            <p>
              Ask me to write a post or an idea, or improve what you wrote. I
              can see the text in your editor and the networks you picked.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  className="rounded-full bg-sage-100 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-sage-200"
                  onClick={() => void send(q.prompt(Boolean(draft.trim())))}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-sm ${m.role === "user" ? "bg-forest-900 text-white" : "bg-sage-100 text-ink"}`}
            >
              {m.content}
            </div>
            {m.draft && (
              <div className="mt-2 rounded-2xl border border-line bg-paper p-3 text-left">
                <p className="whitespace-pre-wrap break-words text-sm">
                  {m.draft}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {[...m.draft].length} characters{limit ? ` of ${limit}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onUseInPost(m.draft as string)}
                  >
                    <Icon name="check" className="h-4 w-4" /> Use in post
                  </button>
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={async () => {
                      const err = await onSaveAsIdea(m.draft as string);
                      setNotice(err ?? "Saved as an idea.");
                    }}
                  >
                    Save as idea
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-muted">Writing…</p>}
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-sage-100 p-3 text-sm">{notice}</p>
        )}
        <div ref={end} />
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Write a post about my launch"
            aria-label="Message to the AI helper"
            className="field mt-0 min-w-0 flex-1 resize-none"
          />
          <button
            type="submit"
            className="btn btn-primary h-10 w-10 shrink-0 !px-0"
            disabled={busy || !input.trim()}
            aria-label="Send message"
            title="Send"
          >
            <Icon name="send" className="h-[1.15rem] w-[1.15rem]" />
          </button>
        </div>
        <p className="mt-2 text-[0.7rem] leading-4 font-medium text-muted">
          Powered by Google Gemini (free plan). Do not share private
          information. Short answers on purpose.
        </p>
      </form>
    </div>
  );
}
