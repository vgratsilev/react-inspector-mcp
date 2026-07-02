declare function lazy(loader: () => Promise<unknown>): () => JSX.Element;
declare const React: { lazy: typeof lazy };

export const LazyPanel = lazy(() => import("./Panel.js"));

export const LazyDefaultPanel = React.lazy(() => import("./DefaultPanel.js"));

export const LazyNamedPanel = lazy(() =>
  import("./NamedPanel.js").then(module => ({
    default: module.NamedPanel,
  }))
);

export const LazyAliasPanel = lazy(() => import("@ui/DefaultPanel.js"));
