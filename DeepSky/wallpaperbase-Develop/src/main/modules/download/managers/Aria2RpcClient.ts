/**
 * Aria2RpcClient — aria2 JSON-RPC HTTP 客户端
 *
 * 通过 HTTP POST 与 aria2c 守护进程通信，
 * 提供 Promise 化的 API。
 */

import http from 'http';
import type { Aria2Status } from './types';

export class Aria2RpcClient {
  private rpcId = 0;

  constructor(
    private port: number,
    private secret: string,
  ) {}

  /**
   * 发送 JSON-RPC 调用
   */
  private call(method: string, ...params: unknown[]): Promise<unknown> {
    const id = String((this.rpcId += 1));
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: [`token:${this.secret}`, ...params],
    };

    const postData = JSON.stringify(request);

    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: '127.0.0.1',
        port: this.port,
        path: '/jsonrpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.error) {
              reject(
                new Error(
                  response.error.message || JSON.stringify(response.error),
                ),
              );
            } else {
              resolve(response.result);
            }
          } catch (error) {
            reject(new Error(`解析 RPC 响应失败: ${error}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`RPC 请求超时: ${method}`));
      });

      req.on('error', (error) => {
        reject(new Error(`RPC 请求失败: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  // ========== 封装的 API ==========

  /**
   * 添加下载任务
   * @returns GID (全局唯一标识符)
   */
  async addUri(
    urls: string[],
    options?: Record<string, string>,
  ): Promise<string> {
    return this.call('aria2.addUri', urls, options || {}) as Promise<string>;
  }

  /**
   * 查询下载状态
   */
  async tellStatus(gid: string, keys?: string[]): Promise<Aria2Status> {
    if (keys) {
      return this.call('aria2.tellStatus', gid, keys) as Promise<Aria2Status>;
    }
    return this.call('aria2.tellStatus', gid) as Promise<Aria2Status>;
  }

  /**
   * 暂停下载
   */
  async pause(gid: string): Promise<string> {
    return this.call('aria2.pause', gid) as Promise<string>;
  }

  /**
   * 恢复暂停的下载
   */
  async unpause(gid: string): Promise<string> {
    return this.call('aria2.unpause', gid) as Promise<string>;
  }

  /**
   * 强制移除下载任务
   */
  async forceRemove(gid: string): Promise<string> {
    return this.call('aria2.forceRemove', gid) as Promise<string>;
  }

  /**
   * 修改全局选项（如限速），运行时生效，无需重启
   */
  async changeGlobalOption(options: Record<string, string>): Promise<string> {
    return this.call('aria2.changeGlobalOption', options) as Promise<string>;
  }

  /**
   * 批量查询所有活动中的下载任务
   */
  async tellActive(keys?: string[]): Promise<Aria2Status[]> {
    if (keys) {
      return this.call('aria2.tellActive', keys) as Promise<Aria2Status[]>;
    }
    return this.call('aria2.tellActive') as Promise<Aria2Status[]>;
  }

  /**
   * 批量查询等待中的下载任务
   */
  async tellWaiting(
    offset: number,
    num: number,
    keys?: string[],
  ): Promise<Aria2Status[]> {
    if (keys) {
      return this.call('aria2.tellWaiting', offset, num, keys) as Promise<
        Aria2Status[]
      >;
    }
    return this.call('aria2.tellWaiting', offset, num) as Promise<
      Aria2Status[]
    >;
  }

  /**
   * 移除已完成/错误的下载结果（清理 aria2 内部记录）
   */
  async removeDownloadResult(gid: string): Promise<string> {
    return this.call('aria2.removeDownloadResult', gid) as Promise<string>;
  }

  /**
   * 获取 aria2 版本信息（用于健康检查）
   */
  async getVersion(): Promise<{ version: string }> {
    return this.call('aria2.getVersion') as Promise<{ version: string }>;
  }
}
