(() => {
  const LABEL_PATTERNS = [
    /deep\s*research/i,
    /поглиблене\s+дослідження/i,
    /глибоке\s+дослідження/i,
    /глубокое\s+исследование/i,
    /hlbkovy\s+vyskum/i,
    /hloubkovy\s+vyzkum/i,
    /recherche\s+approfondie/i,
    /investigacion\s+profunda/i,
    /pesquisa\s+aprofundada/i,
    /pesquisa\s+profunda/i,
    /grundliche\s+recherche/i,
    /dog[lł]ebne\s+badanie/i
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
      element.getAttribute("data-state"),
      element.getAttribute("data-app-id"),
      element.getAttribute("data-connector-id"),
      element.getAttribute("data-tool"),
      element.getAttribute("data-value")
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
    if (/connector[_-]openai[_-]deep[_-]research/i.test(signature)) score += 120;
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
