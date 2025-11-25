/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

let browser: Browser | null = null;
let page: Page | null = null;

/**
 * Get or create a shared browser instance
 */
async function getBrowserAndPage(): Promise<{ browser: Browser; page: Page }> {
  if (!browser || !page || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true, // Show browser for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    });

    page = await browser.newPage();

    // Set user agent to look like a real browser
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
  }

  return { browser, page };
}

/**
 * Fetch a Cloudflare-protected page using Puppeteer
 * Browser will be visible so user can manually solve challenges if needed
 */
export async function fetchWithPuppeteer(url: string, referer?: string): Promise<string> {
  const { page: browserPage } = await getBrowserAndPage();

  // Set referer if provided
  if (referer) {
    await browserPage.setExtraHTTPHeaders({
      Referer: referer,
    });
  }

  // Navigate to the page
  await browserPage.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 90000,
  });

  // Random delay to appear more human-like
  const randomDelay = Math.floor(Math.random() * 2000) + 2000; // 2-4 seconds
  await new Promise((resolve) => {
    setTimeout(resolve, randomDelay);
  });

  // Check if we have Cloudflare Turnstile
  const hasTurnstile = await browserPage.evaluate(() => {
    return !!document.querySelector('.cf-turnstile');
  });

  if (hasTurnstile) {
    // Wait for the loadIframe function to appear (indicates challenge is solved)
    try {
      await browserPage.waitForFunction(
        () => {
          const scripts = Array.from(document.querySelectorAll('script'));
          return scripts.some((script) => script.textContent?.includes('function loadIframe'));
        },
        { timeout: 120000 }, // 2 minutes for Cloudflare challenge
      );
    } catch (e) {
      // Timeout
    }
  } else {
    // Still wait for content to load
    const hasContent = await browserPage.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some((script) => script.textContent?.includes('function loadIframe'));
    });

    if (!hasContent) {
      try {
        await browserPage.waitForFunction(
          () => {
            const scripts = Array.from(document.querySelectorAll('script'));
            return scripts.some((script) => script.textContent?.includes('function loadIframe'));
          },
          { timeout: 10000 },
        );
      } catch (e) {
        // Timeout
      }
    }
  }

  // Get the HTML content
  const html = await browserPage.content();

  return html;
}

/**
 * Evaluate code on the current page
 */
export async function evaluateOnCurrentPage<T>(pageFunction: (arg: any) => T | Promise<T>, arg?: any): Promise<T> {
  const { page: browserPage } = await getBrowserAndPage();
  return browserPage.evaluate(pageFunction, arg);
}

/**
 * Close the browser instance
 * Call this when shutting down the application
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}
