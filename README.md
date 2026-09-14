# ChatGPT Deep Research Shortcut

Accessible Chrome extension that activates ChatGPT Deep Research from a keyboard shortcut and provides NVDA-friendly status feedback.

## Why this exists

On some current ChatGPT web builds, the composer `+` / “Add files and more” menu can be difficult or impossible to use reliably with NVDA. This extension provides a keyboard-first path that does not depend on visual coordinates.

The extension targets semantic UI information first:

- `data-testid="composer-plus-btn"`
- `id="composer-plus-btn"`
- `aria-haspopup="menu"`
- accessible Deep Research labels and ARIA/menu roles

It intentionally avoids depending on ChatGPT's generated CSS class names.

## Keyboard shortcut

Press **Ctrl+Shift+U** on a ChatGPT tab.

Expected sequence:

1. Find the ChatGPT composer `+` button.
2. Open the tools menu if it is closed.
3. Wait for the live popup to be mounted in the DOM.
4. Find the Deep Research entry by accessible text, role, or semantic test identifiers.
5. Activate it.
6. Return focus to the message composer.
7. Announce the result through an ARIA live region so NVDA can report it.

If Chrome has assigned the shortcut to another extension, open `chrome://extensions/shortcuts` and assign **Ctrl+Shift+U** to “Activate ChatGPT Deep Research”.

## Install from source in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository folder containing `manifest.json`.
6. Open `https://chatgpt.com`.
7. Press **Ctrl+Shift+U**.

For an NVDA-only workflow, use Chrome's normal keyboard navigation on the Extensions page; after installation you should not need to navigate the inaccessible ChatGPT tools menu manually.

## Current target

The first version targets `https://chatgpt.com/*` and uses Manifest V3.

Observed ChatGPT trigger in the supplied September 2026 HTML snapshot:

```html
<button
  data-testid="composer-plus-btn"
  id="composer-plus-btn"
  aria-label="Додати файли та інше"
  aria-haspopup="menu"
  aria-expanded="false">
</button>
```

The saved HTML did not preserve the transient popup menu itself, so the extension waits for the **live** popup after clicking the trigger instead of relying on a serialized menu snapshot.

## Safety and privacy

- No network requests are made by the extension.
- No prompts, chats, cookies, tokens, or account data are collected.
- It only runs on `chatgpt.com`.
- It performs the same front-end interaction a user would perform manually: open the tools menu and activate Deep Research.

## Development

Requires Node.js 20+ only for tests. The extension itself has no npm runtime dependencies.

```bash
npm test
```

GitHub Actions also validates the semantic matcher and Manifest V3 configuration on pull requests.

## Accessibility behavior

Status messages are exposed using an off-screen `role="status"` live region. Examples include:

- “Пункт Deep research вибрано. Введіть запит і натисніть Enter.”
- “Deep research уже ввімкнено.”
- A clear failure message if the ChatGPT UI changes and the target can no longer be found.

## License

MIT
