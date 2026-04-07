import { IPCChannels } from '@shared/channels';
import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';
import { mainHandle } from '..';

const execAsync = promisify(exec);

/**
 * 获取内存信息
 */
const getMemoryInfo = async (): Promise<string> => {
  const { platform } = process;

  try {
    if (platform === 'win32') {
      // Windows: 使用 wmic 命令获取内存信息
      try {
        const totalMemoryResult = await execAsync(
          'wmic computersystem get TotalPhysicalMemory /value',
        );
        const availableMemoryResult = await execAsync(
          'wmic os get FreePhysicalMemory /value',
        );

        const totalLines = totalMemoryResult.stdout.split('\n');
        const availableLines = availableMemoryResult.stdout.split('\n');

        const totalLine = totalLines.find((line) =>
          line.startsWith('TotalPhysicalMemory='),
        );
        const availableLine = availableLines.find((line) =>
          line.startsWith('FreePhysicalMemory='),
        );

        if (totalLine && availableLine) {
          const totalBytes = parseInt(
            totalLine.replace('TotalPhysicalMemory=', '').trim(),
            10,
          );
          const freeKB = parseInt(
            availableLine.replace('FreePhysicalMemory=', '').trim(),
            10,
          );

          if (!Number.isNaN(totalBytes) && !Number.isNaN(freeKB)) {
            const totalGB = totalBytes / (1024 * 1024 * 1024);
            const freeGB = freeKB / (1024 * 1024); // freeKB 是 KB，转换为 GB
            return `${totalGB.toFixed(1)} GB (${freeGB.toFixed(1)} GB 可用)`;
          }
        }
      } catch (error) {
        console.warn('[IPC] wmic 命令失败，尝试使用 os.totalmem():', error);
      }
    } else if (platform === 'darwin') {
      // macOS: 使用 sysctl 命令
      try {
        const totalMemoryResult = await execAsync('sysctl hw.memsize');
        const totalBytes = parseInt(
          totalMemoryResult.stdout.split(':')[1].trim(),
          10,
        );
        if (!Number.isNaN(totalBytes)) {
          const totalGB = totalBytes / (1024 * 1024 * 1024);
          // macOS 获取可用内存比较复杂，这里只显示总内存
          return `${totalGB.toFixed(1)} GB`;
        }
      } catch (error) {
        console.warn('[IPC] sysctl 命令失败，尝试使用 os.totalmem():', error);
      }
    } else if (platform === 'linux') {
      // Linux: 读取 /proc/meminfo
      try {
        const { stdout } = await execAsync(
          "grep -E '^MemTotal:|^MemAvailable:' /proc/meminfo",
        );
        const lines = stdout.split('\n');
        const totalLine = lines.find((line) => line.startsWith('MemTotal:'));
        const availableLine = lines.find((line) =>
          line.startsWith('MemAvailable:'),
        );

        if (totalLine && availableLine) {
          const totalKB = parseInt(totalLine.split(/\s+/)[1], 10);
          const availableKB = parseInt(availableLine.split(/\s+/)[1], 10);

          if (!Number.isNaN(totalKB) && !Number.isNaN(availableKB)) {
            const totalGB = totalKB / (1024 * 1024);
            const availableGB = availableKB / (1024 * 1024);
            const usedGB = totalGB - availableGB;
            return `${totalGB.toFixed(1)} GB (${usedGB.toFixed(1)} GB 可用)`;
          }
        }
      } catch (error) {
        console.warn(
          '[IPC] 读取 /proc/meminfo 失败，尝试使用 os.totalmem():',
          error,
        );
      }
    }

    // 回退方案：使用 os.totalmem()
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const freeGB = freeBytes / (1024 * 1024 * 1024);
    const usedGB = totalGB - freeGB;
    return `${totalGB.toFixed(1)} GB (${usedGB.toFixed(1)} GB 可用)`;
  } catch (error) {
    console.error('[IPC] 获取内存信息失败:', error);
    return 'Unknown Memory';
  }
};

/**
 * 获取显卡信息
 */
