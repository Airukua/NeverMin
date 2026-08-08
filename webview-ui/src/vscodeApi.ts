import type { ExtensionToWebviewMessage, NeverminBoot, WebviewToExtensionMessage } from './types';

interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
    __NEVERMIN_BOOT__?: NeverminBoot;
  }
}

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = window.acquireVsCodeApi?.() ?? {
      postMessage: () => undefined,
      getState: () => undefined,
      setState: () => undefined
    };
  }
  return api;
}

export function getBoot(): NeverminBoot | undefined {
  return window.__NEVERMIN_BOOT__;
}

export function postToExtension(message: WebviewToExtensionMessage): void {
  getVsCodeApi().postMessage(message);
}

export function onExtensionMessage(handler: (msg: ExtensionToWebviewMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data as ExtensionToWebviewMessage;
    if (!data || typeof data !== 'object' || !('type' in data)) {
      return;
    }
    handler(data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
