const TIME_ZONE = "Asia/Tashkent";

export const SCHEDULED_TASKS = [
  { key: "content:morning", type: "content", slot: "morning", hour: 12, minute: 30 },
  { key: "content:midday", type: "content", slot: "midday", hour: 17, minute: 30 },
  { key: "content:afternoon", type: "content", slot: "afternoon", hour: 22, minute: 30 },
  { key: "learning", type: "learning", hour: 3, minute: 0 },
];

function localParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
    time: `${values.hour}:${values.minute}`,
  };
}

function completedForDate(state, date) {
  return state?.completed?.[date] || {};
}

export function resolveSchedulePlan({
  now = new Date(),
  eventName = "schedule",
  manualTask = "auto",
  manualSlot = "",
  state = {},
  graceMinutes = 60,
} = {}) {
  const local = localParts(now);
  if (eventName === "workflow_dispatch" && manualTask !== "auto") {
    return {
      date: local.date,
      time: local.time,
      replies: manualTask === "replies",
      contentSlots: manualTask === "content" && manualSlot ? [manualSlot] : [],
      learning: manualTask === "learning",
    };
  }

  const completed = completedForDate(state, local.date);
  const due = SCHEDULED_TASKS.filter((task) => {
    const taskMinutes = task.hour * 60 + task.minute;
    return local.minutes >= taskMinutes
      && local.minutes < taskMinutes + graceMinutes
      && !completed[task.key];
  });
  return {
    date: local.date,
    time: local.time,
    replies: eventName === "schedule",
    contentSlots: due.filter((task) => task.type === "content").map((task) => task.slot),
    learning: due.some((task) => task.type === "learning"),
  };
}

export function markScheduledTask(state = {}, { date, key, completedAt = new Date().toISOString() } = {}) {
  const next = {
    ...state,
    completed: { ...(state.completed || {}) },
  };
  next.completed[date] = { ...(next.completed[date] || {}), [key]: completedAt };
  const recentDates = Object.keys(next.completed).sort().slice(-14);
  next.completed = Object.fromEntries(recentDates.map((value) => [value, next.completed[value]]));
  return next;
}

export { TIME_ZONE };
