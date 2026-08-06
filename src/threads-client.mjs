export const DEFAULT_POST_FIELDS = [
  "id",
  "text",
  "username",
  "timestamp",
  "permalink",
  "has_replies",
  "root_post_id",
  "reply_to_id",
].join(",");

export const DEFAULT_INSIGHT_METRICS = ["views", "likes", "replies", "reposts", "quotes", "shares"].join(",");

export class ThreadsApiError extends Error {
  constructor(message, { status, code, type, path } = {}) {
    super(message);
    this.name = "ThreadsApiError";
    this.status = status;
    this.code = code;
    this.type = type;
    this.path = path;
  }
}

function toSearchParams(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return searchParams;
}

export class ThreadsClient {
  constructor({ accessToken, baseUrl = "https://graph.threads.net/v1.0", fetchImpl = fetch } = {}) {
    if (!accessToken) throw new Error("Threads access token is required");
    this.accessToken = accessToken;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async requestWithMethod(method, pathOrUrl, { params, body, signal } = {}) {
    const url = new URL(pathOrUrl, `${this.baseUrl}/`);
    if (params) {
      for (const [key, value] of toSearchParams(params)) url.searchParams.set(key, value);
    }
    // Never put the token in the URL. This keeps logs and error messages safe.
    url.searchParams.delete("access_token");

    let response;
    let lastNetworkError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: {
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
            Authorization: `Bearer ${this.accessToken}`,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal,
        });
        break;
      } catch (error) {
        lastNetworkError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    if (!response) {
      throw new ThreadsApiError(`Threads API network request failed: ${lastNetworkError?.message || "unknown error"}`, {
        path: url.pathname,
      });
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
      const error = payload?.error || {};
      throw new ThreadsApiError(error.message || `Threads API request failed: ${response.status}`, {
        status: response.status,
        code: error.code,
        type: error.type,
        path: url.pathname,
      });
    }
    return payload;
  }

  request(pathOrUrl, options = {}) {
    return this.requestWithMethod("GET", pathOrUrl, options);
  }

  mutate(pathOrUrl, options = {}) {
    return this.requestWithMethod("POST", pathOrUrl, options);
  }

  getMe({ fields = "id,username,name", signal } = {}) {
    return this.request("/me", { params: { fields }, signal });
  }

  getMyThreads({ limit = 25, fields = DEFAULT_POST_FIELDS, signal } = {}) {
    return this.request("/me/threads", { params: { fields, limit }, signal });
  }

  keywordSearch({ query, limit = 25, fields = DEFAULT_POST_FIELDS, searchType = "RECENT", signal } = {}) {
    if (!query?.trim()) throw new Error("A search query is required");
    return this.request("/keyword_search", {
      params: { q: query.trim(), search_type: searchType, fields, limit },
      signal,
    });
  }

  async collectPages(firstPage, { maxItems = 100, signal } = {}) {
    const items = [];
    let page = firstPage;
    while (page) {
      if (Array.isArray(page.data)) items.push(...page.data);
      if (items.length >= maxItems || !page.paging?.next) break;
      page = await this.request(page.paging.next, { signal });
    }
    return items.slice(0, maxItems);
  }

  async listMyThreads(options = {}) {
    return this.collectPages(await this.getMyThreads(options), options);
  }

  async searchKeyword(options = {}) {
    return this.collectPages(await this.keywordSearch(options), options);
  }

  getThreadReplies(threadId, { limit = 50, fields = DEFAULT_POST_FIELDS, signal } = {}) {
    if (!threadId) throw new Error("A thread id is required");
    return this.request(`/${encodeURIComponent(threadId)}/replies`, { params: { fields, limit }, signal });
  }

  async listThreadReplies(threadId, options = {}) {
    return this.collectPages(await this.getThreadReplies(threadId, options), options);
  }

  getThreadInsights(threadId, { metrics = DEFAULT_INSIGHT_METRICS, signal } = {}) {
    if (!threadId) throw new Error("A thread id is required");
    return this.request(`/${encodeURIComponent(threadId)}/insights`, { params: { metric: metrics }, signal });
  }

  createTextPost({ text, pollAttachment, replyToId, autoPublishText = false, replyControl, enableReplyApprovals = true, signal } = {}) {
    if (!text?.trim()) throw new Error("Text is required");
    return this.mutate("/me/threads", {
      params: {
        text: text.trim(),
        media_type: "TEXT",
        auto_publish_text: autoPublishText,
        reply_to_id: replyToId,
        reply_control: replyControl,
        enable_reply_approvals: enableReplyApprovals,
        poll_attachment: pollAttachment ? JSON.stringify(pollAttachment) : undefined,
      },
      signal,
    });
  }

  createImageContainer({ text, imageUrl, altText, signal } = {}) {
    if (!imageUrl) throw new Error("A public image URL is required");
    return this.mutate("/me/threads", {
      params: { text, media_type: "IMAGE", image_url: imageUrl, alt_text: altText },
      signal,
    });
  }

  publishContainer(creationId, { signal } = {}) {
    if (!creationId) throw new Error("A creation id is required");
    return this.mutate("/me/threads_publish", { params: { creation_id: creationId }, signal });
  }
}
