import { ComponentType, ReactNode } from 'react';

type ProviderComponent = ComponentType<{ children: ReactNode }>;

export function composeProviders(
  ...providers: ProviderComponent[]
): ComponentType<{ children: ReactNode }> {
  return providers.reduce(
    (AccumulatedProvider, CurrentProvider) =>
      function CombinedProvider({ children }: { children: ReactNode }) {
        return (
          <AccumulatedProvider>
            <CurrentProvider>{children}</CurrentProvider>
          </AccumulatedProvider>
        );
      },
    function RootProvider({ children }: { children: ReactNode }) {
      return children;
    },
  );
}
