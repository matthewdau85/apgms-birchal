import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });

const { window } = dom;

const copyProps = (target: Record<string, unknown>, source: Record<string, unknown>) => {
  for (const key of Reflect.ownKeys(source)) {
    if (key in target) continue;
    const descriptor = Object.getOwnPropertyDescriptor(source, key as keyof typeof source);
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    }
  }
};

(globalThis as unknown as Record<string, unknown>).window = window as unknown as Window;
(globalThis as unknown as Record<string, unknown>).document = window.document as unknown as Document;
(globalThis as unknown as Record<string, unknown>).navigator = window.navigator as unknown as Navigator;

copyProps(globalThis as unknown as Record<string, unknown>, window as unknown as Record<string, unknown>);
