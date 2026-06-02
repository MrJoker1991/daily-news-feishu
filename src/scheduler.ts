import cron from "node-cron";
import { CRON_EXPRESSIONS } from "./config.js";
import { runDailyTask } from "./index.js";

const tasks: cron.ScheduledTask[] = [];

export function startScheduler(): void {
  for (const expr of CRON_EXPRESSIONS) {
    const task = cron.schedule(expr, async () => {
      console.log(`[INFO] 定时触发 (${expr}) — ${new Date().toISOString()}`);
      await runDailyTask();
    });
    tasks.push(task);
    console.log(`[INFO] 定时任务已注册: ${expr}`);
  }

  console.log("[INFO] 等待定时触发中...");
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  console.log("[INFO] 所有定时任务已停止");
}
