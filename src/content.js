(() => {
  const api = globalThis.ChatGPTToolPicker;
  if (!api) {
    console.error('[ChatGPT Tool Picker] Matcher module did not load.');
    return;
  }

  const VERSION = '0.4.0';
  const LOG_PREFIX = '[ChatGPT Tool Picker]';
  const PICKER_ID = 'chatgpt-tool-picker-dialog';
  const STATUS_ID = 'chatgpt-tool-picker-status';
  const OWNED_ATTR = 'data-chatgpt-tool-picker-owned';
  const TOOL_ORDER = ['image', 'web', 'research'];
  const OPEN_DEDUPE_MS = 350;
  const VERIFY_TIMEOUT_MS = 6000;
  const HEARTBEAT_MS = 1000;
  const MAX_DIAGNOSTIC_EVENTS = 600;

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
  let diagnosticSession = createDiagnosticSession('page-load', null);
  let diagnosticHeartbeatId = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function createDiagnosticSession(reason, toolId) {
    const startedAt = Date.now();
    return {
      version: VERSION,
      sessionId: `${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
      reason,
      toolId,
      startedAt,
      startedAtIso: new Date(startedAt).toISOString(),
      events: []
    };
  }

  function resetDiagnostics(reason, toolId = null) {
    stopDiagnosticHeartbeat();
    diagnosticSession = createDiagnosticSession(reason, toolId);
    recordDiagnostic('session-start', {
      url: location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        fullscreen: Boolean(document.fullscreenElement)
      },
      visibilityState: document.visibilityState
    });
  }

  function sanitizeDiagnosticValue(value) {
    if (value == null) return value;
    if (typeof value === 'string') return value.slice(0, 240);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeDiagnosticValue);
    if (typeof value === 'object') {
      const safe = {};
      for (const [key, item] of Object.entries(value)) {
        safe[key] = sanitizeDiagnosticValue(item);
      }
      return safe;
    }
    return String(value).slice(0, 240);
  }

  function recordDiagnostic(event, details = {}) {
    if (!diagnosticSession) diagnosticSession = createDiagnosticSession('implicit', null);
    const entry = {
      at: nowIso(),
      elapsedMs: Date.now() - diagnosticSession.startedAt,
      event,
      details: sanitizeDiagnosticValue(details)
    };
    diagnosticSession.events.push(entry);
    if (diagnosticSession.events.length > MAX_DIAGNOSTIC_EVENTS) {
      diagnosticSession.events.splice(0, diagnosticSession.events.length - MAX_DIAGNOSTIC_EVENTS);
    }
    console.debug(`${LOG_PREFIX} diagnostic`, entry);
  }

  function startDiagnosticHeartbeat(toolId) {
    stopDiagnosticHeartbeat();
    recordDiagnostic('heartbeat', captureSafeState(toolId));
    diagnosticHeartbeatId = window.setInterval(() => {
      recordDiagnostic('heartbeat', captureSafeState(toolId));
    }, HEARTBEAT_MS);
  }

  function stopDiagnosticHeartbeat() {
    if (diagnosticHeartbeatId != null) {
      window.clearInterval(diagnosticHeartbeatId);
      diagnosticHeartbeatId = null;
    }
  }

  function safeElementSummary(element) {
    if (!(element instanceof Element)) return null;
    const text = api.accessibleText(element);
    const matchedTool = TOOL_ORDER.find((toolId) =>
      api.isToolLabel(toolId, text) || api.isToolDescription(toolId, text)
    );
    return {
      tag: element.tagName?.toLowerCase() || '',
      role: element.getAttribute('role') || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      dataTestId: element.getAttribute('data-testid') || '',
      dataState: element.getAttribute('data-state') || '',
      ariaChecked: element.getAttribute('aria-checked') || '',
      ariaPressed: element.getAttribute('aria-pressed') || '',
      matchedTool: matchedTool || '',
      matchedAccessibleText: matchedTool ? text.slice(0, 160) : ''
    };
  }

  function announce(message, assertive = true) {
    let region = document.getElementById(STATUS_ID);
    if (!region) {
      region = document.createElement('div');
      region.id = STATUS_ID;
      region.setAttribute(OWNED_ATTR, 'true');
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

  function findComposerRoot() {
    const explicit = document.querySelector('[data-type="unified-composer"]');
    if (explicit instanceof HTMLElement && isVisible(explicit)) return explicit;

    const composer = findComposer();
    if (!(composer instanceof HTMLElement)) return null;

    return composer.closest('[data-type="unified-composer"], form') || composer.parentElement;
  }

  function focusComposer() {
    const composer = findComposer();
    composer?.focus({ preventScroll: true });
  }

  function elementIsExtensionOwned(element) {
    return Boolean(
      element?.closest?.(`[${OWNED_ATTR}="true"], #${PICKER_ID}, #${STATUS_ID}`)
    );
  }

  function isInEditable(element) {
    if (!(element instanceof Element)) return false;
    return Boolean(
      element.closest(
        '#prompt-textarea, textarea, input, [contenteditable="true"], [role="textbox"]'
      )
    );
  }

  function findComposerToolMarker(toolId) {
    const root = findComposerRoot();
    if (!(root instanceof Element)) return null;

    const selector = [
      'button',
      '[role="button"]',
      '[role="option"]',
      '[role="status"]',
      '[aria-label]',
      '[title]',
      '[data-testid]',
      '[data-state]',
      'span'
    ].join(',');

    for (const element of root.querySelectorAll(selector)) {
      if (!isVisible(element) || elementIsExtensionOwned(element) || isInEditable(element)) continue;

      const values = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('data-testid'),
        element.getAttribute('data-value'),
        element.getAttribute('data-tool')
      ].filter(Boolean);

      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (text && text.length <= 120) values.push(text);

      const labelMatch = values.some((value) => api.isToolLabel(toolId, value));
      const signatureMatch =
        api.scoreToolCandidate(toolId, element) >= 110 &&
        values.some((value) => String(value).length <= 160);

      if (labelMatch || signatureMatch) return element;
    }
    return null;
  }

  function captureSafeState(toolId = null) {
    const plus = findPlusButton();
    const root = findComposerRoot();
    const marker = toolId ? findComposerToolMarker(toolId) : null;
    return {
      plusFound: Boolean(plus),
      plusExpanded: plus?.getAttribute('aria-expanded') || '',
      composerFound: Boolean(findComposer()),
      composerRootFound: Boolean(root),
      requestedToolMarkerFound: Boolean(marker),
      requestedToolMarker: marker ? safeElementSummary(marker) : null,
      pickerOpen: Boolean(document.getElementById(PICKER_ID)),
      activationInProgress,
      fullscreen: Boolean(document.fullscreenElement),
      viewport: { width: window.innerWidth, height: window.innerHeight }
    };
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
      if (elementIsExtensionOwned(element)) continue;
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 180) continue;
      if (api.isToolLabel(toolId, text) || api.isToolDescription(toolId, text)) {
        const interactive = toInteractiveElement(element);
        if (interactive) candidates.add(interactive);
      }
    }

    return [...candidates]
      .filter(isVisible)
      .filter((element) => !elementIsExtensionOwned(element))
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
        attributeFilter: ['role', 'data-state', 'aria-hidden', 'aria-expanded', 'aria-checked', 'aria-pressed']
      });

      const pollId = window.setInterval(check, 100);
      const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    });
  }

  function waitForComposerToolMarker(toolId, timeoutMs = VERIFY_TIMEOUT_MS) {
    const immediate = findComposerToolMarker(toolId);
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
        const marker = findComposerToolMarker(toolId);
        if (marker) finish(marker);
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-label', 'data-testid', 'data-state', 'aria-hidden', 'title']
      });
      const pollId = window.setInterval(check, 100);
      const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    });
  }

  function dispatchRobustClick(element) {
    if (!(element instanceof HTMLElement)) return;
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    element.focus?.({ preventScroll: true });

    const eventInit = { bubbles: true, cancelable: true, composed: true };
    try {
      if (typeof PointerEvent === 'function') {
        element.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerType: 'mouse', button: 0 }));
      }
      element.dispatchEvent(new MouseEvent('mousedown', { ...eventInit, button: 0 }));
      if (typeof PointerEvent === 'function') {
        element.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerType: 'mouse', button: 0 }));
      }
      element.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, button: 0 }));
    } catch (error) {
      recordDiagnostic('synthetic-pointer-sequence-error', { name: error?.name || '', message: error?.message || '' });
    }
    element.click();
  }

  async function activateTool(toolId) {
    const tool = api.getTool(toolId);
    if (!tool) return;

    if (activationInProgress) {
      announce('Попередня команда ще виконується.', false);
      return;
    }

    resetDiagnostics('tool-activation', toolId);
    activationInProgress = true;
    startDiagnosticHeartbeat(toolId);
    recordDiagnostic('activation-start', { toolId, toolLabel: tool.label });

    try {
      const existingMarker = findComposerToolMarker(toolId);
      if (existingMarker) {
        recordDiagnostic('already-verified-in-composer', { marker: safeElementSummary(existingMarker) });
        focusComposer();
        announce(`${tool.label} уже ввімкнено. Введіть запит і натисніть Enter.`);
        return;
      }

      const plusButton = findPlusButton();
      recordDiagnostic('plus-button-lookup', { found: Boolean(plusButton), element: safeElementSummary(plusButton) });
      if (!plusButton) {
        announce('Не знайдено кнопку «Додати файли та інше» на сторінці ChatGPT.');
        console.warn(`${LOG_PREFIX} Composer plus button not found.`);
        recordDiagnostic('activation-failed', { reason: 'plus-button-not-found' });
        return;
      }

      const baseline = new Set(document.querySelectorAll(INTERACTIVE_SELECTOR));
      if (plusButton.getAttribute('aria-expanded') !== 'true') {
        recordDiagnostic('open-native-tools-menu', {});
        dispatchRobustClick(plusButton);
      } else {
        recordDiagnostic('native-tools-menu-already-open', {});
      }

      const candidate = await waitForToolCandidate(toolId, baseline);
      recordDiagnostic('tool-candidate-result', {
        found: Boolean(candidate),
        candidate: safeElementSummary(candidate)
      });

      if (!candidate) {
        announce(`Меню відкрито, але пункт «${tool.label}» не знайдено. Інтерфейс ChatGPT міг змінитися.`);
        console.warn(`${LOG_PREFIX} Tool not found in the opened popup:`, toolId);
        recordDiagnostic('activation-failed', { reason: 'tool-candidate-not-found' });
        return;
      }

      recordDiagnostic('tool-candidate-before-click', {
        candidate: safeElementSummary(candidate),
        menuSelectedState: api.isSelected(candidate)
      });

      dispatchRobustClick(candidate);
      recordDiagnostic('tool-candidate-click-dispatched', { candidate: safeElementSummary(candidate) });

      const verifiedMarker = await waitForComposerToolMarker(toolId);
      if (!verifiedMarker) {
        focusComposer();
        recordDiagnostic('activation-failed', {
          reason: 'composer-marker-not-confirmed',
          finalState: captureSafeState(toolId)
        });
        announce(
          `Не підтверджено, що «${tool.label}» увімкнено. Розширення не вважає клік успіхом. Натисніть Ctrl+Shift+U і виберіть «Завантажити діагностичний звіт».`
        );
        console.warn(`${LOG_PREFIX} Activation was not confirmed in the ChatGPT composer:`, toolId);
        return;
      }

      recordDiagnostic('activation-verified', {
        marker: safeElementSummary(verifiedMarker),
        finalState: captureSafeState(toolId)
      });
      focusComposer();
      announce(`${tool.label} підтверджено як вибране. Введіть запит і натисніть Enter.`);
      console.info(`${LOG_PREFIX} Activated and verified:`, toolId);
    } catch (error) {
      console.error(`${LOG_PREFIX} Activation failed for ${toolId}.`, error);
      recordDiagnostic('activation-exception', {
        name: error?.name || '',
        message: error?.message || ''
      });
      announce(`Не вдалося активувати «${tool.label}» через помилку інтерфейсу ChatGPT.`);
    } finally {
      stopDiagnosticHeartbeat();
      activationInProgress = false;
      recordDiagnostic('activation-end', captureSafeState(toolId));
    }
  }

  function diagnosticReportText() {
    if (!diagnosticSession) resetDiagnostics('manual-download', null);
    const lines = [
      'CHATGPT ACCESSIBLE TOOL PICKER — DIAGNOSTIC REPORT',
      `Extension version: ${VERSION}`,
      `Session ID: ${diagnosticSession.sessionId}`,
      `Session reason: ${diagnosticSession.reason}`,
      `Requested tool: ${diagnosticSession.toolId || '(none)'}`,
      `Started: ${diagnosticSession.startedAtIso}`,
      `Generated: ${nowIso()}`,
      `URL: ${location.href}`,
      'Privacy: prompt/chat text is intentionally not captured.',
      '',
      'TIMELINE'
    ];

    for (const entry of diagnosticSession.events) {
      const seconds = (entry.elapsedMs / 1000).toFixed(3);
      lines.push(`[+${seconds}s] ${entry.at} ${entry.event} ${JSON.stringify(entry.details)}`);
    }
    return lines.join('\n');
  }

  function diagnosticsFilename() {
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .replace('Z', '');
    return `chatgpt-tool-picker-diagnostic-${stamp}.txt`;
  }

  function downloadDiagnostics() {
    recordDiagnostic('diagnostic-download-requested', captureSafeState(diagnosticSession?.toolId || null));
    const report = diagnosticReportText();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.setAttribute(OWNED_ATTR, 'true');
    anchor.href = url;
    anchor.download = diagnosticsFilename();
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Діагностичний звіт завантажено.', false);
  }

  function getPickerToolButtons(dialog) {
    return [...dialog.querySelectorAll('[data-chatgpt-tool-id]')];
  }

  function getPickerFocusables(dialog) {
    return [
      ...dialog.querySelectorAll(
        '[data-chatgpt-tool-id], [data-chatgpt-diagnostics-download]'
      )
    ];
  }

  function closePicker({ restoreFocus = true } = {}) {
    const dialog = document.getElementById(PICKER_ID);
    if (!dialog) return;
    dialog.remove();

    if (restoreFocus) {
      const target =
        focusBeforePicker instanceof HTMLElement && document.contains(focusBeforePicker)
          ? focusBeforePicker
          : findComposer();
      target?.focus({ preventScroll: true });
    }
  }

  function movePickerFocus(dialog, delta) {
    const buttons = getPickerToolButtons(dialog);
    if (!buttons.length) return;
    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement));
    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  }

  function trapTab(dialog, event) {
    const focusables = getPickerFocusables(dialog);
    if (!focusables.length) return;
    const currentIndex = focusables.indexOf(document.activeElement);
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      focusables[focusables.length - 1].focus();
    } else if (!event.shiftKey && currentIndex === focusables.length - 1) {
      event.preventDefault();
      focusables[0].focus();
    }
  }

  function createPicker() {
    const existing = document.getElementById(PICKER_ID);
    if (existing) return existing;

    focusBeforePicker =
      document.activeElement instanceof HTMLElement ? document.activeElement : findComposer();

    const dialog = document.createElement('div');
    dialog.id = PICKER_ID;
    dialog.setAttribute(OWNED_ATTR, 'true');
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
    description.textContent =
      'Стрілки вгору і вниз — вибір інструмента. Enter — запустити. Tab — також переходить до кнопки діагностики. Escape — закрити.';
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

    const diagnostics = document.createElement('button');
    diagnostics.type = 'button';
    diagnostics.dataset.chatgptDiagnosticsDownload = 'true';
    diagnostics.setAttribute(
      'aria-label',
      'Завантажити діагностичний звіт. Посекундна технічна хронологія останньої спроби без тексту вашого запиту або чату.'
    );
    diagnostics.textContent = 'Завантажити діагностичний звіт';
    Object.assign(diagnostics.style, {
      display: 'block',
      width: '100%',
      marginTop: '16px',
      padding: '12px 16px',
      border: '1px solid ButtonText',
      borderRadius: '8px',
      background: 'ButtonFace',
      color: 'ButtonText',
      font: 'inherit',
      cursor: 'pointer'
    });
    diagnostics.addEventListener('click', downloadDiagnostics);

    panel.append(title, description, list, diagnostics);
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
        getPickerToolButtons(dialog)[0]?.focus();
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        const buttons = getPickerToolButtons(dialog);
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
    const firstButton = getPickerToolButtons(dialog)[0];
    window.setTimeout(() => firstButton?.focus({ preventScroll: true }), 0);
    announce(
      'Оберіть інструмент ChatGPT: Створити зображення, Пошук в Інтернеті або Глибоке дослідження. Tab після інструментів відкриває завантаження діагностики.',
      false
    );
  }

  function requestOpenPicker(source = 'unknown') {
    const existing = document.getElementById(PICKER_ID);
    if (existing) {
      const focused = existing.querySelector(
        '[data-chatgpt-tool-id]:focus, [data-chatgpt-diagnostics-download]:focus'
      );
      const first = getPickerToolButtons(existing)[0];
      (focused || first)?.focus({ preventScroll: true });
      return;
    }

    const now = Date.now();
    if (now - lastOpenRequestAt < OPEN_DEDUPE_MS) return;
    lastOpenRequestAt = now;
    recordDiagnostic('picker-open-request', { source });
    console.debug(`${LOG_PREFIX} Opening picker from ${source}.`);
    openPicker();
  }

  document.addEventListener(
    'keydown',
    (event) => {
      if (api.isPickerShortcutEvent(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        requestOpenPicker('page-keydown');
        return;
      }

      if (api.isDiagnosticsShortcutEvent?.(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        downloadDiagnostics();
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'OPEN_TOOL_PICKER') requestOpenPicker('chrome-command');
  });

  resetDiagnostics('page-ready', null);

  globalThis.ChatGPTAccessibleToolPicker = Object.freeze({
    openPicker: () => requestOpenPicker('public-api'),
    closePicker,
    activateTool,
    findComposerToolMarker,
    downloadDiagnostics,
    diagnosticReportText
  });
})();
