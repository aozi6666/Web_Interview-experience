type PendingItem = {
  responseType: string;
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class PendingRequests {
  private readonly pending = new Map<string, PendingItem>();

  create<T>(
    correlationId: string,
    responseType: string,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(
          new Error(
            `等待响应超时: id=${correlationId}, type=${responseType}, timeout=${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this.pending.set(correlationId, {
        responseType,
        resolve: (data) => resolve(data as T),
        reject,
        timer,
      });
    });
  }

  resolve(correlationId: string, data: unknown): boolean {
    const item = this.pending.get(correlationId);
    if (!item) {
      return false;
    }

    clearTimeout(item.timer);
    this.pending.delete(correlationId);
    item.resolve(data);
    return true;
  }

  resolveByType(responseType: string, data: unknown): boolean {
    const entry = Array.from(this.pending.entries()).find(
      ([, item]) => item.responseType === responseType,
    );
    if (!entry) {
      return false;
    }

    const [id, item] = entry;
    clearTimeout(item.timer);
    this.pending.delete(id);
    item.resolve(data);
    return true;
  }

  rejectAll(reason: string): void {
    this.pending.forEach((item) => {
      clearTimeout(item.timer);
      item.reject(new Error(reason));
    });
    this.pending.clear();
  }
}