const getGpuInfo = async (): Promise<string> => {
  const { platform } = process;

  try {
    if (platform === 'win32') {
      // Windows: 使用 wmic 命令获取显卡信息
      try {
        const { stdout } = await execAsync(
          'wmic path win32_VideoController get name,AdapterRAM /value',
        );
        const lines = stdout.split('\n');
        const gpuInfo: { name?: string; adapterRAM?: string } = {};

        lines.forEach((line) => {
          if (line.startsWith('Name=')) {
            gpuInfo.name = line.replace('Name=', '').trim();
          } else if (line.startsWith('AdapterRAM=')) {
            gpuInfo.adapterRAM = line.replace('AdapterRAM=', '').trim();
          }
        });

        if (gpuInfo.name) {
          let result = gpuInfo.name;
          if (gpuInfo.adapterRAM && gpuInfo.adapterRAM !== '') {
            try {
              const ramBytes = parseInt(gpuInfo.adapterRAM, 10);
              if (!Number.isNaN(ramBytes) && ramBytes > 0) {
                const ramGB = ramBytes / (1024 * 1024 * 1024);
                result += ` (${ramGB.toFixed(0)} GB)`;
              }
            } catch {
              // 忽略 RAM 解析错误
            }
          }
          return result;
        }
      } catch (error) {
        console.warn('[IPC] wmic 命令获取显卡信息失败:', error);
      }
    } else if (platform === 'darwin') {
      // macOS: 使用 system_profiler 命令
      try {
        const { stdout } = await execAsync(
          'system_profiler SPDisplaysDataType | grep "Chipset Model" | head -1',
        );
        const match = stdout.match(/Chipset Model:\s*(.+)/);
        if (match && match[1]) {
          return match[1].trim();
        }
      } catch (error) {
        console.warn('[IPC] system_profiler 命令失败:', error);
      }
    } else if (platform === 'linux') {
      // Linux: 尝试使用 nvidia-smi 或 lspci
      try {
        // 先尝试 nvidia-smi（如果有 NVIDIA 显卡）
        try {
          const { stdout } = await execAsync(
            'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | head -1',
          );
          const parts = stdout.trim().split(',');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const memory = parts[1].trim();
            return `${name} (${memory})`;
          }
        } catch {
          // nvidia-smi 失败，尝试 lspci
          const { stdout } = await execAsync('lspci | grep -i vga | head -1');
          if (stdout) {
            const match = stdout.match(/:\s*(.+)/);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
      } catch (error) {
        console.warn('[IPC] 获取显卡信息失败:', error);
      }
    }

    return 'Unknown GPU';
  } catch (error) {
    console.error('[IPC] 获取显卡信息失败:', error);
    return 'Unknown GPU';
  }
};

/**
 * 获取存储信息
 */
const getStorageInfo = async (): Promise<string> => {
  const { platform } = process;

  try {
    if (platform === 'win32') {
      // Windows: 使用 wmic 命令获取磁盘信息
      try {
        const { stdout } = await execAsync(
          'wmic diskdrive get model,size,mediatype /format:list',
        );
        const lines = stdout.split('\n');
        const storageDevices: Array<{
          model?: string;
          size?: string;
          mediatype?: string;
        }> = [];
        let currentDevice: {
          model?: string;
          size?: string;
          mediatype?: string;
        } = {};

        lines.forEach((line) => {
          if (line.startsWith('Model=')) {
            if (currentDevice.model || currentDevice.size) {
              storageDevices.push(currentDevice);
            }
            currentDevice = {
              model: line.replace('Model=', '').trim(),
            };
          } else if (line.startsWith('Size=')) {
            currentDevice.size = line.replace('Size=', '').trim();
          } else if (line.startsWith('MediaType=')) {
            currentDevice.mediatype = line.replace('MediaType=', '').trim();
          }
        });

        if (currentDevice.model || currentDevice.size) {
          storageDevices.push(currentDevice);
        }

        const formattedDevices = storageDevices
          .filter((device) => device.model && device.size)
          .map((device) => {
            const sizeBytes = parseInt(device.size || '0', 10);
            const sizeGB = sizeBytes / (1024 * 1024 * 1024);
            const type =
              device.mediatype === 'Fixed hard disk media' ? 'HDD' : 'SSD';
            return `${sizeGB.toFixed(0)} GB ${type} ${device.model}`;
          });

        return formattedDevices.join(', ') || 'Unknown Storage';
      } catch (error) {
        console.warn('[IPC] wmic 命令获取存储信息失败:', error);
      }
    } else if (platform === 'darwin') {
      // macOS: 使用 diskutil 命令
      try {
        const { stdout } = await execAsync(
          "diskutil list | grep -E 'disk[0-9]' | head -5",
        );
        return stdout.trim() || 'Unknown Storage';
      } catch (error) {
        console.warn('[IPC] diskutil 命令失败:', error);
      }
    } else if (platform === 'linux') {
      // Linux: 使用 lsblk 命令
      try {
        const { stdout } = await execAsync(
          "lsblk -d -o NAME,SIZE,MODEL | grep -v '^NAME'",
        );
        return stdout.trim() || 'Unknown Storage';
      } catch (error) {
        console.warn('[IPC] lsblk 命令失败:', error);
      }
    }

    return 'Unknown Storage';
  } catch (error) {
    console.error('[IPC] 获取存储信息失败:', error);
    return 'Unknown Storage';
  }
};

/**
 * 获取设备 ID（UUID）
 */
const getDeviceId = async (): Promise<string> => {
  const { platform } = process;

  try {
    if (platform === 'win32') {
      // Windows: 使用 wmic 命令获取计算机系统 UUID
      try {
        const { stdout } = await execAsync('wmic csproduct get uuid /value');
        const lines = stdout.split('\n');
        const uuidLine = lines.find((line) => line.startsWith('UUID='));
        if (uuidLine) {
          return uuidLine.replace('UUID=', '').trim();
        }
      } catch (error) {
        console.warn('[IPC] wmic 命令获取设备 ID 失败:', error);
      }
    } else if (platform === 'darwin') {
      // macOS: 使用 system_profiler 或 ioreg
      try {
        const { stdout } = await execAsync(
          'ioreg -rd1 -c IOPlatformExpertDevice | grep -E "IOPlatformUUID"',
        );
        const match = stdout.match(/"IOPlatformUUID"="(.+)"/);
        if (match && match[1]) {
          return match[1];
        }
      } catch (error) {
        console.warn('[IPC] ioreg 命令失败:', error);
      }
    } else if (platform === 'linux') {
      // Linux: 读取 /etc/machine-id 或 /var/lib/dbus/machine-id
      try {
        const { stdout } = await execAsync('cat /etc/machine-id');
        return stdout.trim() || 'Unknown Device ID';
      } catch (error) {
        console.warn('[IPC] 读取 machine-id 失败:', error);
      }
    }

    // 回退方案：使用 hostname 生成一个简单的 ID
    return os.hostname() || 'Unknown Device ID';
  } catch (error) {
    console.error('[IPC] 获取设备 ID 失败:', error);
    return 'Unknown Device ID';
  }
};

/**
 * 获取产品 ID（Windows 产品 ID）
 */
const getProductId = async (): Promise<string> => {
  const { platform } = process;

  try {
    if (platform === 'win32') {
      // Windows: 使用 wmic 命令获取产品 ID
      try {
        const { stdout } = await execAsync('wmic os get SerialNumber /value');
        const lines = stdout.split('\n');
        const serialLine = lines.find((line) =>
          line.startsWith('SerialNumber='),
        );
        if (serialLine) {
          const serial = serialLine.replace('SerialNumber=', '').trim();
          if (serial && serial !== '') {
            return serial;
          }
        }

        // 如果 SerialNumber 为空，尝试获取产品密钥 ID
        const { stdout: productKey } = await execAsync(
          'wmic path softwarelicensingservice get OA3xOriginalProductKey /value',
        );
        const productKeyLines = productKey.split('\n');
        const keyLine = productKeyLines.find((line) =>
          line.startsWith('OA3xOriginalProductKey='),
        );
        if (keyLine) {
          const key = keyLine.replace('OA3xOriginalProductKey=', '').trim();
          if (key && key !== '') {
            return key;
          }
        }
      } catch (error) {
        console.warn('[IPC] wmic 命令获取产品 ID 失败:', error);
      }
    }

    return 'N/A';
  } catch (error) {
    console.error('[IPC] 获取产品 ID 失败:', error);
    return 'N/A';
  }
};

/**
 * 获取系统类型
 */
const getSystemType = async (): Promise<string> => {
  const { platform, arch } = process;

  try {
    if (platform === 'win32') {
      // Windows: 检查是否为 64 位系统
      const is64Bit =
        arch === 'x64' || process.env.PROCESSOR_ARCHITECTURE === 'AMD64';
      return is64Bit
        ? '64 位操作系统, 基于 x64 的处理器'
        : '32 位操作系统, 基于 x86 的处理器';
    } else if (platform === 'darwin') {
      // macOS: 检查架构
      const is64Bit = arch === 'x64' || arch === 'arm64';
      return is64Bit ? `64 位操作系统, 基于 ${arch} 的处理器` : '32 位操作系统';
    } else if (platform === 'linux') {
      // Linux: 检查架构
      const is64Bit = arch === 'x64' || arch === 'arm64';
      return is64Bit ? `64 位操作系统, 基于 ${arch} 的处理器` : '32 位操作系统';
    }

    return `${arch} 架构`;
  } catch (error) {
    console.error('[IPC] 获取系统类型失败:', error);
    return 'Unknown System Type';
  }
};

/**
 * 获取触控支持信息
 */
const getTouchInfo = async (): Promise<string> => {
  const { platform } = process;

  try {
    if (platform === 'win32') {
      // Windows: 检查是否有触控设备
      try {
        const { stdout } = await execAsync(
          'wmic path Win32_PointingDevice get Description /value',
        );
        const lines = stdout.split('\n');
        const hasTouch = lines.some(
          (line) =>
            line.toLowerCase().includes('touch') ||
            line.toLowerCase().includes('触控'),
        );

        if (hasTouch) {
          return '支持触控输入';
        } else {
          return '没有可用于此显示器的笔或触控输入';
        }
      } catch (error) {
        console.warn('[IPC] wmic 命令获取触控信息失败:', error);
        return '无法检测触控支持';
      }
    } else if (platform === 'darwin') {
      // macOS: 检查是否有触控板或触控屏
      try {
        const { stdout } = await execAsync(
          'system_profiler SPUSBDataType | grep -i "touch"',
        );
        return stdout.trim()
          ? '支持触控输入'
          : '没有可用于此显示器的笔或触控输入';
      } catch (error) {
        return '无法检测触控支持';
      }
    } else if (platform === 'linux') {
      // Linux: 检查输入设备
      try {
        const { stdout } = await execAsync('ls /dev/input/ | grep -i touch');
        return stdout.trim()
          ? '支持触控输入'
          : '没有可用于此显示器的笔或触控输入';
      } catch (error) {
        return '无法检测触控支持';
      }
    }

    return '无法检测触控支持';
  } catch (error) {
    console.error('[IPC] 获取触控信息失败:', error);
    return '无法检测触控支持';
  }
};

/**
 * 获取处理器信息
 */
const getCpuInfo = async (): Promise<string> => {
  const { platform } = process;

  try {
    if (platform === 'win32') {
      // Windows: 使用 wmic 命令获取处理器名称
      try {
        const { stdout } = await execAsync('wmic cpu get name /value');
        const lines = stdout.split('\n');
        const nameLine = lines.find((line) => line.startsWith('Name='));
        if (nameLine) {
          return nameLine.replace('Name=', '').trim();
        }
      } catch (error) {
        console.warn('[IPC] wmic 命令失败，尝试使用 os.cpus():', error);
      }
    } else if (platform === 'darwin') {
      // macOS: 使用 sysctl 命令
      try {
        const { stdout } = await execAsync(
          'sysctl -n machdep.cpu.brand_string',
        );
        return stdout.trim();
      } catch (error) {
        console.warn('[IPC] sysctl 命令失败，尝试使用 os.cpus():', error);
      }
    } else if (platform === 'linux') {
      // Linux: 读取 /proc/cpuinfo
      try {
        const { stdout } = await execAsync(
          "grep -m 1 'model name' /proc/cpuinfo | cut -d ':' -f 2",
        );
        return stdout.trim();
      } catch (error) {
        console.warn(
          '[IPC] 读取 /proc/cpuinfo 失败，尝试使用 os.cpus():',
          error,
        );
      }
    }

    // 回退方案：使用 os.cpus()
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      const cpu = cpus[0];
      const model = cpu.model || 'Unknown CPU';
      const speed = cpu.speed ? `${(cpu.speed / 1000).toFixed(2)} GHz` : '';
      return speed ? `${model} ${speed}` : model;
    }

    return 'Unknown CPU';
  } catch (error) {
    console.error('[IPC] 获取处理器信息失败:', error);
    return 'Unknown CPU';
  }
};

