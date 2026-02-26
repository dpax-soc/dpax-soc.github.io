import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const COMPANY_URL = "https://www.linkedin.com/company/dpax/";
const OUTPUT_PATH = resolve(process.cwd(), "assets/data/linkedin-posts.json");
const FETCH_TIMEOUT_MS = 20000;
const POSTS_LIMIT = 20;
const SOURCE_URLS = [
    "https://www.linkedin.com/company/dpax/posts/?feedView=all",
    "https://www.linkedin.com/company/dpax/recent-activity/all/",
    "https://r.jina.ai/http://www.linkedin.com/company/dpax/posts/?feedView=all",
    "https://r.jina.ai/http://www.linkedin.com/company/dpax/recent-activity/all/"
];

const requestHeaders = {
    "user-agent": "Mozilla/5.0 (compatible; DPaXFeedSync/1.0; +https://www.dpax.fr)",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

const sanitizePostUrl = (rawUrl) => {
    if (typeof rawUrl !== "string") {
        return "";
    }

    const cleaned = rawUrl.trim().replace(/[),.;]+$/, "");
    if (!cleaned) {
        return "";
    }

    try {
        const parsed = new URL(cleaned);
        parsed.search = "";
        parsed.hash = "";

        if (!/\/posts\/dpax_/i.test(parsed.pathname)) {
            return "";
        }

        return parsed.toString().replace(/\/$/, "");
    } catch {
        return "";
    }
};

const deriveTitleFromUrl = (postUrl) => {
    try {
        const path = new URL(postUrl).pathname;
        const encodedSlug = path.split("/posts/")[1] || "";
        const slug = decodeURIComponent(encodedSlug);
        const titleSeed = slug
            .split("-activity-")[0]
            .replace(/^dpax_/i, "")
            .replace(/[_-]+/g, " ")
            .trim();

        if (!titleSeed) {
            return "LinkedIn Post";
        }

        return `${titleSeed.charAt(0).toUpperCase()}${titleSeed.slice(1)}`;
    } catch {
        return "LinkedIn Post";
    }
};

const normalizeTitle = (candidate, postUrl) => {
    if (typeof candidate !== "string") {
        return deriveTitleFromUrl(postUrl);
    }

    const normalized = candidate.replace(/\s+/g, " ").trim();
    if (!normalized || /^https?:\/\//i.test(normalized)) {
        return deriveTitleFromUrl(postUrl);
    }

    return normalized;
};

const extractPostId = (postUrl) => {
    const match = postUrl.match(/-activity-(\d+)/i);
    if (match) {
        return match[1];
    }

    return postUrl.replace(/[^a-z0-9]+/gi, "").slice(-24) || `post-${Date.now()}`;
};

const parsePostsFromSource = (content) => {
    if (typeof content !== "string" || !content.trim()) {
        return [];
    }

    const posts = [];
    const seenUrls = new Set();

    const addPost = (rawUrl, titleCandidate) => {
        if (posts.length >= POSTS_LIMIT) {
            return;
        }

        const cleanUrl = sanitizePostUrl(rawUrl);
        if (!cleanUrl || seenUrls.has(cleanUrl)) {
            return;
        }

        seenUrls.add(cleanUrl);
        posts.push({
            id: extractPostId(cleanUrl),
            isRepost: false,
            url: cleanUrl,
            title: normalizeTitle(titleCandidate, cleanUrl),
            excerpt: "",
            relativeDate: ""
        });
    };

    const markdownLinkRegex = /\[([^\]\n]{3,220})\]\((https:\/\/www\.linkedin\.com\/posts\/dpax_[^)\s]+)\)/gi;
    let markdownMatch = markdownLinkRegex.exec(content);
    while (markdownMatch) {
        addPost(markdownMatch[2], markdownMatch[1]);
        markdownMatch = markdownLinkRegex.exec(content);
    }

    const rawUrlRegex = /https:\/\/www\.linkedin\.com\/posts\/dpax_[^\s)\]'"<>]+/gi;
    let urlMatch = rawUrlRegex.exec(content);
    while (urlMatch) {
        addPost(urlMatch[0], "");
        urlMatch = rawUrlRegex.exec(content);
    }

    return posts;
};

const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers: requestHeaders,
            redirect: "follow",
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const content = await response.text();
        if (/"code"\s*:\s*451/.test(content) || /unavailable_for_legal_reasons/i.test(content)) {
            throw new Error("Source returned legal restriction (451)");
        }

        return content;
    } finally {
        clearTimeout(timeoutId);
    }
};

const readExistingFeed = async () => {
    try {
        const existing = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
        if (existing && typeof existing === "object" && Array.isArray(existing.posts)) {
            return existing;
        }
    } catch {
        // Ignore missing/invalid file.
    }

    return null;
};

const main = async () => {
    let posts = [];
    const errors = [];

    for (const sourceUrl of SOURCE_URLS) {
        try {
            const content = await fetchWithTimeout(sourceUrl);
            const parsedPosts = parsePostsFromSource(content);

            if (parsedPosts.length > 0) {
                posts = parsedPosts;
                break;
            }

            errors.push(`${sourceUrl} -> no post URLs found`);
        } catch (error) {
            errors.push(`${sourceUrl} -> ${error.message}`);
        }
    }

    if (!posts.length) {
        const existingFeed = await readExistingFeed();
        if (existingFeed && existingFeed.posts.length > 0) {
            console.warn("LinkedIn sync failed, keeping existing feed file unchanged.");
            console.warn(errors.join("\n"));
            return;
        }

        throw new Error(`LinkedIn sync failed and no existing feed is available.\n${errors.join("\n")}`);
    }

    const payload = {
        source: COMPANY_URL,
        lastSyncedAt: new Date().toISOString(),
        posts: posts.slice(0, POSTS_LIMIT)
    };

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    console.log(`LinkedIn feed updated with ${payload.posts.length} posts.`);
};

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
