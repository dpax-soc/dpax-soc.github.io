(() => {
    const DEFAULT_LANGUAGE = "en";
    const SUPPORTED_LANGUAGES = ["en", "fr"];
    const STORAGE_KEY = "dpax-language";
    const URL_LANGUAGE_PARAM = "lang";
    const TRANSLATIONS_PATH = "assets/i18n/translations.json";
    const LINKEDIN_POSTS_PATH = "assets/data/linkedin-posts.json";
    const LINKEDIN_POSTS_LIMIT = 20;

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
    let dictionaries = null;
    let activeLanguage = DEFAULT_LANGUAGE;

    const normalizeLanguage = (value) => {
        if (!value) {
            return DEFAULT_LANGUAGE;
        }

        const languageCode = value.toLowerCase().split("-")[0];
        return SUPPORTED_LANGUAGES.includes(languageCode) ? languageCode : DEFAULT_LANGUAGE;
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

    const getTranslationOrEmpty = (key) => {
        const value = getTranslation(activeLanguage, key);
        return typeof value === "string" ? value : "";
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

        if (dictionaries) {
            applyTextTranslations(nextLanguage);
            applyAttributeTranslations(nextLanguage);
        }

        window.dispatchEvent(new CustomEvent("dpax:language-changed", { detail: { language: nextLanguage } }));

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
        applyLanguage(initialLanguage);

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

        const emptyMessage = resolveText(emptyLabelElement, getTranslationOrEmpty("blog.feed.empty"));
        const errorMessage = resolveText(errorLabelElement, getTranslationOrEmpty("blog.feed.error"));
        const linkLabel = resolveText(linkLabelElement, getTranslationOrEmpty("blog.feed.linkCta"));
        const postTitleFallback = getTranslationOrEmpty("blog.feed.postFallbackTitle");

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
                : postTitleFallback;
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

    const initRoiEstimator = () => {
        const estimator = document.querySelector("[data-roi-estimator]");
        if (!estimator) {
            return;
        }

        const hourlyRevenueInput = estimator.querySelector("[data-roi-input='hourlyRevenue']");
        const useCaseSelect = estimator.querySelector("[data-roi-input='useCase']");
        const incidentHoursInput = estimator.querySelector("[data-roi-input='incidentHours']");
        const recoveryCostInput = estimator.querySelector("[data-roi-input='recoveryCost']");
        const useCaseDetailsElement = estimator.querySelector("[data-roi-use-case-details]");

        const totalCostOutput = document.querySelector("[data-roi-output='totalCost']");
        const avoid30Output = document.querySelector("[data-roi-output='avoid30']");
        const avoid50Output = document.querySelector("[data-roi-output='avoid50']");

        if (
            !hourlyRevenueInput
            || !useCaseSelect
            || !incidentHoursInput
            || !recoveryCostInput
            || !totalCostOutput
            || !avoid30Output
            || !avoid50Output
        ) {
            return;
        }

        const parsePositiveNumber = (value) => {
            if (typeof value !== "string") {
                return 0;
            }

            const normalized = value.replace(",", ".").trim();
            const parsed = Number.parseFloat(normalized);
            if (!Number.isFinite(parsed) || parsed < 0) {
                return 0;
            }

            return parsed;
        };

        const formatCurrency = (value) => {
            const locale = activeLanguage === "fr" ? "fr-FR" : "en-US";
            return new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0
            }).format(value);
        };

        const useCaseProfiles = {
            ransomware: { incidentHours: 24, recoveryCost: 15000 },
            phishing: { incidentHours: 6, recoveryCost: 4000 },
            bec: { incidentHours: 12, recoveryCost: 10000 }
        };

        const getCurrentProfile = () => {
            const selectedUseCase = useCaseSelect.value;
            if (Object.prototype.hasOwnProperty.call(useCaseProfiles, selectedUseCase)) {
                return useCaseProfiles[selectedUseCase];
            }
            return useCaseProfiles.ransomware;
        };

        const syncUseCaseFields = () => {
            const { incidentHours, recoveryCost } = getCurrentProfile();
            incidentHoursInput.value = String(incidentHours);
            recoveryCostInput.value = String(recoveryCost);

            if (useCaseDetailsElement) {
                const downtimeLabel = getTranslationOrEmpty("home.estimator.useCase.detailsDowntime")
                    || (activeLanguage === "fr" ? "Hypothèse d'interruption" : "Downtime assumption");
                const recoveryLabel = getTranslationOrEmpty("home.estimator.useCase.detailsRecovery")
                    || (activeLanguage === "fr" ? "Hypothèse de coût de reprise" : "Recovery cost assumption");
                useCaseDetailsElement.textContent = `${downtimeLabel}: ${incidentHours} h | ${recoveryLabel}: ${formatCurrency(recoveryCost)}`;
            }
        };

        const recalculate = () => {
            const hourlyRevenue = parsePositiveNumber(hourlyRevenueInput.value);
            const { incidentHours, recoveryCost } = getCurrentProfile();

            const totalCost = (hourlyRevenue * incidentHours) + recoveryCost;
            const avoid30 = totalCost * 0.3;
            const avoid50 = totalCost * 0.5;

            totalCostOutput.textContent = formatCurrency(totalCost);
            avoid30Output.textContent = formatCurrency(avoid30);
            avoid50Output.textContent = formatCurrency(avoid50);
        };

        hourlyRevenueInput.addEventListener("input", recalculate);
        hourlyRevenueInput.addEventListener("blur", () => {
            const nextValue = parsePositiveNumber(hourlyRevenueInput.value);
            hourlyRevenueInput.value = String(Math.round(nextValue));
            recalculate();
        });

        useCaseSelect.addEventListener("change", () => {
            syncUseCaseFields();
            recalculate();
        });

        window.addEventListener("dpax:language-changed", () => {
            syncUseCaseFields();
            recalculate();
        });

        syncUseCaseFields();
        recalculate();
    };

    const initReveal = () => {
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
    };

    const init = async () => {
        if (languageButtons.length) {
            await initLocalization();
        } else {
            document.documentElement.lang = normalizeLanguage(resolveInitialLanguage());
        }

        await initLinkedInFeed();
        initRoiEstimator();
        initReveal();
    };

    init();
})();
