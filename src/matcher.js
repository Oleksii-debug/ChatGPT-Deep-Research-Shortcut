(() => {
  const LABEL_PATTERNS = [
    /\bdeep\s*research\b/i,
    /\bпоглиблене\s+дослідження\b/i,
    /\bглибоке\s+дослідження\b/i,
    /\bглубокое\s+исследование\b/i,
    /\bhlbkovy\s+vyskum\b/i,
    /\bhloubkovy\s+vyzkum\b/i,
    /\brecherche\s+approfondie\b/i,
    /\binvestigacion\s+profunda\b/i,
    /\bpesquisa\s+aprofundada\b/i,
    /\bpesquisa\s+profunda\b/i,
    /\bgrundliche\s+recherche\b/i,
    /\bdog[lł]ebne\s+badanie\b/i
  ];

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isDeepResearchLabel(value) {
    const text = normalizeText(value);
    return LABEL_PATTERNS.some((pattern) => pattern.test(text));
  }

  function attributeSignature(element) {
    if (!element?.getAttribute) return "";
    return [
      element.getAttribute("data-testid"),
      element.getAttribute("id"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("name"),
      element.getAttribute("data-state")
    ]
      .filter(Boolean)
      .join(" ");
  }

  function accessibleText(element) {
    if (!element) return "";
    const ariaLabel = element.getAttribute?.("aria-label");
    if (ariaLabel) return normalizeText(ariaLabel);

    const labelledBy = element.getAttribute?.("aria-labelledby");
    if (labelledBy && element.ownerDocument) {
      const label = labelledBy
        .split(/\s+/)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent || "")
        .join(" ");
      if (label.trim()) return normalizeText(label);
    }

    return normalizeText(element.innerText || element.textContent || element.getAttribute?.("title"));
  }

  function scoreDeepResearchCandidate(element) {
    if (!element) return -1;

    const text = accessibleText(element);
    const signature = normalizeText(attributeSignature(element));
    let score = 0;

    if (isDeepResearchLabel(text)) score += 100;
    if (/deep[-_\s]*research/i.test(signature)) score += 90;
    if (/research/i.test(signature) && /deep/i.test(signature)) score += 60;

    const role = element.getAttribute?.("role") || "";
    if (["menuitem", "menuitemradio", "menuitemcheckbox", "option"].includes(role)) score += 20;
    if (element.tagName === "BUTTON") score += 15;
    if (element.tagName === "A") score += 5;
    if (element.hasAttribute?.("tabindex")) score += 5;

    return score;
  }

  function isSelected(element) {
    if (!element?.getAttribute) return false;
    return (
      element.getAttribute("aria-checked") === "true" ||
      element.getAttribute("aria-pressed") === "true" ||
      ["checked", "active", "selected", "on"].includes(element.getAttribute("data-state"))
    );
  }

  globalThis.ChatGPTDR = Object.freeze({
    LABEL_PATTERNS,
    normalizeText,
    isDeepResearchLabel,
    accessibleText,
    scoreDeepResearchCandidate,
    isSelected
  });
})();
