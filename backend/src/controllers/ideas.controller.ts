import type { Request, Response } from "express";
import { z } from "zod";
import { BufferConnection } from "../models/BufferConnection.model";
import { Idea } from "../models/Idea.model";
import {
  createIdeaInBuffer,
  listBufferIdeas,
} from "../services/bufferData.service";
import { assetsSchema } from "../services/postMetadata.service";
import { apiCache, clearUserCache } from "../utils/cache";
import { AppError } from "../utils/errors";
import { cleanText, idSchema, mongoIdSchema, parse } from "../utils/validate";

const contentJson = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional()
  .refine(
    (v) => !v || JSON.stringify(v).length < 120_000,
    "Idea is too large.",
  );

const ideaBody = z.object({
  title: z
    .string()
    .max(120)
    .transform((t) => cleanText(t).trim())
    .default(""),
  text: z
    .string()
    .max(25000)
    .transform(cleanText)
    .refine((t) => t.trim().length > 0, "Write something first."),
  contentJson,
  assets: assetsSchema,
});

const createBody = ideaBody.extend({
  organizationId: idSchema.optional(),
  syncToBuffer: z.boolean().default(false),
});

const toDto = (i: InstanceType<typeof Idea>) => ({
  id: String(i._id),
  source: "app" as const,
  title: i.title,
  text: i.text,
  contentJson: i.contentJson ?? null,
  assets: (i.assets ?? []).map((a) => ({
    kind: a.kind,
    url: a.url,
    altText: a.altText ?? undefined,
  })),
  organizationId: i.organizationId,
  bufferIdeaId: i.bufferIdeaId,
  syncStatus: i.syncStatus,
  syncError: i.syncError,
  createdAt: i.createdAt,
  updatedAt: i.updatedAt,
});

/**
 * Ideas written in this app plus every idea in the person's Buffer account.
 * An idea we sent to Buffer shows once (our copy, which keeps the formatting).
 */
export async function listIdeas(req: Request, res: Response) {
  const userId = req.userId!;
  const local = await Idea.find({ userId }).sort({ updatedAt: -1 }).limit(200);
  const key = `${userId}:ideas`;
  let remote =
    req.query.refresh === "1"
      ? undefined
      : apiCache.get<Awaited<ReturnType<typeof listBufferIdeas>>>(key);
  let bufferError: string | null = null;
  if (!remote) {
    // No ideas:read permission means Buffer would refuse. Do not call it, just say what to do.
    const conn = await BufferConnection.findOne({ userId }).lean();
    const scopes = (conn?.scope ?? "").split(/[\s,]+/);
    if (conn && scopes.length > 1 && !scopes.includes("ideas:read")) {
      remote = [];
      bufferError = "Buffer has not given this app the ideas permission.";
    }
  }
  if (!remote) {
    try {
      remote = await listBufferIdeas(userId);
      apiCache.set(key, remote);
    } catch (e) {
      remote = [];
      bufferError =
        e instanceof Error ? e.message : "Could not read ideas from Buffer.";
    }
  }
  const known = new Set(local.map((i) => i.bufferIdeaId).filter(Boolean));
  const fromBuffer = remote
    .filter((r) => !known.has(r.id))
    .map((r) => ({
      id: `buffer:${r.id}`,
      source: "buffer" as const,
      title: r.title,
      text: r.text,
      contentJson: null,
      assets: r.assets,
      organizationId: r.organizationId,
      bufferIdeaId: r.id,
      syncStatus: "synced" as const,
      syncError: null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  const ideas = [...local.map(toDto), ...fromBuffer].sort((a, b) =>
    String(b.updatedAt).localeCompare(String(a.updatedAt)),
  );
  res.json({ ideas, bufferError });
}

export async function createIdea(req: Request, res: Response) {
  const userId = req.userId!;
  const body = parse(createBody, req.body);
  const idea = await Idea.create({
    userId,
    title: body.title,
    text: body.text,
    contentJson: body.contentJson ?? null,
    assets: body.assets,
    organizationId: body.organizationId ?? null,
  });

  // Buffer ideas take still images only. Do not even try with anything else: the call would fail.
  const notSendable = body.assets.some(
    (a) => a.kind !== "image" || /\.gif(\?|#|$)/i.test(a.url),
  );
  if (body.syncToBuffer && notSendable) {
    idea.syncError =
      "Not sent to Buffer: Buffer ideas take still images only. Saved in this app.";
    await idea.save();
  } else if (body.syncToBuffer && body.organizationId) {
    try {
      // Pushing an idea needs the ideas:write scope. Skip politely if the user has not granted it.
      const connection = await BufferConnection.findOne({ userId }).lean();
      if (!connection?.scope?.split(/[\s,]+/).includes("ideas:write")) {
        throw new AppError(
          403,
          "MISSING_SCOPE",
          "Reconnect Buffer with the ideas:write permission to send ideas to Buffer.",
        );
      }
      const sent = await createIdeaInBuffer(
        userId,
        body.organizationId,
        body.title,
        body.text,
        body.assets,
      );
      idea.bufferIdeaId = sent.id;
      idea.syncStatus = "synced";
      idea.syncError = sent.note ? sent.note.slice(0, 300) : null;
    } catch (e) {
      idea.syncStatus = "failed";
      idea.syncError = (
        e instanceof Error ? e.message : "Could not send to Buffer."
      ).slice(0, 300);
    }
    await idea.save();
  }
  clearUserCache(userId);
  res.status(201).json({ idea: toDto(idea) });
}

export async function updateIdea(req: Request, res: Response) {
  const { id } = parse(z.object({ id: mongoIdSchema }), req.params);
  const body = parse(ideaBody, req.body);
  const idea = await Idea.findOneAndUpdate(
    { _id: id, userId: req.userId! },
    {
      $set: {
        title: body.title,
        text: body.text,
        contentJson: body.contentJson ?? null,
        assets: body.assets,
      },
    },
    { new: true },
  );
  if (!idea) throw new AppError(404, "NOT_FOUND", "Idea not found.");
  res.json({ idea: toDto(idea) });
}

export async function deleteIdea(req: Request, res: Response) {
  const { id } = parse(z.object({ id: mongoIdSchema }), req.params);
  const result = await Idea.deleteOne({ _id: id, userId: req.userId! });
  if (!result.deletedCount)
    throw new AppError(404, "NOT_FOUND", "Idea not found.");
  res.json({ ok: true });
}
