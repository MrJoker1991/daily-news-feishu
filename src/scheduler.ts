import cron from "node-cron";
import { CRON_EXPRESSION } from "./config.js";
import { runDailyTask } from "./index.js";

let task: cron.ScheduledTask | null = null;

export function startScheduler(): void {
  console.log(`[INFO] 定时任务已启动 (${CRON_EXPRESSION})`);

  task = cron.schedule(CRON_EXPRESSION, async () => {
    console.log(`[INFO] 定时触发 — ${new Date().toISOString()}`);
    await runDailyTask();
  });

  console.log("[INFO] 等待定时触发中...");
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    console.log("[INFO] 定时任务已停止");
  }
}
