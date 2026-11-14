import { api } from "./api";
import { errorMessage } from "./format";

export type AiTurn = { role: "user" | "assistant"; content: string };
export type AiAnswer = { reply: string; draft: string | null };

/** Ask the writing helper. Only the last few messages are sent, to keep the free allowance going. */
export async function askAi(
  messages: AiTurn[],
  context: { draft: string; networks: string[]; limit: number | null },
): Promise<AiAnswer> {
  try {
    const { data } = await api.post<AiAnswer>("/api/buffer/ai/chat", {
      messages: messages.slice(-6),
      ...context,
    });
    return data;
  } catch (e) {
    throw new Error(errorMessage(e, "The AI did not answer. Try again."));
  }
}
