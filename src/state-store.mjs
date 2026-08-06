import { mkdir, readFile, writeFile } from "node:fs/promises";

export const EMPTY_STATE = {
  initialized: false,
  seenPostIds: [],
  seenReplyIds: [],
  botPostIds: [],
  lastRunAt: null,
};

export async function loadState(path = "data/threads-state.json") {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return { ...EMPTY_STATE, ...parsed };
  } catch (error) {
    if (error.code === "ENOENT") return { ...EMPTY_STATE };
    throw error;
  }
}

export async function saveState(path, state) {
  const directory = path.split("/").slice(0, -1).join("/") || ".";
  await mkdir(directory, { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function remember(state, key, values, max = 5000) {
  const merged = [...new Set([...(state[key] || []), ...values.filter(Boolean)])];
  state[key] = merged.slice(-max);
  return state;
}
