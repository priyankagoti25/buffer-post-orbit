import type { Request, Response } from "express";
import { z } from "zod";
import { signUpload } from "../services/media.service";
import { parse } from "../utils/validate";

export function signMediaUpload(req: Request, res: Response) {
  const { kind } = parse(
    z.object({ kind: z.enum(["image", "video"]) }),
    req.body,
  );
  res.json(signUpload(req.userId!, kind));
}
