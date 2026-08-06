import { buildDecisionQueue } from "./agent.mjs";
import { buildDailyContentPlan, shouldUseManualFollowUp } from "./content-plan.mjs";
import { generateContentDraft, generateManualFollowUp, generateReplyDraft, detectLanguage } from "./writer.mjs";
import { dedupePosts } from "./policy.mjs";
import { loadState, remember, saveState } from "./state-store.mjs";
import { FeedbackStore } from "./feedback-store.mjs";

function isNew(id, seen) {
  return Boolean(id) && !seen.has(id);
}

function tashkentDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(value);
}

export async function runCycle({
  client,
  profile,
  runtime,
  statePath = "data/threads-state.json",
  postLimit = 25,
  useAi = true,
  draftContent = true,
  live = false,
  maxReplies = 10,
  date,
  publishSlot,
  feedbackPath = "data/feedback.sqlite",
  collectFeedback = true,
  fetchImpl = fetch,
} = {}) {
  if (live && draftContent && !publishSlot) {
    throw new Error("Live content publishing requires --slot=morning|midday|afternoon|evening|late_evening");
  }
  const state = await loadState(statePath);
  const feedbackStore = collectFeedback ? new FeedbackStore(feedbackPath) : null;
  const posts = dedupePosts(await client.listMyThreads({ limit: postLimit, maxItems: postLimit }));
  const firstRun = !state.initialized;
  const seenPosts = new Set(state.seenPostIds);
  const botPosts = new Set(state.botPostIds);
  for (const post of posts) {
    feedbackStore?.recordEvent({
      eventType: botPosts.has(post.id) ? "bot_post" : "manual_post",
      sourceId: post.id,
      username: post.username,
      language: detectLanguage(post.text),
      text: post.text,
      createdAt: post.timestamp,
      isBot: botPosts.has(post.id),
      metadata: { permalink: post.permalink, format: post.media_type || null },
    });
  }
  const manualPosts = firstRun ? [] : posts.filter((post) => isNew(post.id, seenPosts) && !botPosts.has(post.id));
  const manualDecisions = useAi ? await buildDecisionQueue(manualPosts, { profile, runtime, useAi, fetchImpl }) : [];
  const manualFollowUps = [];
  if (useAi) {
    for (let i = 0; i < manualPosts.length; i += 1) {
      if (!shouldUseManualFollowUp(manualDecisions[i])) continue;
      manualFollowUps.push({
        post: manualPosts[i],
        decision: manualDecisions[i],
        draft: await generateManualFollowUp({ post: manualPosts[i], profile, runtime, fetchImpl }),
      });
    }
  }

  const replyCandidates = [];
  const replyErrors = [];
  const seenReplies = new Set(state.seenReplyIds);
  const today = tashkentDate();
  const repliedUsersToday = new Set((state.replyActions || [])
    .filter((item) => item.date === today && item.username)
    .map((item) => item.username));
  const pendingReplyUsers = new Set();
  for (const post of posts.filter((item) => item.has_replies && item.id)) {
    if (replyCandidates.length >= maxReplies) break;
    try {
      const replies = await client.listThreadReplies(post.id, { maxItems: Math.max(100, maxReplies) });
      for (const reply of replies) {
        const isOwnReply = reply.username === runtime.threadsUsername;
        const isBotReply = isOwnReply && botPosts.has(reply.id);
        feedbackStore?.recordEvent({
          eventType: isBotReply ? "bot_reply" : isOwnReply ? "manual_reply" : "incoming_reply",
          sourceId: reply.id,
          parentId: post.id,
          username: reply.username,
          language: detectLanguage(reply.text),
          text: reply.text,
          createdAt: reply.timestamp,
          isBot: isBotReply,
          metadata: { postPermalink: post.permalink },
        });
        if (!isNew(reply.id, seenReplies) || reply.username === runtime.threadsUsername) continue;
        if (reply.username && (repliedUsersToday.has(reply.username) || pendingReplyUsers.has(reply.username))) continue;
        if (replyCandidates.length >= maxReplies) break;
        const draft = useAi ? await generateReplyDraft({ post, reply, profile, runtime, fetchImpl }) : null;
        replyCandidates.push({ post, reply, draft });
        if (draft?.action === "reply" && reply.username) pendingReplyUsers.add(reply.username);
      }
    } catch (error) {
      replyErrors.push({ postId: post.id, error: error.message, code: error.code || null });
    }
  }

  const contentPlan = buildDailyContentPlan({
    date,
    posts: profile.automation?.posts_per_day_target || 5,
    automation: profile.automation,
  });
  const slotsToDraft = live && publishSlot ? contentPlan.filter((slot) => slot.slot === publishSlot) : contentPlan;
  if (live && draftContent && !slotsToDraft.length) throw new Error(`Unknown or unavailable publish slot: ${publishSlot}`);
  const contentDrafts = draftContent && useAi
    ? await Promise.all(slotsToDraft.map((slot) => generateContentDraft({ slot, profile, runtime, fetchImpl })))
    : slotsToDraft.map((slot) => ({ format: slot.format, publishable: false, reason: "draft generation disabled" }));

  const actions = [];
  if (live) {
    for (const item of replyCandidates.filter((candidate) => candidate.draft?.action === "reply" && candidate.draft.policy.passed).slice(0, maxReplies)) {
      const result = await client.createTextPost({ text: item.draft.text, replyToId: item.reply.id, autoPublishText: true });
      actions.push({ type: "reply", replyToId: item.reply.id, id: result.id || null });
      if (result.id) {
        state.botPostIds.push(result.id);
        state.replyActions.push({ username: item.reply.username || null, date: today, replyToId: item.reply.id });
      }
    }
    for (const item of manualFollowUps.filter((candidate) => candidate.draft.action === "follow_up" && candidate.draft.policy.passed).slice(0, 1)) {
      const result = await client.createTextPost({ text: item.draft.text, autoPublishText: true });
      actions.push({ type: "manual_follow_up", sourcePostId: item.post.id, id: result.id || null });
      if (result.id) state.botPostIds.push(result.id);
    }
    for (const draft of contentDrafts.filter((item) => item.publishable).slice(0, 1)) {
      if (draft.format === "image") continue;
      const result = await client.createTextPost({
        text: draft.text,
        pollAttachment: draft.format === "poll" && draft.pollOptions.length >= 2
          ? Object.fromEntries(draft.pollOptions.slice(0, 4).map((value, index) => [`option_${String.fromCharCode(97 + index)}`, value]))
          : undefined,
        autoPublishText: true,
      });
      actions.push({ type: draft.format, id: result.id || null });
      if (result.id) state.botPostIds.push(result.id);
    }
  }

  remember(state, "seenPostIds", posts.map((post) => post.id));
  remember(state, "seenReplyIds", replyCandidates.map((item) => item.reply.id));
  state.replyActions = (state.replyActions || []).slice(-5000);
  state.initialized = true;
  state.lastRunAt = new Date().toISOString();
  await saveState(statePath, state);
  const feedbackSummary = feedbackStore ? feedbackStore.summary() : null;
  feedbackStore?.close();

  return {
    generatedAt: state.lastRunAt,
    dryRun: !live,
    fetchedPosts: posts.length,
    manualPosts,
    manualDecisions,
    manualFollowUps,
    replyCandidates,
    replyErrors,
    contentPlan,
    contentDrafts,
    actions,
    feedback: feedbackSummary,
  };
}
