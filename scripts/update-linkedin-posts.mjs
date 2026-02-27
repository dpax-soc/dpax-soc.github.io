import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const COMPANY_URL = "https://www.linkedin.com/company/dpax/";
const OUTPUT_PATH = resolve(process.cwd(), "assets/data/linkedin-posts.json");
const FETCH_TIMEOUT_MS = 20000;
const POSTS_LIMIT = 20;

const textOrEmpty = (value) => (typeof value === "string" ? value.trim() : "");
const isNonEmptyObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

const maybeParseJson = (value) => {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();
    if (!normalized || (!normalized.startsWith("{") && !normalized.startsWith("["))) {
        return null;
    }

    try {
        return JSON.parse(normalized);
    } catch {
        return null;
    }
};

const normalizeDateToMs = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value < 1e12 ? value * 1000 : value;
    }

    if (typeof value === "string") {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber)) {
            return normalizeDateToMs(asNumber);
        }

        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
};

const toRelativeDate = (timestamp) => {
    if (!timestamp) {
        return "";
    }

    const diffMs = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) {
        return `${Math.max(1, minutes)}m`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${days}d`;
    }

    const months = Math.floor(days / 30);
    return `${Math.max(1, months)}mo`;
};

const truncate = (value, limit) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= limit) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, limit - 3)).trim()}...`;
};

const extractPostId = (value) => {
    const match = String(value).match(/urn:li:(?:activity|share|ugcPost):(\d+)/i) || String(value).match(/-activity-(\d+)/i);
    if (match) {
        return match[1];
    }

    return String(value).replace(/[^a-z0-9]+/gi, "").slice(-24) || `post-${Date.now()}`;
};

const buildPostUrl = (rawUrl, postId) => {
    const urlCandidate = textOrEmpty(rawUrl);
    if (urlCandidate) {
        try {
            const parsed = new URL(urlCandidate);
            parsed.search = "";
            parsed.hash = "";
            const host = parsed.hostname.replace(/^www\./i, "");
            if (/linkedin\.com$/i.test(host)) {
                return parsed.toString().replace(/\/$/, "");
            }
        } catch {
            // Ignore malformed URL.
        }
    }

    const urn = textOrEmpty(postId);
    if (/^urn:li:(activity|share|ugcPost):\d+$/i.test(urn)) {
        return `https://www.linkedin.com/feed/update/${urn}`;
    }

    return "";
};

const getFieldValue = (item, aliases) => {
    for (const alias of aliases) {
        if (Object.prototype.hasOwnProperty.call(item, alias) && item[alias] !== undefined && item[alias] !== null) {
            return item[alias];
        }
    }

    return "";
};

const unwrapMakeWebhookValue = (entry) => {
    if (!isNonEmptyObject(entry)) {
        return entry;
    }

    if (!Object.prototype.hasOwnProperty.call(entry, "value")) {
        return entry;
    }

    const value = entry.value;
    if (isNonEmptyObject(value) || Array.isArray(value)) {
        return value;
    }

    const parsed = maybeParseJson(value);
    return parsed === null ? entry : parsed;
};

const normalizeMakeWebhookCollection = (collection) => {
    if (!Array.isArray(collection)) {
        return [];
    }

    const normalized = [];
    for (const entry of collection) {
        const unwrapped = unwrapMakeWebhookValue(entry);
        if (Array.isArray(unwrapped)) {
            normalized.push(...unwrapped.filter((item) => isNonEmptyObject(item)));
        } else if (isNonEmptyObject(unwrapped)) {
            normalized.push(unwrapped);
        }
    }

    return normalized;
};

const extractMakeWebhookItems = (payload) => {
    if (Array.isArray(payload)) {
        return normalizeMakeWebhookCollection(payload);
    }

    if (isNonEmptyObject(payload) && Array.isArray(payload.posts)) {
        return normalizeMakeWebhookCollection(payload.posts);
    }

    if (isNonEmptyObject(payload) && Array.isArray(payload.data)) {
        return normalizeMakeWebhookCollection(payload.data);
    }

    if (isNonEmptyObject(payload) && Array.isArray(payload.results)) {
        return normalizeMakeWebhookCollection(payload.results);
    }

    return [];
};

