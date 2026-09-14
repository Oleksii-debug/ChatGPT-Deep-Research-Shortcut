(() => {
  const api = globalThis.ChatGPTDR;
  if (!api) {
    console.error("[ChatGPT Deep Research Shortcut] Matcher module did not load.");
    return;
  }

  const LOG_PREFIX = "[ChatGPT Deep Research Shortcut]";
  const PLUS_SELECTORS = [
    '[data-testid="composer-plus-btn"]',
    '#composer-plus-btn',
    'button[aria-label="Додати файли та інше"]',
    'button[aria-haspopup="menu"][aria-label*="файл" i]',
    'button[aria-haspopup="menu"][aria-label*="files" i]'
  ];
  const INTERACTIVE_SELECTOR = [
    '[role="menuitem"]',
    '[role="menuitemradio"]',
    '[role="menuitemcheckbox"]',
    '[role="option"]',
    'button',
    'a[href]',
    '[tabindex="0"]',
    '[data-testid*="research" i]',
    '[data-testid*="deep" i]',
    '[aria-label*="research" i]'
  ].join(',');

  let activationInProgress = false;

  function announce(message, assertive = true) {
    let region = document.getElementById('chatgpt-deep-research-shortcut-status');
    if (!region) {
      region = document.createElement('div');
      region.id = 'chatgpt-deep-research-shortcut-status';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
      region.setAttribute('aria-atomic', 'true');
      Object.assign(region.style, {
        position: 'fixed',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0'
      });
      document.documentElement.appendChild(region);
    }

    region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    region.textContent = '';
    window.setTimeout(() => {
      region.textContent = message;
    }, 30);
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return element.getClientRects().length > 0;
  }

  function findPlusButton() {
    for (const selector of PLUS_SELECTORS) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement && isVisible(element)) return element;
    }
    return null;
  }

  function toInteractiveElement(element) {
    if (!(element instanceof Element)) return null;
    if (element.matches(INTERACTIVE_SELECTOR)) return element;
    return element.closest(INTERACTIVE_SELECTOR);
  }

  function findDeepResearchCandidate() {
    const candidates = new Set(document.querySelectorAll(INTERACTIVE_SELECTOR));

    // Some implementations put the visible label in a child span while the
    // click target is the parent. Inspect short text-bearing nodes as a fallback.
    for (const element of document.querySelectorAll('span,div')) {
      const text = api.normalizeText(element.textContent);
      if (text.length > 0 && text.length < 120 && api.isDeepResearchLabel(text)) {
        const interactive = toInteractiveElement(element);
        if (interactive) candidates.add(interactive);
      }
    }

    return [...candidates]
      .filter(isVisible)
      .map((element) => ({ element, score: api.scoreDeepResearchCandidate(element) }))
      .filter(({ score }) => score >= 90)
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function waitForDeepResearchCandidate(timeoutMs = 4000) {
    const immediate = findDeepResearchCandidate();
    if (immediate) return Promise.resolve(immediate);

    return new Promise((resolve) => {
      let finished = false;
      const finish = (value) => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        window.clearInterval(pollId);
        window.clearTimeout(timeoutId);
        resolve(value);
      };

      const check = () => {
        const candidate = findDeepResearchCandidate();
        if (candidate) finish(candidate);
      };

      const observer = new MutationObserver(check);
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });

      const pollId = window.setInterval(check, 100);
      const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    });
  }

  function findComposer() {
    const selectors = [
      '#prompt-textarea',
      '[data-testid="composer-input"]',
      '[data-testid*="composer"][contenteditable="true"]',
      'textarea[placeholder]',
      '[contenteditable="true"][aria-label*="message" i]',
      '[contenteditable="true"][aria-label*="повідом" i]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement && isVisible(element)) return element;
    }
    return null;
  }

  function focusComposer() {
    const composer = findComposer();
    composer?.focus({ preventScroll: true });
  }

  function closeToolsMenuIfNeeded(plusButton) {
    if (plusButton?.getAttribute('aria-expanded') === 'true') {
      plusButton.click();
    }
  }

  async function activateDeepResearch() {
    if (activationInProgress) {
      announce('Активація поглибленого дослідження вже виконується.', false);
      return;
    }

    activationInProgress = true;
    try {
      const plusButton = findPlusButton();
      if (!plusButton) {
        announce('Не знайдено кнопку «Додати файли та інше» на сторінці ChatGPT.');
        console.warn(`${LOG_PREFIX} Composer plus button not found.`);
        return;
      }

      if (plusButton.getAttribute('aria-expanded') !== 'true') {
        plusButton.click();
      }

      const candidate = await waitForDeepResearchCandidate();
      if (!candidate) {
        announce('Меню відкрито, але пункт «Поглиблене дослідження» не знайдено. Можливо, ChatGPT змінив інтерфейс або функція недоступна в цьому чаті.');
        console.warn(`${LOG_PREFIX} Deep Research menu item not found.`);
        return;
      }

      const label = api.accessibleText(candidate) || 'Поглиблене дослідження';
      if (api.isSelected(candidate)) {
        closeToolsMenuIfNeeded(plusButton);
        focusComposer();
        announce(`${label} уже ввімкнено. Введіть запит і натисніть Enter.`);
        return;
      }

      candidate.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      candidate.click();

      await new Promise((resolve) => window.setTimeout(resolve, 180));
      focusComposer();
      announce(`Пункт ${label} вибрано. Введіть запит і натисніть Enter.`);
      console.info(`${LOG_PREFIX} Activated candidate:`, label);
    } catch (error) {
      console.error(`${LOG_PREFIX} Activation failed.`, error);
      announce('Не вдалося активувати поглиблене дослідження через помилку інтерфейсу ChatGPT.');
    } finally {
      activationInProgress = false;
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'ACTIVATE_DEEP_RESEARCH') {
      void activateDeepResearch();
    }
  });

  globalThis.ChatGPTDeepResearchShortcut = Object.freeze({ activateDeepResearch });
})();
