(() => {
    const DEFAULT_LANGUAGE = "en";
    const SUPPORTED_LANGUAGES = ["en", "fr"];
    const STORAGE_KEY = "dpax-language";
    const URL_LANGUAGE_PARAM = "lang";
    const TRANSLATIONS_PATH = "assets/i18n/translations.json";
    const LINKEDIN_POSTS_PATH = "assets/data/linkedin-posts.json";
    const LINKEDIN_POSTS_LIMIT = 20;
    const BRAND_MEANINGS = [
        { en: "Digital Protection vs X-Threat", fr: "Protection Numérique face aux Menaces X" }
    ];

    const nav = document.querySelector("[data-nav]");
    const toggle = document.querySelector("[data-nav-toggle]");

    if (nav && toggle) {
        toggle.addEventListener("click", () => {
            const isOpen = nav.classList.toggle("open");
            toggle.setAttribute("aria-expanded", String(isOpen));
        });

        nav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                nav.classList.remove("open");
                toggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    const pageKey = document.body.dataset.page;
    if (pageKey) {
        document.querySelectorAll("[data-page-link]").forEach((link) => {
            if (link.getAttribute("data-page-link") === pageKey) {
                link.setAttribute("aria-current", "page");
            }
        });
    }

    const year = new Date().getFullYear();
    document.querySelectorAll("[data-year]").forEach((el) => {
        el.textContent = String(year);
    });

    const languageButtons = Array.from(document.querySelectorAll("[data-language-option]"));
    const brandMeaningElements = Array.from(document.querySelectorAll("[data-dpax-meaning]"));
    let dictionaries = null;
    let activeLanguage = DEFAULT_LANGUAGE;
    const selectedBrandMeaningIndex = Math.floor(Math.random() * BRAND_MEANINGS.length);

    const normalizeLanguage = (value) => {
        if (!value) {
            return DEFAULT_LANGUAGE;
        }

        const languageCode = value.toLowerCase().split("-")[0];
        return SUPPORTED_LANGUAGES.includes(languageCode) ? languageCode : DEFAULT_LANGUAGE;
    };

    const applyBrandMeaning = (language) => {
        if (!brandMeaningElements.length || !BRAND_MEANINGS.length) {
            return;
        }

        const normalizedLanguage = normalizeLanguage(language);
        const selectedMeaning = BRAND_MEANINGS[selectedBrandMeaningIndex] || BRAND_MEANINGS[0];
        const meaningText = selectedMeaning[normalizedLanguage] || selectedMeaning[DEFAULT_LANGUAGE];

        brandMeaningElements.forEach((element) => {
            element.textContent = meaningText;
            element.setAttribute("title", meaningText);
        });
    };

    const getStoredLanguage = () => {
        try {
            const storedLanguage = localStorage.getItem(STORAGE_KEY);
            if (!storedLanguage) {
                return null;
            }

            const languageCode = storedLanguage.toLowerCase().split("-")[0];
            if (!SUPPORTED_LANGUAGES.includes(languageCode)) {
                return null;
            }

            return languageCode;
        } catch (error) {
            return null;
        }
    };

    const storeLanguage = (language) => {
        try {
            localStorage.setItem(STORAGE_KEY, language);
        } catch (error) {
            // Ignore storage failures in private mode / restricted contexts.
        }
    };

    const getBrowserLanguage = () => {
        if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
            return normalizeLanguage(navigator.languages[0]);
        }

        return normalizeLanguage(navigator.language);
    };

    const getQueryLanguage = () => {
        try {
            const currentUrl = new URL(window.location.href);
            const queryLanguage = currentUrl.searchParams.get(URL_LANGUAGE_PARAM);
            if (!queryLanguage) {
                return null;
            }

            return normalizeLanguage(queryLanguage);
        } catch (error) {
            return null;
        }
    };

    const resolveInitialLanguage = () => {
        const queryLanguage = getQueryLanguage();
        if (queryLanguage) {
            return queryLanguage;
        }

        const storedLanguage = getStoredLanguage();
        return storedLanguage || getBrowserLanguage();
    };

    const updateLanguageButtons = (language) => {
        languageButtons.forEach((button) => {
            const buttonLanguage = normalizeLanguage(button.dataset.languageOption);
            const isActive = buttonLanguage === language;
            button.setAttribute("aria-pressed", String(isActive));
            button.classList.toggle("active", isActive);
        });
    };

    const toRelativeHref = (urlObject, originalHref) => {
        if (/^(?:[a-z]+:)?\/\//i.test(originalHref)) {
            return urlObject.toString();
        }

        const path = originalHref.split("#")[0].split("?")[0] || (window.location.pathname.split("/").pop() || "index.html");
        return `${path}${urlObject.search}${urlObject.hash}`;
    };

    const syncLanguageInInternalLinks = (language) => {
        document.querySelectorAll("a[href]").forEach((anchor) => {
            const href = anchor.getAttribute("href");
            if (!href || !/\.html(?:$|[?#])/i.test(href)) {
                return;
            }

            try {
                const hrefUrl = new URL(href, window.location.href);
                hrefUrl.searchParams.set(URL_LANGUAGE_PARAM, language);
                anchor.setAttribute("href", toRelativeHref(hrefUrl, href));
            } catch (error) {
                // Ignore malformed href values.
            }
        });
    };

    const syncLanguageInCurrentUrl = (language) => {
        try {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set(URL_LANGUAGE_PARAM, language);
            window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
        } catch (error) {
            // Ignore if URL or history APIs are unavailable.
        }
    };

    const getTranslation = (language, key) => {
        if (!dictionaries) {
            return null;
        }

        const languageDictionary = dictionaries[language] || {};
        const fallbackDictionary = dictionaries[DEFAULT_LANGUAGE] || {};

        if (Object.prototype.hasOwnProperty.call(languageDictionary, key)) {
            return languageDictionary[key];
        }

        if (Object.prototype.hasOwnProperty.call(fallbackDictionary, key)) {
            return fallbackDictionary[key];
        }

        return null;
    };

    const applyTextTranslations = (language) => {
        document.querySelectorAll("[data-i18n]").forEach((element) => {
            const key = element.dataset.i18n;
            const value = getTranslation(language, key);

            if (typeof value === "string") {
                element.textContent = value;
            }
        });
    };

    const applyAttributeTranslations = (language) => {
        const attrConfig = [
            { selector: "[data-i18n-aria-label]", datasetKey: "i18nAriaLabel", attribute: "aria-label" },
            { selector: "[data-i18n-title]", datasetKey: "i18nTitle", attribute: "title" },
            { selector: "[data-i18n-content]", datasetKey: "i18nContent", attribute: "content" },
            { selector: "[data-i18n-alt]", datasetKey: "i18nAlt", attribute: "alt" },
            { selector: "[data-i18n-placeholder]", datasetKey: "i18nPlaceholder", attribute: "placeholder" }
        ];

        attrConfig.forEach(({ selector, datasetKey, attribute }) => {
            document.querySelectorAll(selector).forEach((element) => {
                const key = element.dataset[datasetKey];
                const value = getTranslation(language, key);

                if (typeof value === "string") {
                    element.setAttribute(attribute, value);
                }
            });
        });
    };

    const applyLanguage = (language, { persist = true } = {}) => {
        const nextLanguage = normalizeLanguage(language);
        activeLanguage = nextLanguage;
        document.documentElement.lang = nextLanguage;
        syncLanguageInCurrentUrl(nextLanguage);
        syncLanguageInInternalLinks(nextLanguage);
        updateLanguageButtons(nextLanguage);
        applyBrandMeaning(nextLanguage);

        if (dictionaries) {
            applyTextTranslations(nextLanguage);
            applyAttributeTranslations(nextLanguage);
        }

        if (persist) {
            storeLanguage(nextLanguage);
        }
    };

    const bindLanguageSwitcher = () => {
        languageButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const requestedLanguage = button.dataset.languageOption;
                const normalizedLanguage = normalizeLanguage(requestedLanguage);

                if (normalizedLanguage !== activeLanguage) {
                    applyLanguage(normalizedLanguage);
                }
            });
        });
    };

    const initLocalization = async () => {
        bindLanguageSwitcher();
        const initialLanguage = resolveInitialLanguage();
        applyLanguage(initialLanguage, { persist: false });

        try {
            const response = await fetch(TRANSLATIONS_PATH);
            if (!response.ok) {
                throw new Error(`Failed to load translations: ${response.status}`);
            }

            dictionaries = await response.json();
            applyLanguage(activeLanguage, { persist: false });
        } catch (error) {
            console.error("Unable to load translation file.", error);
        }
    };

    const initLinkedInFeed = async () => {
        const postsContainer = document.querySelector("[data-linkedin-posts]");
        if (!postsContainer) {
            return;
        }

        const statusElement = document.querySelector("[data-linkedin-status]");
        const countElement = document.querySelector("[data-linkedin-post-count]");
        const emptyLabelElement = document.querySelector("[data-linkedin-empty-label]");
        const errorLabelElement = document.querySelector("[data-linkedin-error-label]");
        const linkLabelElement = document.querySelector("[data-linkedin-link-label]");

        const resolveText = (element, fallback) => {
            if (!element || typeof element.textContent !== "string") {
                return fallback;
            }

            const value = element.textContent.trim();
            return value || fallback;
        };

        const emptyMessage = resolveText(emptyLabelElement, "No original LinkedIn posts are available at the moment.");
        const errorMessage = resolveText(errorLabelElement, "Unable to load LinkedIn posts right now.");
        const linkLabel = resolveText(linkLabelElement, "View on LinkedIn");

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

        const createPostCard = (post) => {
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
                : "LinkedIn Post";
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
            link.textContent = linkLabel;
            card.append(link);

            return card;
        };

        try {
            const response = await fetch(LINKEDIN_POSTS_PATH, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`LinkedIn feed load failed: ${response.status}`);
            }

            const payload = await response.json();
            const allOriginalPosts = Array.isArray(payload.posts) ? payload.posts.filter(isValidPost) : [];
            const originalPosts = allOriginalPosts.slice(0, LINKEDIN_POSTS_LIMIT);

            postsContainer.innerHTML = "";
            setCount(originalPosts.length);

            if (!originalPosts.length) {
                setStatus(emptyMessage);
                return;
            }

            const fragment = document.createDocumentFragment();
            originalPosts.forEach((post) => {
                fragment.append(createPostCard(post));
            });

            postsContainer.append(fragment);
            setStatus("", { hidden: true });
        } catch (error) {
            console.error("Unable to load LinkedIn posts.", error);
            postsContainer.innerHTML = "";
            setCount(0);

            setStatus(errorMessage, { isError: true });
        }
    };

    if (languageButtons.length) {
        initLocalization();
    } else {
        document.documentElement.lang = normalizeLanguage(resolveInitialLanguage());
        applyBrandMeaning(DEFAULT_LANGUAGE);
    }

    initLinkedInFeed();

    const revealItems = document.querySelectorAll("[data-reveal]");
    if (!revealItems.length) {
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.2, rootMargin: "0px 0px -50px 0px" }
    );

    revealItems.forEach((item) => observer.observe(item));
})();
