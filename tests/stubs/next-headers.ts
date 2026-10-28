const jar = new Map<string, string>();
export async function cookies() {
  return {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (opts: string | { name: string }) => void jar.delete(typeof opts === "string" ? opts : opts.name),
    has: (name: string) => jar.has(name),
  };
}
export async function headers() {
  return new Headers({ "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" });
}
