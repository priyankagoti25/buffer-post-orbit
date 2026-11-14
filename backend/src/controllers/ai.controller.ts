import type { Request, Response } from "express";
import { z } from "zod";
import { chat } from "../services/ai.service";
import { parse } from "../utils/validate";

const body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  draft: z.string().max(25000).default(""),
  networks: z.array(z.string().max(30)).max(12).default([]),
  limit: z.number().int().min(1).max(100000).nullable().default(null),
});

/** POST /api/buffer/ai/chat */
export async function aiChat(req: Request, res: Response) {
  const b = parse(body, req.body);
  if (b.messages[b.messages.length - 1].role !== "user")
    b.messages.push({ role: "user", content: "Continue." });
  const result = await chat(req.userId!, b.messages, {
    draft: b.draft,
    networks: b.networks,
    limit: b.limit,
  });
  res.json(result);
}
