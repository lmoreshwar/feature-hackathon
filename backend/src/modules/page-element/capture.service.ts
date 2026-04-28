import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { Observable, Subject } from 'rxjs';
import { CreatePageElementDto } from './dto/create-page-element.dto';
import { StartCaptureDto } from './dto/start-capture.dto';
import {
  PageElementType,
  PageSelectorType,
} from './page-element.interface';

export interface CapturedElement {
  /** Stable client-side id assigned in the order events arrive. */
  clientId: string;
  pageUrl: string;
  pageTitle?: string;
  elementName: string;
  elementType: PageElementType;
  selector: string;
  selectorType: PageSelectorType;
}

interface CaptureSession {
  id: string;
  userId: string;
  featureId: string;
  defaultPageUrl: string;
  defaultPageName?: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  events$: Subject<CapturedElement>;
  captured: CapturedElement[];
  startedAt: number;
  closed: boolean;
}

const COMMON_USERNAME_SELECTORS = [
  'input[name="username"]',
  'input[name="email"]',
  'input[name="user"]',
  'input[name="login"]',
  'input[name="userName"]',
  'input[id="username"]',
  'input[id="email"]',
  'input[id="user-name"]',
  'input[type="email"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
];

const COMMON_PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[name="password"]',
  'input[id="password"]',
  'input[autocomplete="current-password"]',
];

const COMMON_SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button[name="login"]',
  'button[id="login-button"]',
];

const SUBMIT_TEXT_PATTERN = /\b(log\s*in|sign\s*in|login|submit|continue)\b/i;

const TOKEN_STORAGE_KEYS = [
  'token',
  'accessToken',
  'access_token',
  'authToken',
  'auth_token',
  'jwt',
  'idToken',
  'id_token',
];

const RECORDER_INIT_SCRIPT = `
(() => {
  if (window.__captureInstalled) return;
  window.__captureInstalled = true;

  const injectStyle = () => {
    if (document.getElementById('__capture_style')) return;
    const style = document.createElement('style');
    style.id = '__capture_style';
    style.textContent = \`
      .__capture_flash { outline: 3px solid #fadb14 !important; outline-offset: 2px !important; transition: outline-color 0.4s ease-out !important; }
      .__capture_banner {
        position: fixed; top: 12px; right: 12px; z-index: 2147483647;
        background: rgba(22, 119, 255, 0.92); color: white; padding: 8px 14px;
        border-radius: 8px; font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      }
    \`;
    document.head?.appendChild(style);
  };

  const injectBanner = () => {
    if (!document.body) return;
    if (document.getElementById('__capture_banner')) return;
    const div = document.createElement('div');
    div.id = '__capture_banner';
    div.className = '__capture_banner';
    div.textContent = 'Capture mode active — click any element to record it';
    document.body.appendChild(div);
  };

  const escapeAttr = (v) => String(v).replace(/"/g, '\\\\"');

  const buildSelector = (el) => {
    const id = el.id;
    if (id && /^[A-Za-z][\\w-]*$/.test(id)) {
      return { selector: '#' + id, selectorType: 'ID' };
    }
    const tag = el.tagName.toLowerCase();
    const testId = el.getAttribute('data-testid');
    if (testId) return { selector: tag + '[data-testid="' + escapeAttr(testId) + '"]', selectorType: 'CSS' };
    const name = el.getAttribute('name');
    if (name) return { selector: tag + '[name="' + escapeAttr(name) + '"]', selectorType: 'CSS' };
    const aria = el.getAttribute('aria-label');
    if (aria) return { selector: tag + '[aria-label="' + escapeAttr(aria) + '"]', selectorType: 'CSS' };
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return { selector: tag + '[placeholder="' + escapeAttr(placeholder) + '"]', selectorType: 'CSS' };
    const role = el.getAttribute('role');
    if (role) return { selector: tag + '[role="' + escapeAttr(role) + '"]', selectorType: 'CSS' };
    const cls = el.className;
    if (typeof cls === 'string' && cls.trim()) {
      const first = cls.trim().split(/\\s+/)[0];
      if (first && !/[^\\w-]/.test(first)) return { selector: tag + '.' + first, selectorType: 'CSS' };
    }
    return { selector: tag, selectorType: 'CSS' };
  };

  const labelFor = (el) => {
    const id = el.id;
    if (id) {
      const lbl = document.querySelector('label[for="' + id + '"]');
      if (lbl && lbl.textContent && lbl.textContent.trim()) return lbl.textContent.trim();
    }
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) return placeholder.trim();
    const name = el.getAttribute('name');
    if (name && name.trim()) return name.trim();
    if (el.textContent && el.textContent.trim()) {
      const t = el.textContent.trim().replace(/\\s+/g, ' ');
      return t.length > 60 ? t.slice(0, 57) + '...' : t;
    }
    return el.tagName.toLowerCase();
  };

  const classify = (el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'LINK';
    if (tag === 'button') return 'BUTTON';
    if (tag === 'select') return 'DROPDOWN';
    if (tag === 'textarea') return 'INPUT';
    if (tag === 'input') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'submit' || t === 'button') return 'BUTTON';
      if (t === 'checkbox' || t === 'radio') return 'CHECKBOX';
      return 'INPUT';
    }
    if (el.getAttribute('role') === 'button') return 'BUTTON';
    if (el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'listbox') return 'DROPDOWN';
    return 'OTHER';
  };

  const flash = (el) => {
    el.classList.add('__capture_flash');
    setTimeout(() => el.classList.remove('__capture_flash'), 600);
  };

  const handleClick = (e) => {
    const target = e.target;
    if (!(target && target.closest)) return;
    let el = target;
    const interactive = el.closest('a, button, input, select, textarea, [role="button"], [role="link"], [data-testid]');
    if (interactive) el = interactive;
    if (!el || el.id === '__capture_banner') return;

    try {
      const sel = buildSelector(el);
      const payload = {
        pageUrl: location.href,
        pageTitle: document.title,
        elementName: labelFor(el),
        elementType: classify(el),
        selector: sel.selector,
        selectorType: sel.selectorType,
      };
      flash(el);
      if (typeof window.__capture === 'function') {
        window.__capture(payload);
      }
    } catch (err) {
      // swallow
    }
  };

  const install = () => {
    injectStyle();
    injectBanner();
    document.addEventListener('click', handleClick, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
`;

