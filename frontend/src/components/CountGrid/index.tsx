import type { Bucket, Counts } from "../../types/buffer";
import { BUCKET_LABEL } from "../StatusBadge";

const ORDER: Bucket[] = ["queue", "draft", "overdue", "approval", "sent"];

export default function CountGrid({
  counts,
  sentPartial = false,
  dense = false,
}: {
  counts: Counts;
  sentPartial?: boolean;
  dense?: boolean;
}) {
  return (
    <dl
      className={`grid gap-2 ${dense ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-5"}`}
    >
      {ORDER.map((b) => (
        <div key={b} className="rounded-xl bg-cream px-3 py-2">
          <dd className="text-lg font-semibold leading-6 text-forest-900">
            {counts[b]}
            {b === "sent" && sentPartial ? "+" : ""}
          </dd>
          <dt className="text-[0.7rem] leading-4 font-semibold text-muted">
            {BUCKET_LABEL[b]}
          </dt>
        </div>
      ))}
    </dl>
  );
}
