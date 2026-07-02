declare function lazy(loader: () => Promise<unknown>): () => JSX.Element;

export const LazyPanel = lazy(() => import("./Panel.js"));
