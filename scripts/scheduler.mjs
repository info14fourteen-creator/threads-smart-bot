import { readFile, writeFile } from "node:fs/promises";
import { markScheduledTask, resolveSchedulePlan } from "../src/scheduler.mjs";

const statePath = "data/scheduler-state.json";

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return {};
  }
}

async function writeState(state) {
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

const [command, taskKey, date] = process.argv.slice(2);

if (command === "mark") {
  if (!taskKey || !date) throw new Error("Usage: node scripts/scheduler.mjs mark <task-key> <YYYY-MM-DD>");
  await writeState(markScheduledTask(await readState(), { date, key: taskKey }));
} else if (command === "resolve") {
  const plan = resolveSchedulePlan({
    eventName: process.env.GITHUB_EVENT_NAME || "schedule",
    manualTask: process.env.MANUAL_TASK || "auto",
    manualSlot: process.env.MANUAL_SLOT || "",
    state: await readState(),
  });
  for (const [key, value] of Object.entries({
    date: plan.date,
    local_time: plan.time,
    replies: String(plan.replies),
    content_slots: plan.contentSlots.join(","),
    learning: String(plan.learning),
  })) console.log(`${key}=${value}`);
} else {
  throw new Error("Usage: node scripts/scheduler.mjs resolve|mark");
}
