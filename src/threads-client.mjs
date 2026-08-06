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

  async request(pathOrUrl, { params, signal } = {}) {
    const url = new URL(pathOrUrl, `${this.baseUrl}/`);
    if (params) {
      for (const [key, value] of toSearchParams(params)) url.searchParams.set(key, value);
    }
    // Never put the token in the URL. This keeps logs and error messages safe.
    url.searchParams.delete("access_token");

    let response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        signal,
      });
    } catch (error) {
      throw new ThreadsApiError(`Threads API network request failed: ${error.message}`, {
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
}