@Injectable()
export class CaptureService implements OnModuleDestroy {
  private readonly logger = new Logger(CaptureService.name);
  private readonly sessions = new Map<string, CaptureSession>();

  async start(dto: StartCaptureDto, userId: string): Promise<{ sessionId: string }> {
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
      });
    } catch (err) {
      this.logger.error('Failed to launch Chromium for capture', err as Error);
      throw new ServiceUnavailableException(
        'Could not launch a non-headless browser. Run "npx playwright install chromium" in the backend.',
      );
    }

    try {
      const context = await this.buildContext(browser, dto);
      await context.addInitScript(RECORDER_INIT_SCRIPT);
      const page = await context.newPage();

      const events$ = new Subject<CapturedElement>();
      const captured: CapturedElement[] = [];
      let counter = 0;

      await context.exposeBinding(
        '__capture',
        (_source, raw: Record<string, unknown>) => {
          counter += 1;
          const item: CapturedElement = {
            clientId: `c${counter}`,
            pageUrl: String(raw.pageUrl ?? dto.pageUrl),
            pageTitle: typeof raw.pageTitle === 'string' ? raw.pageTitle : undefined,
            elementName: String(raw.elementName ?? 'element'),
            elementType: this.coerceType(raw.elementType),
            selector: String(raw.selector ?? ''),
            selectorType: this.coerceSelectorType(raw.selectorType),
          };
          if (!item.selector) return;
          captured.push(item);
          events$.next(item);
        },
      );

      if (dto.authMethod === 'credentials') {
        await this.loginWithCredentials(page, dto);
      } else if (dto.authMethod === 'token') {
        await this.applyToken(page, dto);
      }

      await page.goto(dto.pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const session: CaptureSession = {
        id: randomUUID(),
        userId,
        featureId: dto.featureId,
        defaultPageUrl: dto.pageUrl,
        defaultPageName: dto.pageName?.trim() || undefined,
        browser,
        context,
        page,
        events$,
        captured,
        startedAt: Date.now(),
        closed: false,
      };

      page.on('close', () => {
        if (!session.closed) {
          this.logger.log(`Capture session ${session.id} window closed by user`);
          this.cleanup(session).catch(() => undefined);
        }
      });

      this.sessions.set(session.id, session);
      return { sessionId: session.id };
    } catch (err) {
      await browser.close().catch(() => undefined);
      throw err;
    }
  }

  events(sessionId: string, userId: string): Observable<CapturedElement> {
    const session = this.requireOwn(sessionId, userId);
    return new Observable<CapturedElement>((subscriber) => {
      for (const item of session.captured) subscriber.next(item);
      const sub = session.events$.subscribe({
        next: (v) => subscriber.next(v),
        complete: () => subscriber.complete(),
      });
      return () => sub.unsubscribe();
    });
  }

  list(sessionId: string, userId: string): CapturedElement[] {
    return [...this.requireOwn(sessionId, userId).captured];
  }

  async stop(sessionId: string, userId: string): Promise<{ count: number }> {
    const session = this.requireOwn(sessionId, userId);
    await this.cleanup(session);
    return { count: session.captured.length };
  }

  finalize(sessionId: string, userId: string): CreatePageElementDto[] {
    const session = this.requireOwn(sessionId, userId);
    if (session.captured.length === 0) {
      throw new BadRequestException('No elements captured in this session.');
    }
    const seen = new Set<string>();
    const out: CreatePageElementDto[] = [];
    for (const c of session.captured) {
      const key = `${c.pageUrl}::${c.selector}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        featureId: session.featureId,
        pageUrl: c.pageUrl,
        pageName: this.derivePageName(c.pageTitle, session.defaultPageName, c.pageUrl),
        elementName: c.elementName,
        elementType: c.elementType,
        selector: c.selector,
        selectorType: c.selectorType,
        isStable: true,
      });
    }
    return out;
  }

  async onModuleDestroy(): Promise<void> {
    const all = Array.from(this.sessions.values());
    await Promise.all(all.map((s) => this.cleanup(s).catch(() => undefined)));
  }

  private requireOwn(sessionId: string, userId: string): CaptureSession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new NotFoundException(`Capture session "${sessionId}" not found`);
    if (s.userId !== userId) {
      throw new NotFoundException(`Capture session "${sessionId}" not found`);
    }
    return s;
  }

  private async cleanup(session: CaptureSession): Promise<void> {
    if (session.closed) return;
    session.closed = true;
    try {
      session.events$.complete();
    } catch {
      // ignore
    }
    try {
      await session.context.close();
    } catch {
      // ignore
    }
    try {
      await session.browser.close();
    } catch {
      // ignore
    }
    this.sessions.delete(session.id);
  }

  private coerceType(raw: unknown): PageElementType {
    const allowed: PageElementType[] = ['BUTTON', 'INPUT', 'LINK', 'DROPDOWN', 'CHECKBOX', 'TEXT', 'OTHER'];
    return allowed.includes(raw as PageElementType) ? (raw as PageElementType) : 'OTHER';
  }

  private coerceSelectorType(raw: unknown): PageSelectorType {
    const allowed: PageSelectorType[] = ['ID', 'CSS', 'XPATH', 'TEXT'];
    return allowed.includes(raw as PageSelectorType) ? (raw as PageSelectorType) : 'CSS';
  }

  private derivePageName(
    title: string | undefined,
    fallback: string | undefined,
    url: string,
  ): string | undefined {
    const t = title?.trim();
    if (t) return t;
    if (fallback) return fallback;
    try {
      const u = new URL(url);
      const segs = u.pathname.split('/').filter(Boolean);
      return segs.length === 0 ? 'Home' : segs[segs.length - 1];
    } catch {
      return undefined;
    }
  }

  private async buildContext(
    browser: Browser,
    dto: StartCaptureDto,
  ): Promise<BrowserContext> {
    const extraHTTPHeaders: Record<string, string> = {};
    if (dto.authMethod === 'token' && dto.authToken) {
      const value = dto.authToken.trim();
      extraHTTPHeaders['Authorization'] = value.toLowerCase().startsWith('bearer ')
        ? value
        : `Bearer ${value}`;
    }
    return browser.newContext({
      viewport: null,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders:
        Object.keys(extraHTTPHeaders).length > 0 ? extraHTTPHeaders : undefined,
    });
  }

  private async loginWithCredentials(
    page: Page,
    dto: StartCaptureDto,
  ): Promise<void> {
    if (!dto.loginUrl || !dto.username || !dto.password) {
      throw new BadRequestException(
        'loginUrl, username and password are required for credential-based auth',
      );
    }
    await page.goto(dto.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const userField = await this.findFirstVisible(page, COMMON_USERNAME_SELECTORS);
    if (!userField) {
      throw new BadRequestException(
        'Could not locate a username/email input on the login page.',
      );
    }
    await userField.fill(dto.username);

    const passField = await this.findFirstVisible(page, COMMON_PASSWORD_SELECTORS);
    if (!passField) {
      throw new BadRequestException(
        'Could not locate a password input on the login page.',
      );
    }
    await passField.fill(dto.password);

    const submitButton = await this.findFirstVisible(page, COMMON_SUBMIT_SELECTORS);
    const navPromise = page
      .waitForURL((url) => url.toString() !== dto.loginUrl, { timeout: 15000 })
      .catch(() => undefined);

    if (submitButton) {
      await submitButton.click();
    } else {
      const fallback = page
        .locator('button, input[type="button"]')
        .filter({ hasText: SUBMIT_TEXT_PATTERN })
        .first();
      if (await fallback.count()) {
        await fallback.click();
      } else {
        await passField.press('Enter');
      }
    }
    await navPromise;
  }

  private async applyToken(page: Page, dto: StartCaptureDto): Promise<void> {
    if (!dto.authToken) {
      throw new BadRequestException('authToken is required for token-based auth');
    }
    if (!dto.loginUrl) return;

    await page.goto(dto.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const token = dto.authToken.trim();
    await page.evaluate(
      ({ token, keys }) => {
        for (const key of keys) {
          try {
            localStorage.setItem(key, token);
            sessionStorage.setItem(key, token);
          } catch {
            // ignore
          }
        }
      },
      { token, keys: TOKEN_STORAGE_KEYS },
    );
  }

  private async findFirstVisible(page: Page, selectors: readonly string[]) {
    for (const sel of selectors) {
      const locator = page.locator(sel).first();
      if (await locator.count()) {
        const visible = await locator.isVisible().catch(() => false);
        if (visible) return locator;
      }
    }
    return null;
  }
}
