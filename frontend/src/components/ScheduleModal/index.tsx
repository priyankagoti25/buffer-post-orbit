import { useState } from "react";
import {
  newSchedule,
  scheduleProblem,
  scheduleToPayload,
} from "../../lib/schedule";
import { schedulePost } from "../../store/posts/postsService";
import { useAppDispatch } from "../../store/hooks";
import type { Post } from "../../types/buffer";
import Modal from "../Modal";
import Notice from "../Notice";
import ScheduleFields from "../ScheduleFields";

/** Turns a draft into a scheduled (or queued, or immediate) post. */
export default function ScheduleModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [value, setValue] = useState(newSchedule("queue"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const problem = scheduleProblem(value);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    const res = await dispatch(
      schedulePost({ id: post.id, ...scheduleToPayload(value) }),
    );
    if (schedulePost.rejected.match(res)) {
      setError(res.payload?.message ?? "Could not schedule the draft.");
      setBusy(false);
      return;
    }
    onClose();
  }

  return (
    <Modal title="Schedule this draft" onClose={onClose}>
      <p className="mb-4 line-clamp-3 whitespace-pre-wrap rounded-xl bg-cream p-3 text-sm">
        {post.text}
      </p>
      <ScheduleFields
        name="schedule-draft"
        value={value}
        onChange={setValue}
        kinds={["queue", "custom", "now"]}
      />
      {error && (
        <Notice kind="error" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Schedule"}
        </button>
      </div>
    </Modal>
  );
}
