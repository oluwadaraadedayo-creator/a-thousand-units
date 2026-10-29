// Prefix public assets with Vite's deployment base so GitHub Pages subpaths work.
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
