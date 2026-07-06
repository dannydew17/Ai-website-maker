import { existsSync } from "node:fs";

// Structurally compatible with Playwright's LaunchOptions, without taking a
// dependency on playwright from core (only browser-using packages need it).
export interface ChromiumLaunchOptions {
  executablePath?: string;
  proxy?: { server: string; bypass?: string };
}

const SANDBOX_CHROMIUM_PATH = "/opt/pw-browsers/chromium";

/**
 * Shared launch config for any package driving Playwright's Chromium:
 * points at this sandbox's pre-installed browser when present, and routes
 * traffic through the sandbox's egress proxy when configured (Chromium does
 * not read HTTPS_PROXY automatically the way curl/fetch do).
 */
export function getChromiumLaunchOptions(): ChromiumLaunchOptions {
  const options: ChromiumLaunchOptions = {};

  if (existsSync(SANDBOX_CHROMIUM_PATH)) {
    options.executablePath = SANDBOX_CHROMIUM_PATH;
  }

  const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (proxyServer) {
    // Unlike curl/fetch, Chromium doesn't consult NO_PROXY once a proxy is
    // set explicitly — without a bypass list it would also tunnel localhost
    // traffic (e.g. a local dev/test server) through the egress proxy.
    options.proxy = { server: proxyServer, bypass: "localhost,127.0.0.1,::1" };
  }

  return options;
}
