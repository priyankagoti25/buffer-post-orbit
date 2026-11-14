import axios from "axios";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatContext = {
  draft: string;
  networks: string[];
  limit: number | null;
};

const SYSTEM = [
  "You are a writing helper inside a social media post composer.",
  "Be brief: at most two short sentences outside the draft. No lists, no extra tips, no questions unless you truly need one detail.",
  "When you write or rewrite a post or an idea, put ONLY the final text between <draft> and </draft>, as plain text (no markdown, no quotes around it).",
  "Add hashtags and emoji only if asked or if they clearly fit. Keep the draft inside the character limit you are given.",
  "If the request is not about writing or improving a post or idea, say in one sentence that you only help with that.",
].join(" ");

// Our own spending guard for the free tier: a small number of messages per person and for the whole app.
const perUser = new Map<string, number[]>();
let appDay = { day: "", count: 0 };

function checkAllowance(userId: string) {
  const now = Date.now();
  const recent = (perUser.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= env.AI_MESSAGES_PER_HOUR) {
    throw new AppError(
      429,
      "AI_LIMIT",
      `You have used ${env.AI_MESSAGES_PER_HOUR} AI messages this hour. Try again later.`,
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  if (appDay.day !== today) appDay = { day: today, count: 0 };
  if (appDay.count >= env.AI_MESSAGES_PER_DAY) {
    throw new AppError(
      429,
      "AI_LIMIT",
      "The free AI allowance for today is used up. It resets tomorrow.",
    );
  }
  recent.push(now);
  perUser.set(userId, recent);
  appDay.count += 1;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
};

async function callGemini(body: Record<string, unknown>) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`;
  return axios.post<GeminiResponse>(url, body, {
    headers: {
      "x-goog-api-key": env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    timeout: 25_000,
  });
}

/** Ask Gemini. Returns the short reply and, when it wrote one, the draft text. */
export async function chat(
  userId: string,
  turns: ChatTurn[],
  ctx: ChatContext,
): Promise<{ reply: string; draft: string | null }> {
  if (!env.GEMINI_API_KEY)
    throw new AppError(
      503,
      "AI_NOT_CONFIGURED",
      "AI is not set up on this server. Add GEMINI_API_KEY to the backend settings.",
    );
  checkAllowance(userId);

  // Keep the request small: the last few messages, trimmed, and only the part of the draft that matters.
  const history = turns.slice(-6).map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: clip(t.content, 1500) }],
  }));
  const note = [
    ctx.networks.length ? `Networks: ${ctx.networks.join(", ")}.` : "",
    ctx.limit ? `Character limit: ${ctx.limit}.` : "",
    ctx.draft.trim()
      ? `Current text in the editor:\n${clip(ctx.draft, 2000)}`
      : "The editor is empty.",
  ]
    .filter(Boolean)
    .join("\n");

  const base = {
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\n${note}` }] },
    contents: history,
    generationConfig: { maxOutputTokens: 700, temperature: 0.7 },
  };

  let data: GeminiResponse;
  try {
    try {
      // Thinking tokens count against the output limit, so switch them off when the model allows it.
      ({ data } = await callGemini({
        ...base,
        generationConfig: {
          ...base.generationConfig,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }));
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 400)
        ({ data } = await callGemini(base));
      else throw e;
    }
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (status === 429)
      throw new AppError(
        429,
        "AI_RATE_LIMITED",
        "Google's free AI limit was reached. Wait a minute and try again.",
      );
    if (status === 401 || status === 403)
      throw new AppError(
        503,
        "AI_NOT_CONFIGURED",
        "The AI key was rejected. Check GEMINI_API_KEY.",
      );
    if (status === 404)
      throw new AppError(
        503,
        "AI_NOT_CONFIGURED",
        `The AI model "${env.GEMINI_MODEL}" was not found. Set GEMINI_MODEL to a model listed in Google AI Studio.`,
      );
    throw new AppError(502, "AI_FAILED", "The AI did not answer. Try again.");
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text)
    throw new AppError(
      502,
      "AI_FAILED",
      data.promptFeedback?.blockReason
        ? "The AI would not answer that."
        : "The AI gave an empty answer. Try again.",
    );

  const m = text.match(/<draft>([\s\S]*?)<\/draft>/i);
  const draft = m ? m[1].trim() : null;
  const reply = text
    .replace(/<draft>[\s\S]*?<\/draft>/gi, "")
    .replace(/<\/?draft>/gi, "")
    .trim();
  return {
    reply: clip(reply, 400),
    draft: draft && draft.length ? clip(draft, 5000) : null,
  };
}
