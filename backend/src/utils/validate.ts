import { z } from "zod";
import { AppError } from "./errors";

/** Parse request data with a zod schema. Bad input becomes a clean 400 error. */
export function parse<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    throw new AppError(400, "VALIDATION_ERROR", message);
  }
  return result.data;
}

/** Buffer ids are short letters, numbers, dashes and underscores. */
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");

/** Mongo ids are 24 hex characters. */
export const mongoIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Make user text safe to send: fix line endings, drop control characters and broken Unicode. */
export function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(LONE_SURROGATE, "�")
    .trimEnd();
}
