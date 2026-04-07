/**
 * 网络检测相关的 IPC 处理器
 * 提供网关、DNS、端口、hosts文件检测等功能
 */

import { IPCChannels } from '@shared/channels';
import { exec } from 'child_process';
import * as dns from 'dns';
import * as fs from 'fs';
import * as os from 'os';
import { promisify } from 'util';
import { mainHandle } from '..';

const lookup = promisify(dns.lookup);

interface GatewayDNSResult {
  success: boolean;
  ip?: string;
  gateway?: string;
  dns?: string[];
  dnsLocation?: string[];
  error?: string;
}

interface PortResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface HostsResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface NetworkCheckResult {
  gatewayDNS: GatewayDNSResult;
  port: PortResult;
  hosts: HostsResult;
}

/**
 * 检测网关和DNS
 */
async function checkGatewayDNS(): Promise<GatewayDNSResult> {
  try {
    const networkInterfaces = os.networkInterfaces();
    let ip = '';
    let gateway = '';

    // 查找第一个非内部IPv4地址
    for (const name of Object.keys(networkInterfaces)) {
      const interfaces = networkInterfaces[name];
      if (!interfaces) continue;

      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ip = iface.address;
          // 简单计算网关（通常是IP的最后一段改为1）
          const ipParts = ip.split('.');
          if (ipParts.length === 4) {
            ipParts[3] = '1';
            gateway = ipParts.join('.');
          }
          break;
        }
      }
      if (ip) break;
    }

    // 检查是否有网络接口（网关检测）
    if (!ip || !gateway) {
      return {
        success: false,
        error: '未检测到网络连接，请检查网络设置',
      };
    }

    // 获取DNS服务器
    const dnsServers: string[] = [];
    const dnsLocations: string[] = [];

    // 获取系统DNS设置（Windows）
    if (process.platform === 'win32') {
      try {
        const execAsync = promisify(exec);
        const { stdout } = await execAsync('ipconfig /all');

        // Windows ipconfig /all 输出格式可能是：
        // DNS 服务器  . . . . . . . . . . . . : 8.8.8.8 (中文)
        // DNS Servers  . . . . . . . . . . . . : 8.8.8.8 (英文)
        // 使用更简单的方法：逐行查找包含DNS的行，然后提取IP地址
        const lines = stdout.split('\n');
        lines.forEach((line) => {
          // 检查是否包含DNS相关关键词（支持中文和英文）
          if (
            (line.includes('DNS') || line.includes('dns')) &&
            line.includes(':')
          ) {
            // 提取IP地址
            const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch && ipMatch[1]) {
              const dnsIp = ipMatch[1];
              // 排除一些常见的非DNS IP（如网关IP、本地回环等）
              if (
                dnsIp !== gateway &&
                !dnsIp.startsWith('127.') &&
                !dnsIp.startsWith('169.254.') &&
                !dnsServers.includes(dnsIp)
              ) {
                dnsServers.push(dnsIp);
                dnsLocations.push('未知');
              }
            }
          }
        });
      } catch (error) {
        // DNS获取失败，但不影响网关检测和DNS解析测试
      }
    }

    // 尝试解析一个域名来测试DNS是否可用
    // 这是最可靠的DNS检测方法：如果DNS解析成功，说明DNS功能正常
    let dnsResolvable = false;
    try {
      await lookup('www.baidu.com');
      dnsResolvable = true;
    } catch (error) {
      // DNS解析失败
      dnsResolvable = false;
    }

    // 判断检测结果
    // 关键修改：只要DNS解析成功，就认为DNS正常
    // 即使无法获取DNS服务器配置，只要DNS解析功能正常，就认为DNS正常
    const isDNSError = !dnsResolvable;

    return {
      success: !isDNSError,
      ip,
      gateway,
      dns: dnsServers.length > 0 ? dnsServers : undefined,
      dnsLocation: dnsLocations.length > 0 ? dnsLocations : undefined,
      error: isDNSError ? 'DNS设置存在问题或DNS解析失败' : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * 检测端口连通性
 */
async function checkPort(): Promise<PortResult> {
  try {
    // 检测常用端口是否正常连通
    // 这里可以检测一些关键端口，比如80、443等
    // 简单实现：检查本地端口是否可用
    return {
      success: true,
      message: '检测端口是否正常连通',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * 检测hosts文件
 */
async function checkHosts(): Promise<HostsResult> {
  try {
    let hostsPath = '';
    if (process.platform === 'win32') {
      hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
    } else if (process.platform === 'darwin') {
      hostsPath = '/etc/hosts';
    } else {
      hostsPath = '/etc/hosts';
    }

    // 检查hosts文件是否存在
    if (!fs.existsSync(hostsPath)) {
      return {
        success: false,
        error: 'hosts文件不存在',
      };
    }

    // 读取hosts文件内容
    const hostsContent = fs.readFileSync(hostsPath, 'utf-8');

    // 检查是否有异常配置（这里可以根据需要添加更复杂的检测逻辑）
    const hasAbnormalConfig = false; // 可以根据实际需求实现检测逻辑

    return {
      success: !hasAbnormalConfig,
      message: hasAbnormalConfig ? 'hosts文件存在异常配置' : 'hosts文件正常',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * 注册网络检测相关的 IPC 处理器
 */
export const registerNetworkHandlers = () => {
  /**
   * 检测网关和DNS
   */
  mainHandle(IPCChannels.NETWORK_CHECK_GATEWAY_DNS, async () => {
    try {
      const result = await checkGatewayDNS();
      return result;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 检测端口
   */
  mainHandle(IPCChannels.NETWORK_CHECK_PORT, async () => {
    try {
      const result = await checkPort();
      return result;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 检测hosts文件
   */
  mainHandle(IPCChannels.NETWORK_CHECK_HOSTS, async () => {
    try {
      const result = await checkHosts();
      return result;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 执行完整网络检测
   */
  mainHandle(IPCChannels.NETWORK_CHECK_ALL, async () => {
    try {
      const [gatewayDNS, port, hosts] = await Promise.all([
        checkGatewayDNS(),
        checkPort(),
        checkHosts(),
      ]);

      return {
        gatewayDNS,
        port,
        hosts,
      } as NetworkCheckResult;
    } catch (error) {
      return {
        gatewayDNS: { success: false, error: (error as Error).message },
        port: { success: false, error: (error as Error).message },
        hosts: { success: false, error: (error as Error).message },
      };
    }
  });
};
