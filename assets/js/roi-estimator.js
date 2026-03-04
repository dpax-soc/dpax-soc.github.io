(() => {
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

    const normalizeLanguage = (value) => {
        const languageCode = String(value || "en").toLowerCase().split("-")[0];
        return languageCode === "fr" ? "fr" : "en";
    };

    let activeLanguage = normalizeLanguage(document.documentElement.lang);

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

    const getLabel = (translationKey, fallbackEn, fallbackFr) => {
        const element = document.querySelector(`[data-i18n="${translationKey}"]`);
        const value = element && typeof element.textContent === "string"
            ? element.textContent.trim()
            : "";

        if (value) {
            return value;
        }

        return activeLanguage === "fr" ? fallbackFr : fallbackEn;
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
            const downtimeLabel = getLabel(
                "home.estimator.useCase.detailsDowntime",
                "Downtime assumption",
                "Hypothèse d'interruption"
            );
            const recoveryLabel = getLabel(
                "home.estimator.useCase.detailsRecovery",
                "Recovery cost assumption",
                "Hypothèse de coût de reprise"
            );
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

    window.addEventListener("dpax:language-changed", (event) => {
        activeLanguage = normalizeLanguage(event.detail && event.detail.language);
        syncUseCaseFields();
        recalculate();
    });

    syncUseCaseFields();
    recalculate();
})();
