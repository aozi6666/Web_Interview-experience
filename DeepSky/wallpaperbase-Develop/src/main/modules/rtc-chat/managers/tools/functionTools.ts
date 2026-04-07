import * as os from 'os';
import type { Session } from '../agent/Session';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) {
    return '未知';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(2)} ${units[idx]}`;
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);
  const parts: string[] = [];
  if (d) parts.push(`${d}天`);
  if (h) parts.push(`${h}小时`);
  if (m) parts.push(`${m}分`);
  parts.push(`${s}秒`);
  return parts.join('');
}

function buildCpuText(): string {
  const cpus = os.cpus() || [];
  const coreCount = cpus.length || 1;
  const loadAvg = os.loadavg?.()[0] || 0;
  const usage = Math.max(
    0,
    Math.min(100, Math.round((loadAvg / coreCount) * 100)),
  );
  const model = cpus[0]?.model || '未知型号';
  return `CPU：${model}，${coreCount} 核，估算占用 ${usage}%`;
}

function buildMemoryText(): string {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percent = total ? Math.round((used / total) * 100) : 0;
  return `内存：已用 ${formatBytes(used)} / ${formatBytes(total)}（${percent}%）`;
}

function buildProcessText(): string {
  const mem = process.memoryUsage();
  return `当前进程内存：RSS ${formatBytes(mem.rss)}，Heap ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}`;
}

function sanitizeAssistantName(name: unknown): string {
  const raw = typeof name === 'string' ? name : String(name ?? '');
  return raw.trim().replace(/\s+/g, ' ').slice(0, 32);
}

export function registerBuiltInFunctionTools(session: Session): void {
  session.AddFunctionTool(
    {
      name: 'get_system_info',
      description: '查询电脑系统信息，包括 CPU、内存、进程占用等',
      parametersJson: JSON.stringify({
        type: 'object',
        properties: {
          info_type: {
            type: 'string',
            enum: ['cpu', 'memory', 'process', 'summary'],
            description: '要查询的信息类型：cpu/memory/process/summary',
          },
        },
        required: ['info_type'],
      }),
      options: {
        soothingMessages: [
          '正在检查系统信息...',
          '让我看看电脑状态。',
          '马上为你查询。',
        ],
        defaultDirectTTS: false,
        defaultInterruptMode: 2,
      },
    },
    (args: any) => {
      const typeRaw = args?.info_type || args?.infoType || 'summary';
      const infoType = String(typeRaw).toLowerCase();
      switch (infoType) {
        case 'cpu':
          return {
            content: buildCpuText(),
            directTTS: false,
            interruptMode: 2,
          };
        case 'memory':
          return {
            content: buildMemoryText(),
            directTTS: false,
            interruptMode: 2,
          };
        case 'process':
          return {
            content: buildProcessText(),
            directTTS: false,
            interruptMode: 2,
          };
        default:
          return {
            content: `${buildCpuText()} | ${buildMemoryText()} | 系统运行时间：${formatDuration(os.uptime())} | ${buildProcessText()}`,
            directTTS: false,
            interruptMode: 2,
          };
      }
    },
  );

  session.AddFunctionTool(
    {
      name: 'set_assistant_profile',
      description:
        '修改你的名字。注意只有改你的名字才调用，改用户自己的称呼不用调用。',
      parametersJson: JSON.stringify({
        type: 'object',
        properties: {
          assistant_name: {
            type: 'string',
            description: '新的助手名字/称呼',
          },
        },
        required: ['assistant_name'],
      }),
      options: {
        soothingMessages: [
          '正在帮你改名...',
          '好的，我马上更新名字。',
          '让我同步一下新的名字。',
        ],
        defaultDirectTTS: false,
        defaultInterruptMode: 2,
      },
    },
    (args: any) => {
      const nextName = sanitizeAssistantName(
        args?.assistant_name ?? args?.assistantName,
      );
      if (!nextName) {
        return {
          content: '改名失败：新名字不能为空。请提供一个新的名字。',
          directTTS: false,
          interruptMode: 2,
        };
      }
      session
        .UpdateVoiceChatProfile({ assistantName: nextName })
        .catch((err) => {
          console.warn('[functionTools] UpdateVoiceChatProfile failed', err);
        });
      return {
        content: `已完成改名：从现在起你的名字是「${nextName}」。`,
        directTTS: false,
        interruptMode: 2,
      };
    },
  );
}
