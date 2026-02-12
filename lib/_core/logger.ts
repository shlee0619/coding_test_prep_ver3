function isDevRuntime(): boolean {
  if (typeof __DEV__ === "boolean") {
    return __DEV__;
  }
  return process.env.NODE_ENV !== "production";
}

export function devLog(...args: unknown[]) {
  if (isDevRuntime()) {
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]) {
  if (isDevRuntime()) {
    console.warn(...args);
  }
}
