/* eslint-disable @typescript-eslint/no-unused-vars */
// Test stand-ins: caching is a no-op outside a Next.js request.
export const cacheTag = (..._tags: string[]) => undefined;
export const cacheLife = (_profile: unknown) => undefined;
export const updateTag = (_tag: string) => undefined;
export const revalidateTag = (_tag: string, _profile?: unknown) => undefined;
export const refresh = () => undefined;
