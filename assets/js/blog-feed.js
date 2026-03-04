(() => {
    const LINKEDIN_POSTS_PATH = "assets/data/linkedin-posts.json";
    const LINKEDIN_POSTS_LIMIT = 20;

    const postsContainer = document.querySelector("[data-linkedin-posts]");
    if (!postsContainer) {
        return;
    }

    const statusElement = document.querySelector("[data-linkedin-status]");
    const countElement = document.querySelector("[data-linkedin-post-count]");
    const emptyLabelElement = document.querySelector("[data-linkedin-empty-label]");
    const errorLabelElement = document.querySelector("[data-linkedin-error-label]");
    const linkLabelElement = document.querySelector("[data-linkedin-link-label]");

    const FALLBACK_LABELS = {
        en: {
            empty: "No original LinkedIn posts are available at the moment.",
            error: "Unable to load LinkedIn posts right now.",
            cta: "View on LinkedIn",
            titleFallback: "LinkedIn Post"
        },
        fr: {
            empty: "Aucune publication originale LinkedIn n'est disponible pour le moment.",
            error: "Impossible de charger les publications LinkedIn pour le moment.",
            cta: "Voir sur LinkedIn",
            titleFallback: "Publication LinkedIn"
        }
    };

    let cachedPosts = null;

    const normalizeLanguage = (value) => {
        const languageCode = String(value || "en").toLowerCase().split("-")[0];
        return languageCode === "fr" ? "fr" : "en";
    };

    const getLanguage = () => normalizeLanguage(document.documentElement.lang);

    const resolveText = (element, fallback) => {
        if (!element || typeof element.textContent !== "string") {
            return fallback;
        }

        const value = element.textContent.trim();
        return value || fallback;
    };

    const getLabels = () => {
        const language = getLanguage();
        const fallback = FALLBACK_LABELS[language];
        return {
            empty: resolveText(emptyLabelElement, fallback.empty),
            error: resolveText(errorLabelElement, fallback.error),
            cta: resolveText(linkLabelElement, fallback.cta),
            titleFallback: fallback.titleFallback
        };
    };

    const setStatus = (message, { hidden = false, isError = false } = {}) => {
        if (!statusElement) {
            return;
        }

        statusElement.textContent = message;
        statusElement.classList.toggle("visually-hidden", hidden);
        statusElement.classList.toggle("error", isError);
    };

    const setCount = (value) => {
        if (countElement) {
            countElement.textContent = String(value);
        }
    };

    const isValidPost = (post) => {
        if (!post || typeof post !== "object") {
            return false;
        }

        if (post.isRepost === true) {
            return false;
        }

        return typeof post.url === "string" && post.url.trim().length > 0;
    };

    const createPostCard = (post, labels) => {
        const card = document.createElement("article");
        card.className = "linkedin-post-card";

        const relativeDate = typeof post.relativeDate === "string" ? post.relativeDate.trim() : "";
        if (relativeDate) {
            const meta = document.createElement("p");
            meta.className = "linkedin-post-meta";
            meta.textContent = relativeDate;
            card.append(meta);
        }

        const title = document.createElement("h3");
        title.textContent = typeof post.title === "string" && post.title.trim()
            ? post.title.trim()
            : labels.titleFallback;
        card.append(title);

        const excerpt = typeof post.excerpt === "string" ? post.excerpt.trim() : "";
        if (excerpt) {
            const excerptElement = document.createElement("p");
            excerptElement.textContent = excerpt;
            card.append(excerptElement);
        }

        const link = document.createElement("a");
        link.className = "button button-ghost button-inline";
        link.href = post.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = labels.cta;
        card.append(link);

        return card;
    };

    const renderPosts = (posts) => {
        const labels = getLabels();
        postsContainer.innerHTML = "";
        setCount(posts.length);

        if (!posts.length) {
            setStatus(labels.empty, { hidden: false, isError: false });
            return;
        }

        const fragment = document.createDocumentFragment();
        posts.forEach((post) => {
            fragment.append(createPostCard(post, labels));
        });

        postsContainer.append(fragment);
        setStatus("", { hidden: true, isError: false });
    };

    const fetchPosts = async () => {
        if (cachedPosts) {
            return cachedPosts;
        }

        const response = await fetch(LINKEDIN_POSTS_PATH, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`LinkedIn feed load failed: ${response.status}`);
        }

        const payload = await response.json();
        const allOriginalPosts = Array.isArray(payload.posts) ? payload.posts.filter(isValidPost) : [];
        cachedPosts = allOriginalPosts.slice(0, LINKEDIN_POSTS_LIMIT);
        return cachedPosts;
    };

    const initLinkedInFeed = async () => {
        try {
            const posts = await fetchPosts();
            renderPosts(posts);
        } catch (error) {
            console.error("Unable to load LinkedIn posts.", error);
            postsContainer.innerHTML = "";
            setCount(0);
            setStatus(getLabels().error, { hidden: false, isError: true });
        }
    };

    window.addEventListener("dpax:language-changed", () => {
        if (cachedPosts) {
            renderPosts(cachedPosts);
        }
    });

    void initLinkedInFeed();
})();