const normalizeMakeWebhookItem = (item) => {
    if (!isNonEmptyObject(item)) {
        return null;
    }

    const postId = textOrEmpty(getFieldValue(item, ["postId", "post_id", "postID", "Post ID", "PostId", "id"]));
    const postText = textOrEmpty(getFieldValue(item, ["postText", "post_text", "post", "Post Text", "text", "commentary", "message"]));
    const rawUrl = textOrEmpty(getFieldValue(item, ["url", "postUrl", "post_url", "Post URL"]));
    const publishedAtRaw = getFieldValue(item, ["publishedAt", "published_at", "Published at", "createdAt", "created_at", "Created at", "Last Modified at", "lastModifiedAt"]);
    const isReshareRaw = getFieldValue(item, ["isReshare", "is_reshare", "Is Reshare", "isRepost", "is_repost"]);

    const url = buildPostUrl(rawUrl, postId);
    if (!url) {
        return null;
    }

    const content = isNonEmptyObject(item.content) ? item.content : {};
    const article = isNonEmptyObject(content.article) ? content.article : {};
    const titleFromArticle = textOrEmpty(article.title);
    const firstLine = postText.split("\n").map((line) => line.trim()).find(Boolean) || "";
    const title = titleFromArticle || firstLine || "LinkedIn Post";

    const excerpt = postText || textOrEmpty(article.description) || "";
    const publishedAtMs = normalizeDateToMs(publishedAtRaw);
    const isRepost = typeof isReshareRaw === "boolean"
        ? isReshareRaw
        : ["true", "1", "yes"].includes(String(isReshareRaw).toLowerCase());

    return {
        id: extractPostId(postId || url),
        isRepost,
        url,
        title,
        excerpt: truncate(excerpt, 260),
        relativeDate: toRelativeDate(publishedAtMs)
    };
};

const fetchWithTimeout = async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        return await fetch(url, {
            ...options,
            redirect: options.redirect || "follow",
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

const fetchPostsFromMakeWebhook = async () => {
    const webhookUrl = textOrEmpty(process.env.MAKE_LINKEDIN_WEBHOOK_URL);
    if (!webhookUrl) {
        throw new Error("MAKE_LINKEDIN_WEBHOOK_URL is not set.");
    }

    const webhookMethod = textOrEmpty(process.env.MAKE_LINKEDIN_WEBHOOK_METHOD).toUpperCase() || "GET";
    const webhookApiKey = textOrEmpty(process.env.MAKE_LINKEDIN_WEBHOOK_APIKEY);
    const webhookApiKeyHeader = textOrEmpty(process.env.MAKE_LINKEDIN_WEBHOOK_APIKEY_HEADER) || "x-make-apikey";

    const headers = {
        accept: "application/json"
    };

    let body;
    if (webhookMethod !== "GET") {
        headers["content-type"] = "application/json";
        body = JSON.stringify({ limit: POSTS_LIMIT });
    }

    if (webhookApiKey) {
        headers[webhookApiKeyHeader] = webhookApiKey;
    }

    console.log(`Calling Make webhook with ${webhookMethod} request.`);
    const response = await fetchWithTimeout(webhookUrl, {
        method: webhookMethod,
        headers,
        body
    });

    const rawBody = await response.text();
    if (!response.ok) {
        throw new Error(`Make webhook returned HTTP ${response.status}.`);
    }

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        throw new Error("Make webhook did not return valid JSON.");
    }

    const rawItems = extractMakeWebhookItems(payload);
    const seenUrls = new Set();
    const posts = [];

    for (const item of rawItems) {
        const normalized = normalizeMakeWebhookItem(item);
        if (!normalized || seenUrls.has(normalized.url)) {
            continue;
        }

        seenUrls.add(normalized.url);
        posts.push(normalized);

        if (posts.length >= POSTS_LIMIT) {
            break;
        }
    }

    console.log(`Make webhook returned ${rawItems.length} item(s), normalized ${posts.length} LinkedIn post(s).`);
    return posts;
};

const main = async () => {
    const posts = await fetchPostsFromMakeWebhook();

    if (!posts.length) {
        throw new Error("Make webhook returned zero valid posts. Feed file was not updated.");
    }

    const payload = {
        source: COMPANY_URL,
        lastSyncedAt: new Date().toISOString(),
        posts: posts.slice(0, POSTS_LIMIT)
    };

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    console.log(`LinkedIn feed updated with ${payload.posts.length} posts from Make webhook.`);
};

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
