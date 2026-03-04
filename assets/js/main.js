(() => {
    const DEFAULT_LANGUAGE = "en";
    const SUPPORTED_LANGUAGES = ["en", "fr"];
    const STORAGE_KEY = "dpax-language";
    const URL_LANGUAGE_PARAM = "lang";
    const TRANSLATIONS_PATH = "assets/i18n/translations.json";
    const ICONS_PATH = "assets/images/svg-icons.json";

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
    let dictionariesPromise = null;
    let activeLanguage = DEFAULT_LANGUAGE;
    let iconCatalog = null;

    const normalizeIconKey = (value) => String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const getIconCatalog = async () => {
        if (iconCatalog) {
            return iconCatalog;
        }

        try {
            const response = await fetch(ICONS_PATH);
            if (!response.ok) {
                throw new Error(`Failed to load icon catalog: ${response.status}`);
            }

            const payload = await response.json();
            const icons = payload && Array.isArray(payload.icons) ? payload.icons : [];
            const nextCatalog = new Map();

            icons.forEach((icon) => {
                if (!icon || typeof icon !== "object" || typeof icon.svg !== "string") {
                    return;
                }

                const key = normalizeIconKey(icon.id || icon.name || icon.label);
                if (!key) {
                    return;
                }

                nextCatalog.set(key, icon.svg);
            });

            iconCatalog = nextCatalog;
        } catch (error) {
            console.error("Unable to load icon catalog.", error);
            iconCatalog = new Map();
        }

        return iconCatalog;
    };

    const normalizeSvgForRendering = (svgElement) => {
        if (!(svgElement instanceof SVGElement)) {
            return;
        }

        const viewBox = svgElement.getAttribute("viewBox");
        let fallbackWidth = 24;
        let fallbackHeight = 24;

        if (typeof viewBox === "string") {
            const parts = viewBox.trim().split(/\s+/).map((value) => Number.parseFloat(value));
            if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
                fallbackWidth = Math.abs(parts[2]) || 24;
                fallbackHeight = Math.abs(parts[3]) || 24;
            }
        }

        svgElement.querySelectorAll("clipPath rect").forEach((rect) => {
            if (!rect.hasAttribute("width")) {
                rect.setAttribute("width", String(fallbackWidth));
            }
            if (!rect.hasAttribute("height")) {
                rect.setAttribute("height", String(fallbackHeight));
            }
        });
    };

    const applyIconMarkup = (target, svgMarkup) => {
        target.innerHTML = svgMarkup;

        const svgElement = target.querySelector("svg");
        if (!svgElement) {
            target.classList.add("icon-missing");
            return;
        }

        svgElement.classList.add("site-icon");
        normalizeSvgForRendering(svgElement);

        const iconClass = target.dataset.iconClass;
        if (iconClass) {
            iconClass.split(/\s+/).filter(Boolean).forEach((className) => {
                svgElement.classList.add(className);
            });
        }

        const iconSize = Number.parseFloat(target.dataset.iconSize || "");
        if (Number.isFinite(iconSize) && iconSize > 0) {
            svgElement.setAttribute("width", String(iconSize));
            svgElement.setAttribute("height", String(iconSize));
        }

        const iconLabel = (target.dataset.iconLabel || "").trim();
        if (iconLabel) {
            svgElement.setAttribute("role", "img");
            svgElement.setAttribute("aria-label", iconLabel);
            svgElement.removeAttribute("aria-hidden");
        } else {
            svgElement.setAttribute("aria-hidden", "true");
            svgElement.removeAttribute("role");
            svgElement.removeAttribute("aria-label");
        }

        target.classList.add("icon-ready");
    };

    const initIcons = async () => {
        const iconTargets = Array.from(document.querySelectorAll("[data-icon]"));
        if (!iconTargets.length) {
            return;
        }

        const catalog = await getIconCatalog();
        iconTargets.forEach((target) => {
            const requestedKey = normalizeIconKey(target.dataset.icon);
            if (!requestedKey) {
                target.classList.add("icon-missing");
                return;
            }

            const svgMarkup = catalog.get(requestedKey);
            if (!svgMarkup) {
                target.classList.add("icon-missing");
                return;
            }

            applyIconMarkup(target, svgMarkup);
        });
    };

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

    const loadDictionaries = async () => {
        if (dictionaries) {
            return dictionaries;
        }

        if (!dictionariesPromise) {
            dictionariesPromise = fetch(TRANSLATIONS_PATH)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to load translations: ${response.status}`);
                    }
                    return response.json();
                })
                .then((payload) => {
                    dictionaries = payload;
                    return dictionaries;
                })
                .catch((error) => {
                    console.error("Unable to load translation file.", error);
                    throw error;
                })
                .finally(() => {
                    if (!dictionaries) {
                        dictionariesPromise = null;
                    }
                });
        }

        return dictionariesPromise;
    };

    const applyLanguage = (language, { persist = true, syncLinks = true, syncUrl = true } = {}) => {
        const nextLanguage = normalizeLanguage(language);
        activeLanguage = nextLanguage;
        document.documentElement.lang = nextLanguage;
        if (syncUrl) {
            syncLanguageInCurrentUrl(nextLanguage);
        }
        if (syncLinks) {
            syncLanguageInInternalLinks(nextLanguage);
        }
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

    const requestLanguageSwitch = async (requestedLanguage) => {
        const normalizedLanguage = normalizeLanguage(requestedLanguage);
        if (normalizedLanguage === activeLanguage) {
            return;
        }

        if (normalizedLanguage !== DEFAULT_LANGUAGE && !dictionaries) {
            try {
                await loadDictionaries();
            } catch (error) {
                return;
            }
        }

        applyLanguage(normalizedLanguage);
    };

    const bindLanguageSwitcher = () => {
        languageButtons.forEach((button) => {
            button.addEventListener("click", () => {
                void requestLanguageSwitch(button.dataset.languageOption);
            });
        });
    };

    const initLocalization = async () => {
        bindLanguageSwitcher();
        const initialLanguage = resolveInitialLanguage();
        // Avoid mutating every internal link during first paint.
        applyLanguage(initialLanguage, { syncLinks: false });

        if (initialLanguage === DEFAULT_LANGUAGE) {
            return;
        }

        try {
            await loadDictionaries();
            applyLanguage(activeLanguage, { persist: false, syncLinks: false, syncUrl: false });
        } catch (error) {
            // Logging is handled in loadDictionaries.
        }
    };

    const init = async () => {
        if (languageButtons.length) {
            await initLocalization();
        } else {
            document.documentElement.lang = normalizeLanguage(resolveInitialLanguage());
        }

        // Defer heavier DOM work to idle time to reduce first-load main-thread pressure.
        const runDeferredUiWork = () => {
            void initIcons();
        };
        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(runDeferredUiWork, { timeout: 1200 });
        } else {
            window.setTimeout(runDeferredUiWork, 0);
        }
    };

    init();
})();
