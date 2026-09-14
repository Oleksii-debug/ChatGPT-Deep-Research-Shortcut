(() => {
  const TOOL_DEFINITIONS = Object.freeze({
    image: Object.freeze({
      id: 'image',
      label: 'Створити зображення',
      description: 'Візуалізуйте все',
      labels: [
        'Створити зображення',
        'Create image',
        'Create an image',
        'Generate image',
        'Generate an image'
      ],
      descriptions: ['Візуалізуйте все', 'Visualize anything'],
      signaturePatterns: [
        /create[-_\s]*image/i,
        /generate[-_\s]*image/i,
        /image[-_\s]*generation/i
      ],
      selectionPatterns: [
        /^image_gen$/i,
        /image[-_\s]*gen(?:eration)?/i
      ]
    }),
    web: Object.freeze({
      id: 'web',
      label: 'Пошук в Інтернеті',
      description: 'Знаходьте актуальні новини й інформацію',
      labels: [
        'Пошук в Інтернеті',
        'Пошук в інтернеті',
        'Search the web',
        'Web search'
      ],
      descriptions: [
        'Знаходьте актуальні новини й інформацію',
        'Find current news and information'
      ],
      signaturePatterns: [
        /search[-_\s]*(the[-_\s]*)?web/i,
        /web[-_\s]*search/i
      ],
      selectionPatterns: [
        /^search$/i,
        /web[-_\s]*search/i
      ]
    }),
    research: Object.freeze({
      id: 'research',
      label: 'Глибоке дослідження',
      description: 'Отримати докладний звіт',
      labels: [
        'Глибоке дослідження',
        'Поглиблене дослідження',
        'Deep research',
        'Глубокое исследование',
        'Hĺbkový výskum',
        'Hloubkový výzkum',
        'Recherche approfondie',
        'Investigación profunda',
        'Gründliche Recherche'
      ],
      descriptions: ['Отримати докладний звіт', 'Get a detailed report'],
      signaturePatterns: [
        /connector[_-]openai[_-]deep[_-]research/i,
        /deep[-_\s]*research/i
      ],
      selectionPatterns: [
        /^(?:plugin:)?connector_openai_deep_research$/i,
        /^connector:connector_openai_deep_research$/i,
        /connector[_:-]openai[_-]deep[_-]research/i,
        /deep[-_\s]*research/i
      ]
    })
  });

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function getTool(toolId) {
    return TOOL_DEFINITIONS[toolId] || null;
  }

  function textMatchesAny(value, candidates) {
    const normalized = normalizeText(value);
    if (!normalized) return false;
    return candidates.some((candidate) => {
      const expected = normalizeText(candidate);
      return normalized === expected || normalized.startsWith(`${expected} `);
    });
  }

  function isToolLabel(toolId, value) {
    const tool = getTool(toolId);
    return !!tool && textMatchesAny(value, tool.labels);
  }

  function isToolDescription(toolId, value) {
    const tool = getTool(toolId);
    return !!tool && textMatchesAny(value, tool.descriptions);
  }

  function isPickerShortcutEvent(event) {
    if (!event) return false;
    const physicalU = event.code === 'KeyU';
    const textualU = String(event.key || '').toLowerCase() === 'u';
    return Boolean(
      event.ctrlKey &&
      event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.repeat &&
      (physicalU || textualU)
    );
  }

  function isDiagnosticsShortcutEvent(event) {
    if (!event) return false;
    const physicalD = event.code === 'KeyD';
    const textualD = String(event.key || '').toLowerCase() === 'd';
    return Boolean(
      event.ctrlKey &&
      event.shiftKey &&
      event.altKey &&
      !event.metaKey &&
      !event.repeat &&
      (physicalD || textualD)
    );
  }

  function attributeSignature(element) {
    if (!element?.getAttribute) return '';
    return [
      element.getAttribute('data-testid'),
      element.getAttribute('id'),
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.getAttribute('data-state'),
      element.getAttribute('data-app-id'),
      element.getAttribute('data-connector-id'),
      element.getAttribute('data-tool'),
      element.getAttribute('data-value')
    ]
      .filter(Boolean)
      .join(' ');
  }

  function accessibleText(element) {
    if (!element) return '';
    const ariaLabel = element.getAttribute?.('aria-label');
    if (ariaLabel) return String(ariaLabel).replace(/\s+/g, ' ').trim();

    const labelledBy = element.getAttribute?.('aria-labelledby');
    if (labelledBy && element.ownerDocument) {
      const label = labelledBy
        .split(/\s+/)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (label) return label;
    }

    return String(element.innerText || element.textContent || element.getAttribute?.('title') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scoreToolCandidate(toolId, element) {
    const tool = getTool(toolId);
    if (!tool || !element) return -1;

    const text = accessibleText(element);
    const signature = attributeSignature(element);
    let score = 0;

    if (isToolLabel(toolId, text)) score += 120;
    if (isToolDescription(toolId, text)) score += 80;
    if (tool.signaturePatterns.some((pattern) => pattern.test(signature))) score += 110;

    const normalizedText = normalizeText(text);
    const combinedLabel = tool.labels.find((label) =>
      normalizedText.includes(normalizeText(label))
    );
    if (combinedLabel) score += 40;

    const role = element.getAttribute?.('role') || '';
    if (['menuitem', 'menuitemradio', 'menuitemcheckbox', 'option'].includes(role)) score += 20;
    if (element.tagName === 'BUTTON') score += 15;
    if (element.tagName === 'A') score += 5;
    if (element.hasAttribute?.('tabindex')) score += 5;

    return score;
  }


  function selectionMetadataValues(element) {
    if (!element?.getAttribute) return [];
    return [
      element.getAttribute('data-id'),
      element.getAttribute('data-system-hint-type'),
      element.getAttribute('data-keyword'),
      element.getAttribute('data-symbol'),
      element.getAttribute('data-tool'),
      element.getAttribute('data-value'),
      element.getAttribute('aria-label'),
      element.getAttribute('title')
    ].filter(Boolean);
  }

  function hasInlineSelectionIdentity(element) {
    if (!element?.getAttribute) return false;
    return (
      element.hasAttribute?.('data-inline-selection-pill') ||
      normalizeText(element.getAttribute('data-symbol')) === 'ecosystemmention'
    );
  }

  function matchesToolSelectionIdentity(toolId, element) {
    const tool = getTool(toolId);
    if (!tool || !element?.getAttribute) return false;

    const values = selectionMetadataValues(element);
    const text = accessibleText(element);
    if (text) values.push(text);

    return values.some((value) => {
      if (isToolLabel(toolId, value) || isToolDescription(toolId, value)) return true;
      return (tool.selectionPatterns || []).some((pattern) => pattern.test(String(value)));
    });
  }

  function isToolSelectionPill(toolId, element) {
    return hasInlineSelectionIdentity(element) && matchesToolSelectionIdentity(toolId, element);
  }

  function isSelected(element) {
    if (!element?.getAttribute) return false;
    return (
      element.getAttribute('aria-checked') === 'true' ||
      element.getAttribute('aria-pressed') === 'true' ||
      ['checked', 'active', 'selected', 'on'].includes(element.getAttribute('data-state'))
    );
  }

  globalThis.ChatGPTToolPicker = Object.freeze({
    TOOL_DEFINITIONS,
    normalizeText,
    getTool,
    isToolLabel,
    isToolDescription,
    isPickerShortcutEvent,
    isDiagnosticsShortcutEvent,
    accessibleText,
    scoreToolCandidate,
    selectionMetadataValues,
    hasInlineSelectionIdentity,
    matchesToolSelectionIdentity,
    isToolSelectionPill,
    isSelected
  });
})();
