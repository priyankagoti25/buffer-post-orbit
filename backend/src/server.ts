import { connectDb } from "./config/db";
import { env } from "./config/env";
import { createApp } from "./app";
import { startRecurringWorker } from "./workers/recurring.worker";

async function main() {
  await connectDb();
  createApp().listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
  if (env.RECURRING_WORKER) startRecurringWorker();
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
