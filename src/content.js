(() => {
  const api = globalThis.ChatGPTToolPicker;
  if (!api) {
    console.error('[ChatGPT Tool Picker] Matcher module did not load.');
    return;
  }

  const LOG_PREFIX = '[ChatGPT Tool Picker]';
  const PICKER_ID = 'chatgpt-tool-picker-dialog';
  const STATUS_ID = 'chatgpt-tool-picker-status';
  const TOOL_ORDER = ['image', 'web', 'research'];
  const OPEN_DEDUPE_MS = 350;

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
    '[tabindex]'
  ].join(',');

  let activationInProgress = false;
  let focusBeforePicker = null;
  let lastOpenRequestAt = 0;

  function announce(message, assertive = true) {
    let region = document.getElementById(STATUS_ID);
    if (!region) {
      region = document.createElement('div');
      region.id = STATUS_ID;
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

  function findComposer() {
    const selectors = [
      '#prompt-textarea',
      '[data-testid="composer-input"]',
      '[data-testid*="composer"][contenteditable="true"]',
      'textarea[placeholder]',
      '[contenteditable="true"][aria-label*="message" i]',
      '[contenteditable="true"][aria-label*="повідом" i]',
      '[contenteditable="true"][aria-label*="ChatGPT" i]'
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

  function isInOpenPopup(element) {
    if (!(element instanceof Element)) return false;
    const popup = element.closest('[role="menu"], [role="listbox"], [popover], [data-state="open"]');
    if (!(popup instanceof Element)) return false;
    return isVisible(popup);
  }

  function toInteractiveElement(element) {
    if (!(element instanceof Element)) return null;
    if (element.matches(INTERACTIVE_SELECTOR)) return element;
    return element.closest(INTERACTIVE_SELECTOR);
  }

  function findToolCandidate(toolId, baseline = null) {
    const candidates = new Set(document.querySelectorAll(INTERACTIVE_SELECTOR));

    for (const element of document.querySelectorAll('span,div')) {
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 180) continue;
      if (api.isToolLabel(toolId, text) || api.isToolDescription(toolId, text)) {
        const interactive = toInteractiveElement(element);
        if (interactive) candidates.add(interactive);
      }
    }

    return [...candidates]
      .filter(isVisible)
      .filter((element) => !baseline || !baseline.has(element) || isInOpenPopup(element))
      .map((element) => ({ element, score: api.scoreToolCandidate(toolId, element) }))
      .filter(({ score }) => score >= 100)
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function waitForToolCandidate(toolId, baseline, timeoutMs = 4500) {
    const immediate = findToolCandidate(toolId, baseline);
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
        const candidate = findToolCandidate(toolId, baseline);
        if (candidate) finish(candidate);
      };

      const observer = new MutationObserver(check);
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['role', 'data-state', 'aria-hidden', 'aria-expanded']
      });

      const pollId = window.setInterval(check, 100);
      const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    });
  }

  function dispatchRobustClick(element) {
    if (!(element instanceof HTMLElement)) return;
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    element.focus?.({ preventScroll: true });
    element.click();
  }

  async function activateTool(toolId) {
    const tool = api.getTool(toolId);
    if (!tool) return;

    if (activationInProgress) {
      announce('Попередня команда ще виконується.', false);
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

      const baseline = new Set(document.querySelectorAll(INTERACTIVE_SELECTOR));
      if (plusButton.getAttribute('aria-expanded') !== 'true') {
        dispatchRobustClick(plusButton);
      }

      const candidate = await waitForToolCandidate(toolId, baseline);
      if (!candidate) {
        announce(`Меню відкрито, але пункт «${tool.label}» не знайдено. Інтерфейс ChatGPT міг змінитися.`);
        console.warn(`${LOG_PREFIX} Tool not found in the opened popup:`, toolId);
        return;
      }

      if (api.isSelected(candidate)) {
        if (plusButton.getAttribute('aria-expanded') === 'true') dispatchRobustClick(plusButton);
        focusComposer();
        announce(`${tool.label} уже ввімкнено. Введіть запит і натисніть Enter.`);
        return;
      }

      dispatchRobustClick(candidate);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      focusComposer();
      announce(`${tool.label} вибрано. Введіть запит і натисніть Enter.`);
      console.info(`${LOG_PREFIX} Activated:`, toolId, api.accessibleText(candidate));
    } catch (error) {
      console.error(`${LOG_PREFIX} Activation failed for ${toolId}.`, error);
      announce(`Не вдалося активувати «${tool.label}» через помилку інтерфейсу ChatGPT.`);
    } finally {
      activationInProgress = false;
    }
  }

  function getPickerButtons(dialog) {
    return [...dialog.querySelectorAll('[data-chatgpt-tool-id]')];
  }

  function closePicker({ restoreFocus = true } = {}) {
    const dialog = document.getElementById(PICKER_ID);
    if (!dialog) return;
    dialog.remove();

    if (restoreFocus) {
      const target = focusBeforePicker instanceof HTMLElement && document.contains(focusBeforePicker)
        ? focusBeforePicker
        : findComposer();
      target?.focus({ preventScroll: true });
    }
  }

  function movePickerFocus(dialog, delta) {
    const buttons = getPickerButtons(dialog);
    if (!buttons.length) return;
    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement));
    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  }

  function trapTab(dialog, event) {
    const buttons = getPickerButtons(dialog);
    if (!buttons.length) return;
    const currentIndex = buttons.indexOf(document.activeElement);
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      buttons[buttons.length - 1].focus();
    } else if (!event.shiftKey && currentIndex === buttons.length - 1) {
      event.preventDefault();
      buttons[0].focus();
    }
  }

  function createPicker() {
    const existing = document.getElementById(PICKER_ID);
    if (existing) return existing;

    focusBeforePicker = document.activeElement instanceof HTMLElement ? document.activeElement : findComposer();

    const dialog = document.createElement('div');
    dialog.id = PICKER_ID;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', `${PICKER_ID}-title`);
    dialog.setAttribute('aria-describedby', `${PICKER_ID}-description`);
    Object.assign(dialog.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.55)',
      padding: '16px',
      boxSizing: 'border-box'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: 'min(560px, calc(100vw - 32px))',
      maxHeight: 'min(90vh, calc(100dvh - 32px))',
      overflow: 'auto',
      background: 'Canvas',
      color: 'CanvasText',
      border: '2px solid ButtonText',
      borderRadius: '12px',
      padding: '20px',
      boxSizing: 'border-box',
      boxShadow: '0 12px 40px rgba(0,0,0,.35)'
    });

    const title = document.createElement('h2');
    title.id = `${PICKER_ID}-title`;
    title.textContent = 'Оберіть інструмент ChatGPT';
    title.style.margin = '0 0 8px';

    const description = document.createElement('p');
    description.id = `${PICKER_ID}-description`;
    description.textContent = 'Стрілки вгору і вниз або Tab — вибір. Enter — запустити. Escape — закрити.';
    description.style.margin = '0 0 16px';

    const list = document.createElement('div');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'Доступні інструменти');
    Object.assign(list.style, { display: 'grid', gap: '10px' });

    for (const toolId of TOOL_ORDER) {
      const tool = api.getTool(toolId);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.chatgptToolId = toolId;
      button.setAttribute('aria-label', `${tool.label}. ${tool.description}`);
      Object.assign(button.style, {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '14px 16px',
        border: '1px solid ButtonText',
        borderRadius: '8px',
        background: 'ButtonFace',
        color: 'ButtonText',
        font: 'inherit',
        cursor: 'pointer'
      });

      const label = document.createElement('strong');
      label.textContent = tool.label;
      label.style.display = 'block';

      const detail = document.createElement('span');
      detail.textContent = tool.description;
      detail.style.display = 'block';
      detail.style.marginTop = '4px';

      button.append(label, detail);
      button.addEventListener('click', () => {
        closePicker({ restoreFocus: false });
        void activateTool(toolId);
      });
      list.appendChild(button);
    }

    panel.append(title, description, list);
    dialog.appendChild(panel);

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePicker();
        announce('Вибір інструмента закрито.', false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        movePickerFocus(dialog, 1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        movePickerFocus(dialog, -1);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        getPickerButtons(dialog)[0]?.focus();
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        const buttons = getPickerButtons(dialog);
        buttons[buttons.length - 1]?.focus();
        return;
      }
      if (event.key === 'Tab') trapTab(dialog, event);
    });

    dialog.addEventListener('mousedown', (event) => {
      if (event.target === dialog) closePicker();
    });

    document.body.appendChild(dialog);
    return dialog;
  }

  function openPicker() {
    const dialog = createPicker();
    const firstButton = getPickerButtons(dialog)[0];
    window.setTimeout(() => firstButton?.focus({ preventScroll: true }), 0);
    announce('Оберіть інструмент ChatGPT: Створити зображення, Пошук в Інтернеті або Глибоке дослідження.', false);
  }

  function requestOpenPicker(source = 'unknown') {
    const existing = document.getElementById(PICKER_ID);
    if (existing) {
      const focusedButton = existing.querySelector('[data-chatgpt-tool-id]:focus');
      const firstButton = getPickerButtons(existing)[0];
      (focusedButton || firstButton)?.focus({ preventScroll: true });
      return;
    }

    const now = Date.now();
    if (now - lastOpenRequestAt < OPEN_DEDUPE_MS) return;
    lastOpenRequestAt = now;
    console.debug(`${LOG_PREFIX} Opening picker from ${source}.`);
    openPicker();
  }

  document.addEventListener('keydown', (event) => {
    if (!api.isPickerShortcutEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    requestOpenPicker('page-keydown');
  }, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'OPEN_TOOL_PICKER') requestOpenPicker('extension-command');
  });

  globalThis.ChatGPTAccessibleToolPicker = Object.freeze({
    openPicker: requestOpenPicker,
    closePicker,
    activateTool
  });
})();
