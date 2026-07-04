import {
  CreateElementOnly,
  DynamicOnly,
  ObjectRegistryOnly,
  PropOnly,
  RegistryOnly,
  RouteConfigOnly,
} from "../components/NonJsxOnly.js";

declare const React: {
  createElement(component: unknown, props?: unknown): unknown;
};

declare const Slot: (props: { component: unknown }) => JSX.Element;

declare function renderDynamic(component: unknown): unknown;

export const createElementReference = React.createElement(
  CreateElementOnly,
  {}
);

export const propReference = <Slot component={PropOnly} />;

export const routes = [
  {
    path: "/route-config-only",
    component: RouteConfigOnly,
  },
];

export const componentRegistry = [
  RegistryOnly,
  {
    card: ObjectRegistryOnly,
  },
];

export const dynamicReference = renderDynamic(DynamicOnly);
