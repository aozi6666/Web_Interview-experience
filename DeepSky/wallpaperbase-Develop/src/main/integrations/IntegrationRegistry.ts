import type { Container } from 'inversify';
import { injectable } from 'inversify';
import type { IIntegration } from './types';

/**
 * 集成注册表
 * 管理外部模块的注册、初始化和销毁
 */
@injectable()
export class IntegrationRegistry {
  private integrations: Map<string, IIntegration> = new Map();

  register(integration: IIntegration): void {
    if (this.integrations.has(integration.name)) {
      throw new Error(
        `Integration "${integration.name}" is already registered`,
      );
    }
    this.integrations.set(integration.name, integration);
  }

  async initializeAll(container: Container): Promise<void> {
    const sorted = this.topologicalSort();
    for (const integration of sorted) {
      integration.register(container);
    }
    for (const integration of sorted) {
      await integration.initialize(container);
    }
  }

  async disposeAll(): Promise<void> {
    const integrations = Array.from(this.integrations.values()).reverse();
    for (const integration of integrations) {
      await integration.dispose();
    }
    this.integrations.clear();
  }

  private topologicalSort(): IIntegration[] {
    const visited = new Set<string>();
    const result: IIntegration[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const integration = this.integrations.get(name);
      if (!integration) return;

      for (const dep of integration.dependencies ?? []) {
        visit(dep);
      }
      result.push(integration);
    };

    for (const name of this.integrations.keys()) {
      visit(name);
    }

    return result;
  }
}