/**
 * 注册系统信息相关的 IPC 处理器
 */
export const registerSystemHandlers = () => {
  /**
   * 获取设备名（主机名）
   */
  mainHandle(IPCChannels.GET_DEVICE_NAME, async () => {
    try {
      const deviceName = os.hostname();
      return {
        success: true,
        data: deviceName,
      };
    } catch (error) {
      console.error('[IPC] 获取设备名失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取设备名失败',
        data: 'unknown',
      };
    }
  });

  /**
   * 获取处理器信息
   */
  mainHandle(IPCChannels.GET_CPU_INFO, async () => {
    try {
      const cpuInfo = await getCpuInfo();
      return {
        success: true,
        data: cpuInfo,
      };
    } catch (error) {
      console.error('[IPC] 获取处理器信息失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取处理器信息失败',
        data: 'Unknown CPU',
      };
    }
  });

  /**
   * 获取内存信息
   */
  mainHandle(IPCChannels.GET_MEMORY_INFO, async () => {
    try {
      const memoryInfo = await getMemoryInfo();
      return {
        success: true,
        data: memoryInfo,
      };
    } catch (error) {
      console.error('[IPC] 获取内存信息失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取内存信息失败',
        data: 'Unknown Memory',
      };
    }
  });

  /**
   * 获取显卡信息
   */
  mainHandle(IPCChannels.GET_GPU_INFO, async () => {
    try {
      const gpuInfo = await getGpuInfo();
      return {
        success: true,
        data: gpuInfo,
      };
    } catch (error) {
      console.error('[IPC] 获取显卡信息失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取显卡信息失败',
        data: 'Unknown GPU',
      };
    }
  });

  /**
   * 获取存储信息
   */
  mainHandle(IPCChannels.GET_STORAGE_INFO, async () => {
    try {
      const storageInfo = await getStorageInfo();
      return {
        success: true,
        data: storageInfo,
      };
    } catch (error) {
      console.error('[IPC] 获取存储信息失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取存储信息失败',
        data: 'Unknown Storage',
      };
    }
  });

  /**
   * 获取设备 ID
   */
  mainHandle(IPCChannels.GET_DEVICE_ID, async () => {
    try {
      const deviceId = await getDeviceId();
      return {
        success: true,
        data: deviceId,
      };
    } catch (error) {
      console.error('[IPC] 获取设备 ID 失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取设备 ID 失败',
        data: 'Unknown Device ID',
      };
    }
  });

  /**
   * 获取产品 ID
   */
  mainHandle(IPCChannels.GET_PRODUCT_ID, async () => {
    try {
      const productId = await getProductId();
      return {
        success: true,
        data: productId,
      };
    } catch (error) {
      console.error('[IPC] 获取产品 ID 失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取产品 ID 失败',
        data: 'N/A',
      };
    }
  });

  /**
   * 获取系统类型
   */
  mainHandle(IPCChannels.GET_SYSTEM_TYPE, async () => {
    try {
      const systemType = await getSystemType();
      return {
        success: true,
        data: systemType,
      };
    } catch (error) {
      console.error('[IPC] 获取系统类型失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取系统类型失败',
        data: 'Unknown System Type',
      };
    }
  });

  /**
   * 获取触控支持信息
   */
  mainHandle(IPCChannels.GET_TOUCH_INFO, async () => {
    try {
      const touchInfo = await getTouchInfo();
      return {
        success: true,
        data: touchInfo,
      };
    } catch (error) {
      console.error('[IPC] 获取触控信息失败:', error);
      return {
        success: false,
        error: (error as Error).message || '获取触控信息失败',
        data: '无法检测触控支持',
      };
    }
  });

  console.log('✅ 系统信息 IPC 处理器已注册');
};
