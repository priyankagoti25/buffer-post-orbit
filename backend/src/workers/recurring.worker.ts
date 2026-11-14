import { RecurringSeries } from "../models/RecurringSeries.model";
import { syncSeries } from "../services/recurring.service";

// Checking the database is cheap. Buffer is only called when a recurring post is actually due,
// so a one-minute check keeps the wait after a post goes out short.
const TICK_MS = 60_000;
const MAX_TICK_MS = 4 * 60_000;
let running = false;

export const workerStatus = {
  started: false,
  lastTickAt: null as Date | null,
  lastDue: 0,
  lastError: null as string | null,
};

async function tick() {
  if (running) return;
  running = true;
  const startedAt = Date.now();
  try {
    const due = await RecurringSeries.find({
      status: "active",
      nextCheckAt: { $lte: new Date() },
    })
      .sort({ nextCheckAt: 1 })
      .limit(25)
      .select("_id");
    workerStatus.lastDue = due.length;
    if (due.length)
      console.log(`Recurring worker: ${due.length} recurring post(s) due.`);
    for (const d of due) {
      if (Date.now() - startedAt > MAX_TICK_MS) break; // the rest wait for the next check
      try {
        await syncSeries(String(d._id), { reconcile: true });
        console.log(`Recurring worker: checked ${String(d._id)}.`);
      } catch (e) {
        console.error(
          "Recurring sync failed:",
          e instanceof Error ? e.message : e,
        );
      }
      await new Promise((r) => setTimeout(r, 1500)); // go gently on Buffer's shared request limit
    }
    workerStatus.lastError = null;
  } catch (e) {
    workerStatus.lastError = e instanceof Error ? e.message : String(e);
    console.error("Recurring worker tick failed:", workerStatus.lastError);
  } finally {
    workerStatus.lastTickAt = new Date();
    running = false;
  }
}

export function startRecurringWorker() {
  workerStatus.started = true;
  setTimeout(tick, 5_000).unref();
  setInterval(tick, TICK_MS).unref();
  console.log("Recurring-post worker started (checks every minute).");
}
