# ChatGPT Accessible Tool Picker

Доступне Chrome-розширення для NVDA, яке відкриває власне клавіатурне вікно вибору інструмента ChatGPT через **Ctrl+Shift+U** і не оголошує успіх, доки штатний composer ChatGPT не підтвердить реальний вибір режиму.

## Поточні інструменти

У версії 0.4.0 доступні три функції, підтверджені у живому меню ChatGPT:

1. **Створити зображення** — «Візуалізуйте все».
2. **Пошук в Інтернеті** — «Знаходьте актуальні новини й інформацію».
3. **Глибоке дослідження** — «Отримати докладний звіт».

## Як працює Ctrl+Shift+U

1. На будь-якій сторінці `https://chatgpt.com` натисніть **Ctrl+Shift+U**.
2. Розширення відкриє власний доступний `role="dialog"`.
3. Фокус автоматично переходить на перший інструмент.
4. **Стрілка вниз / вгору** переміщує вибір між трьома інструментами.
5. **Enter** запускає вибраний інструмент.
6. **Tab** після трьох інструментів переходить до кнопки **«Завантажити діагностичний звіт»**.
7. **Escape** закриває вікно й повертає фокус назад.

Після Enter розширення відкриває штатне меню ChatGPT `+`, знаходить потрібний пункт семантично та активує його.

## Критична гарантія v0.4.0: click != success

Версія 0.3.0 мала false-positive дефект: після `.click()` по пункту меню вона одразу повідомляла NVDA, що режим вибрано, навіть якщо штатний composer ChatGPT фактично не перейшов у цей режим.

У v0.4.0 це заборонено:

- після кліку розширення окремо шукає **штатну мітку вибраного інструмента всередині composer**;
- власний live-region розширення виключений із перевірки;
- текст у `#prompt-textarea`, `textarea`, `input`, `[contenteditable=true]` і `[role=textbox]` виключений із перевірки;
- verification триває до 6 секунд через `MutationObserver` + polling;
- якщо штатна мітка не з'явилася, результат = **FAIL**, а не SUCCESS;
- NVDA отримує повідомлення «Не підтверджено…», а не «вибрано».

## Діагностичний звіт

Розширення записує bounded in-memory timeline останньої спроби активації.

Звіт можна завантажити двома способами:

- `Ctrl+Shift+U` → Tab після трьох інструментів → **«Завантажити діагностичний звіт»** → Enter;
- прямий fallback **Ctrl+Alt+Shift+D** на сторінці ChatGPT.

Звіт містить:

- версію розширення;
- URL сторінки;
- розмір viewport і fullscreen-state;
- час кожної події до мілісекунд;
- heartbeat приблизно щосекунди;
- чи знайдено composer і кнопку `+`;
- `aria-expanded` кнопки `+`;
- чи знайдено потрібний пункт меню;
- безпечну семантичну сигнатуру знайденого елемента (`role`, `aria-label`, `data-testid`, `data-state`, ARIA selected state);
- факт відправлення кліку;
- чи з'явилася штатна мітка режиму в composer;
- точну причину SUCCESS / FAIL / exception.

### Конфіденційність діагностики

Діагностика навмисно **не зберігає текст вашого prompt або повідомлень чату**. Вона не читає `composer.value` і не записує raw text із поля введення. Записуються лише технічні атрибути та назва інструмента, коли вона збігається з одним із трьох відомих інструментів.

Дані зберігаються лише в оперативній пам'яті поточної сторінки. `chrome.storage` і `chrome.downloads` не використовуються. TXT-файл формується локально через `Blob` + object URL.

## NVDA

Діалог використовує:

- `role="dialog"`;
- `aria-modal="true"`;
- `aria-labelledby`;
- `aria-describedby`;
- native HTML buttons;
- `role="status"` / `aria-live` для повідомлень про успіх або помилку.

Успішне повідомлення тепер звучить лише після verification, наприклад:

`Глибоке дослідження підтверджено як вибране. Введіть запит і натисніть Enter.`

Якщо ChatGPT не підтвердив режим:

`Не підтверджено, що «Глибоке дослідження» увімкнено...`

## Повноекранний і звичайний режим

Picker не залежить від координат миші. Overlay використовує viewport-relative layout (`position: fixed`, `inset: 0`, `vw`, `dvh`) і призначений для:

- звичайного вікна Chrome;
- максимізованого вікна;
- F11 fullscreen;
- відкритої або закритої бічної панелі ChatGPT.

## Встановлення

1. Завантажте ZIP з успішного GitHub Actions artifact.
2. Розпакуйте ZIP.
3. Відкрийте `chrome://extensions`.
4. Увімкніть **Режим розробника / Developer mode**.
5. Виберіть **Завантажити розпаковане / Load unpacked**.
6. Виберіть папку, де лежить `manifest.json`.
7. Відкрийте або перезавантажте `https://chatgpt.com`.
8. Далі запуск відбувається прямо з чату через **Ctrl+Shift+U**.

## Конфіденційність і permissions

- Немає власних мережевих запитів.
- Немає збору prompt/chat/cookies/tokens.
- Немає `chrome.storage`.
- Немає `chrome.downloads` permission.
- Runtime permission: тільки `activeTab`.
- Content script: тільки `https://chatgpt.com/*`.

## CI / release gate

GitHub Actions перевіряє Node 20, 22 і 24.

Release не пакується, доки не пройдуть:

- JavaScript syntax checks;
- matcher tests;
- direct-chat shortcut tests;
- background command tests;
- accessibility contracts;
- viewport/fullscreen contracts;
- privacy contracts;
- fail-closed composer verification contracts;
- diagnostics download/timeline contracts.

Після створення ZIP CI додатково виконує `unzip -t`, повторний `node --check` вже на runtime-файлах усередині архіву і перевірку Manifest V3/version.

## Залишковий acceptance gate

Автоматичні тести не можуть повністю відтворити приватний авторизований React/portal DOM ChatGPT. Тому останній gate — реальна Windows 11 + Chrome + NVDA перевірка. Якщо verification FAIL, завантажте діагностичний TXT і передайте його розробнику.

## License

MIT
