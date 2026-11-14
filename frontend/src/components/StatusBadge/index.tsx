import type { Bucket } from "../../types/buffer";

export const BUCKET_LABEL: Record<Bucket, string> = {
  queue: "Queue",
  scheduled: "Queue",
  draft: "Draft",
  overdue: "Overdue draft",
  approval: "Needs approval",
  sent: "Sent",
  failed: "Failed",
  other: "Other",
};

const STYLE: Record<Bucket, string> = {
  queue: "bg-sage-100 text-forest-800",
  scheduled: "bg-mist-200 text-forest-900",
  draft: "bg-stone-100 text-stone-700",
  overdue: "bg-sand-100 text-sand-700",
  approval: "bg-violet-100 text-violet-800",
  sent: "bg-sage-300 text-forest-900",
  failed: "bg-red-100 text-red-800",
  other: "bg-stone-100 text-stone-700",
};

export default function StatusBadge({
  bucket,
  rawStatus,
}: {
  bucket: Bucket;
  rawStatus?: string;
}) {
  const label =
    bucket === "other" && rawStatus ? rawStatus : BUCKET_LABEL[bucket];
  return <span className={`chip ${STYLE[bucket]}`}>{label}</span>;
}
