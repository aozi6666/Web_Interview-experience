/**
 * RTC 聊天测试组件
 * 用于验证 RTC AI 对话链路与当前人设同步状态
 */

import type { Character } from '@stores/CharacterStore';
import { characterState } from '@stores/CharacterStore';
import { loadWallpaperConfig } from '@api/wallpaperConfig';
import {
  Button,
  Card,
  Descriptions,
  Input,
  Slider,
  Space,
  Switch,
  Tag,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import { useRTCContext } from '../../contexts/RTCContext';
import { InterruptMode } from '../../types/rtcChat';

type SubtitleHistoryItem = {
  id: string;
  uid: string;
  role: 'user' | 'assistant' | 'unknown';
  text: string;
  isFinal: boolean;
  roundId?: string;
  timestamp: number;
};

const MAX_LOGS = 30;
const MAX_SUBTITLE_HISTORY = 40;

const toStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return undefined;
};

const toStringOrEmpty = (value: unknown): string => {
  return toStringOrUndefined(value) || '';
};

const buildCharacterFromWallpaperConfig = (config: any): Character | null => {
  const agent = config?.libs?.agents?.[0];
  const prompt = agent?.prompt_extern_json;
  const name = toStringOrUndefined(prompt?.name);
  if (!name) {
    return null;
  }

  const agentId = toStringOrUndefined(agent?.id);
  const levelId = toStringOrUndefined(config?.levelId);

  return {
    id: levelId || agentId || `local_${name}`,
    name,
    identity: toStringOrEmpty(prompt?.identity),
    personality: toStringOrEmpty(prompt?.personality),
    languageStyle: toStringOrUndefined(prompt?.languageStyle),
    relationships: toStringOrUndefined(prompt?.relationships),
    experience: toStringOrUndefined(prompt?.experience),
    background: toStringOrUndefined(prompt?.background),
    voice_id: toStringOrUndefined(prompt?.voice_id),
    bot_id: toStringOrUndefined(prompt?.bot_id),
    createdAt: new Date().toISOString(),
  };
};

const cloneCharacter = (
  snapshotCharacter: Character | null,
): Character | null => {
  if (!snapshotCharacter) {
    return null;
  }

  return {
    ...snapshotCharacter,
    accessible_agent_ids: snapshotCharacter.accessible_agent_ids
      ? [...snapshotCharacter.accessible_agent_ids]
      : undefined,
  };
};

const resolveSubtitleRole = (
  uid: string,
  assistantId?: string,
): SubtitleHistoryItem['role'] => {
  if (uid === (assistantId || '')) {
    return 'assistant';
  }
  if (uid.toLowerCase().includes('bot')) {
    return 'assistant';
  }
  if (uid.toLowerCase().includes('user')) {
    return 'user';
  }
  return 'unknown';
};

const getRoleLabel = (role: SubtitleHistoryItem['role']) => {
  if (role === 'assistant') {
    return 'AI';
  }
  if (role === 'user') {
    return '用户';
  }
  return '未知';
};

const getSubtitleBgColor = (role: SubtitleHistoryItem['role']) => {
  if (role === 'assistant') {
    return '#f6ffed';
  }
  if (role === 'user') {
    return '#e6f7ff';
  }
  return '#fff';
};

const RTCChatTest = () => {
  const [inputMessage, setInputMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [subtitleHistory, setSubtitleHistory] = useState<SubtitleHistoryItem[]>(
    [],
  );
  const [volume, setVolume] = useState(100);
  const [isPressTalking, setIsPressTalking] = useState(false);
  const [localCharacter, setLocalCharacter] = useState<Character | null>(null);

  const rtcContext = useRTCContext();
  const characterSnapshot = useSnapshot(characterState);
  const storeCharacter = useMemo(
    () =>
      cloneCharacter(characterSnapshot.selectedCharacter as Character | null),
    [characterSnapshot.selectedCharacter],
  );
  const effectiveCharacter = storeCharacter || localCharacter;
  let characterSourceLabel = '未设置角色';
  if (storeCharacter) {
    characterSourceLabel = '当前壁纸人设（运行时）';
  } else if (localCharacter) {
    characterSourceLabel = '当前壁纸人设（本地配置）';
  }

  useEffect(() => {
    const loadLocalWallpaperCharacter = async () => {
      try {
        const result = await loadWallpaperConfig();
        if (!result.success || !result.config) {
          return;
        }
        const character = buildCharacterFromWallpaperConfig(result.config);
        if (character) {
          setLocalCharacter(character);
        }
      } catch (error) {
        console.error('[RTCChatTest] 读取本地壁纸配置失败:', error);
      }
    };

    loadLocalWallpaperCharacter();
  }, []);

  const isCharacterSynced = useMemo(() => {
    if (!effectiveCharacter && !rtcContext.currentCharacter) {
      return true;
    }
    return effectiveCharacter?.id === rtcContext.currentCharacter?.id;
  }, [effectiveCharacter, rtcContext.currentCharacter]);

  const conversationStage = rtcContext.conversationState?.stage;

  const getStageColor = (description?: string) => {
    const text = (description || '').toLowerCase();
    if (
      text.includes('error') ||
      text.includes('失败') ||
      text.includes('异常')
    ) {
      return 'red';
    }
    if (
      text.includes('asr') ||
      text.includes('listen') ||
      text.includes('识别')
    ) {
      return 'blue';
    }
    if (
      text.includes('llm') ||
      text.includes('think') ||
      text.includes('思考')
    ) {
      return 'purple';
    }
    if (
      text.includes('tts') ||
      text.includes('speak') ||
      text.includes('播报')
    ) {
      return 'green';
    }
    return 'default';
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    const logEntry = `[${timestamp}] ${message}`;
    setLogs((prev) => [...prev, logEntry].slice(-MAX_LOGS));
  };

  useEffect(() => {
    const subtitle = rtcContext.currentSubtitle;
    if (!subtitle?.text?.trim()) {
      return;
    }

    const uid = subtitle.uid || '';
    const role = resolveSubtitleRole(uid, rtcContext.currentCharacter?.id);

    setSubtitleHistory((prev) => {
      const nextItem: SubtitleHistoryItem = {
        id: `${subtitle.roundId || 'round'}-${subtitle.streamId || 'stream'}-${
          subtitle.timestamp || Date.now()
        }`,
        uid,
        role,
        text: subtitle.text,
        isFinal: Boolean(subtitle.isFinal),
        roundId: subtitle.roundId,
        timestamp: subtitle.timestamp || Date.now(),
      };
      return [...prev, nextItem].slice(-MAX_SUBTITLE_HISTORY);
    });
  }, [rtcContext.currentSubtitle, rtcContext.currentCharacter?.id]);

  const handleStart = async () => {
    addLog('启动 RTC');
    const success = await rtcContext.startRTC();
    addLog(success ? 'RTC 启动成功' : 'RTC 启动失败');
  };

  const handleStop = async () => {
    addLog('停止 RTC');
    const success = await rtcContext.stopRTC();
    addLog(success ? 'RTC 已停止' : 'RTC 停止失败');
  };

  const handleSyncCharacterAndStart = async () => {
    if (!effectiveCharacter) {
      addLog('未找到当前壁纸人设，无法初始化');
      return;
    }

    addLog(`同步人设并连接: ${effectiveCharacter.name}`);

    if (rtcContext.isActive) {
      const switched = await rtcContext.switchCharacter(effectiveCharacter);
      addLog(switched ? '人设切换并重连成功' : '人设切换失败');
      return;
    }

    const initialized =
      await rtcContext.initializeWithCharacter(effectiveCharacter);
    if (!initialized) {
      addLog('人设初始化失败');
      return;
    }

    const started = await rtcContext.startRTC();
    addLog(started ? '初始化并启动成功' : '初始化成功，但启动失败');
  };

  const handleReconnect = async () => {
    const character = effectiveCharacter || rtcContext.currentCharacter;
    if (!character) {
      addLog('无可用人设，无法重连');
      return;
    }

    addLog(`强制重连: ${character.name}`);
    const success = await rtcContext.switchCharacter(character);
    addLog(success ? '重连成功' : '重连失败');
  };

  const sendDirectMessage = async (text: string): Promise<boolean> => {
    const pureText = text.trim();
    if (!pureText) {
      addLog('消息不能为空');
      return false;
    }

    addLog(`发送消息: ${pureText}`);
    const success = await rtcContext.sendMessage(
      pureText,
      InterruptMode.Medium,
    );
    addLog(success ? '消息发送成功' : '消息发送失败');
    return success;
  };

  const handleSend = async () => {
    const success = await sendDirectMessage(inputMessage);
    if (success) {
      setInputMessage('');
    }
  };

  const handleToggleAutoConnect = (enabled: boolean) => {
    rtcContext.setAutoConnect(enabled);
    addLog(`自动连接已${enabled ? '启用' : '禁用'}`);
  };

  const handleToggleMute = async (muted: boolean) => {
    const success = await rtcContext.mute(muted);
    addLog(success ? `麦克风已${muted ? '关闭' : '开启'}` : '麦克风切换失败');
  };

  const handleVolumeChange = async (nextValue: number | number[]) => {
    const targetVolume = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    setVolume(targetVolume);
    const success = await rtcContext.setVolume(targetVolume);
    if (!success) {
      addLog('音量设置失败（RTC 未激活）');
    }
  };

  const handlePressTalkStart = async () => {
    if (!rtcContext.isActive || isPressTalking) {
      return;
    }
    setIsPressTalking(true);
    const success = await rtcContext.mute(false);
    if (!success) {
      addLog('按住说话失败：无法开麦');
    }
  };

  const handlePressTalkEnd = async () => {
    if (!rtcContext.isActive || !isPressTalking) {
      return;
    }
    setIsPressTalking(false);
    await rtcContext.mute(true);
  };

  return (
    <Card
      title="RTC AI 对话测试控制台"
      size="small"
      style={{ marginTop: '16px' }}
      extra={
        <Space>
          <Tag color={rtcContext.isConnected ? 'green' : 'default'}>
            {rtcContext.isConnected ? '已连接' : '未连接'}
          </Tag>
          <Tag color={rtcContext.isActive ? 'blue' : 'default'}>
            {rtcContext.isActive ? '会话中' : '未激活'}
          </Tag>
          <Tag color={rtcContext.isUERunning ? 'orange' : 'default'}>
            {rtcContext.isUERunning ? 'UE 运行中' : 'UE 未运行'}
          </Tag>
        </Space>
      }
    >
      {rtcContext.isUERunning && (
        <div
          style={{
            backgroundColor: '#fff7e6',
            padding: '10px 12px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#d46b08',
            borderLeft: '3px solid #fa8c16',
          }}
        >
          当前 UE 处于运行状态，RTC 可能被自动接管策略影响。
        </div>
      )}

      <div
        style={{
          backgroundColor: '#e6f7ff',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '16px',
          borderLeft: '4px solid #1890ff',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{characterSourceLabel}</span>
          <Space size={6}>
            {!storeCharacter && localCharacter ? (
              <Tag color="cyan">来源: 本地配置</Tag>
            ) : null}
            <Tag color={isCharacterSynced ? 'green' : 'gold'}>
              {isCharacterSynced ? '已同步到 RTC' : 'RTC 人设未同步'}
            </Tag>
          </Space>
        </div>

        {effectiveCharacter ? (
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="角色名称">
              <strong>{effectiveCharacter.name}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="角色ID">
              <code style={{ fontSize: '11px' }}>{effectiveCharacter.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label="身份设定">
              {effectiveCharacter.identity?.substring(0, 80) || '未设置'}
              {effectiveCharacter.identity &&
              effectiveCharacter.identity.length > 80
                ? '...'
                : ''}
            </Descriptions.Item>
            <Descriptions.Item label="音色">
              {effectiveCharacter.voice_id || '默认音色'}
            </Descriptions.Item>
            <Descriptions.Item label="RTC 当前角色">
              {rtcContext.currentCharacter
                ? rtcContext.currentCharacter.name
                : '未初始化'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div
            style={{
              color: '#999',
              fontSize: '13px',
              textAlign: 'center',
              padding: '16px',
            }}
          >
            未设置角色，请先应用壁纸人设。
          </div>
        )}
      </div>

      <div
        style={{
          backgroundColor: '#f5f5f5',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#666',
          }}
        >
          控制面板
        </div>
        <Space wrap>
          <Button
            type={isCharacterSynced ? 'default' : 'primary'}
            onClick={handleSyncCharacterAndStart}
            disabled={!effectiveCharacter}
            size="small"
          >
            同步人设并启动
          </Button>
          <Button
            type="primary"
            onClick={handleStart}
            disabled={rtcContext.isActive || !rtcContext.currentCharacter}
            size="small"
          >
            启动 RTC
          </Button>
          <Button
            danger
            onClick={handleStop}
            disabled={!rtcContext.isActive}
            size="small"
          >
            停止 RTC
          </Button>
          <Button
            type="dashed"
            onClick={handleReconnect}
            disabled={!effectiveCharacter && !rtcContext.currentCharacter}
            size="small"
            style={{ borderColor: '#52c41a', color: '#52c41a' }}
          >
            强制重连
          </Button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '8px',
              borderLeft: '1px solid #d9d9d9',
            }}
          >
            <Switch
              checked={rtcContext.isAutoConnect}
              onChange={handleToggleAutoConnect}
              checkedChildren="自动"
              unCheckedChildren="手动"
              size="small"
            />
            <span style={{ fontSize: '12px', color: '#666' }}>
              {rtcContext.isAutoConnect ? '自动连接' : '手动连接'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '8px',
              borderLeft: '1px solid #d9d9d9',
            }}
          >
            <Switch
              checked={!rtcContext.isMuted}
              onChange={(enabled) => handleToggleMute(!enabled)}
              checkedChildren="开麦"
              unCheckedChildren="闭麦"
              size="small"
              disabled={!rtcContext.isActive}
            />
            <span
              style={{
                fontSize: '12px',
                color: rtcContext.isActive ? '#666' : '#ccc',
              }}
            >
              {rtcContext.isMuted ? '麦克风已关闭' : '麦克风已开启'}
            </span>
          </div>

          <Button
            size="small"
            type={isPressTalking ? 'primary' : 'default'}
            disabled={!rtcContext.isActive}
            onMouseDown={handlePressTalkStart}
            onMouseUp={handlePressTalkEnd}
            onMouseLeave={handlePressTalkEnd}
            onTouchStart={handlePressTalkStart}
            onTouchEnd={handlePressTalkEnd}
          >
            {isPressTalking ? '正在说话...' : '按住说话'}
          </Button>
        </Space>

        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            输出音量: {volume}
          </div>
          <Slider
            min={0}
            max={100}
            value={volume}
            onChange={handleVolumeChange}
            disabled={!rtcContext.isActive}
          />
        </div>
      </div>

      <div
        style={{
          backgroundColor: '#fafafa',
          padding: '10px 12px',
          borderRadius: '4px',
          marginBottom: '12px',
          border: '1px solid #f0f0f0',
          fontSize: '12px',
        }}
      >
        <div style={{ marginBottom: '6px', fontWeight: 'bold', color: '#666' }}>
          对话状态
        </div>
        {rtcContext.conversationState ? (
          <Space wrap size={[8, 6]}>
            <Tag color={getStageColor(conversationStage?.description)}>
              stage: {conversationStage?.code ?? '-'} /{' '}
              {conversationStage?.description || '未知'}
            </Tag>
            <Tag>roundId: {rtcContext.conversationState.roundId}</Tag>
            <Tag>taskId: {rtcContext.conversationState.taskId}</Tag>
            {rtcContext.conversationState.errorInfo ? (
              <Tag color="red">
                error: {rtcContext.conversationState.errorInfo.errorCode} -{' '}
                {rtcContext.conversationState.errorInfo.reason}
              </Tag>
            ) : null}
          </Space>
        ) : (
          <div style={{ color: '#999' }}>暂无对话状态</div>
        )}
      </div>

      <div
        style={{
          backgroundColor: '#f5f5f5',
          padding: '10px',
          borderRadius: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
          marginBottom: '12px',
          fontSize: '12px',
        }}
      >
        <div style={{ marginBottom: '6px', fontWeight: 'bold', color: '#666' }}>
          字幕历史 (最近{MAX_SUBTITLE_HISTORY}条)
        </div>
        {subtitleHistory.length === 0 ? (
          <div style={{ color: '#999', textAlign: 'center', padding: '8px' }}>
            暂无字幕
          </div>
        ) : (
          subtitleHistory.map((item) => (
            <div
              key={item.id}
              style={{
                lineHeight: '1.8',
                backgroundColor: getSubtitleBgColor(item.role),
                border: '1px solid #f0f0f0',
                borderRadius: '4px',
                padding: '6px 8px',
                marginBottom: '6px',
              }}
            >
              <div style={{ color: '#666', fontSize: '11px' }}>
                {getRoleLabel(item.role)} | uid: {item.uid || '-'} | round:{' '}
                {item.roundId || '-'} | {item.isFinal ? 'final' : 'streaming'}
              </div>
              <div>{item.text}</div>
            </div>
          ))
        )}
      </div>

      {rtcContext.error && (
        <div
          style={{
            backgroundColor: '#fff1f0',
            padding: '10px 12px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#cf1322',
            borderLeft: '3px solid #ff4d4f',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            <strong>错误:</strong> {rtcContext.error.msg}
          </span>
          <Button
            type="link"
            size="small"
            onClick={rtcContext.clearError}
            style={{ padding: '0 8px', color: '#cf1322' }}
          >
            清除
          </Button>
        </div>
      )}

      <Space.Compact style={{ width: '100%', marginBottom: '12px' }}>
        <Input
          placeholder="输入消息..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onPressEnter={handleSend}
          disabled={!rtcContext.isActive}
          size="small"
        />
        <Button
          type="primary"
          onClick={handleSend}
          disabled={!rtcContext.isActive || !inputMessage.trim()}
          size="small"
        >
          发送
        </Button>
      </Space.Compact>

      <div
        style={{
          marginTop: '12px',
          borderTop: '1px solid #f0f0f0',
          paddingTop: '12px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            marginBottom: '8px',
            color: '#666',
            fontWeight: 'bold',
          }}
        >
          快速测试
        </div>
        <Space wrap size="small">
          <Button
            size="small"
            onClick={() => sendDirectMessage('你好')}
            disabled={!rtcContext.isActive}
          >
            你好
          </Button>
          <Button
            size="small"
            onClick={() => sendDirectMessage('介绍一下你自己')}
            disabled={!rtcContext.isActive}
          >
            自我介绍
          </Button>
          <Button
            size="small"
            onClick={() => sendDirectMessage('你是谁？')}
            disabled={!rtcContext.isActive}
            type="primary"
            ghost
          >
            测试身份
          </Button>
          <Button
            size="small"
            onClick={() => sendDirectMessage('给我讲个笑话')}
            disabled={!rtcContext.isActive}
          >
            讲笑话
          </Button>
        </Space>
      </div>

      <div
        style={{
          backgroundColor: '#f5f5f5',
          padding: '10px',
          borderRadius: '4px',
          maxHeight: '180px',
          overflowY: 'auto',
          fontSize: '12px',
          fontFamily: 'Consolas, Monaco, monospace',
          marginTop: '12px',
        }}
      >
        <div
          style={{
            marginBottom: '6px',
            fontWeight: 'bold',
            color: '#666',
            fontFamily: 'inherit',
          }}
        >
          操作日志 (最近{MAX_LOGS}条)
        </div>
        {logs.length === 0 ? (
          <div style={{ color: '#999', textAlign: 'center', padding: '8px' }}>
            暂无日志
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log}
              style={{
                lineHeight: '1.8',
                borderBottom: '1px solid #e8e8e8',
                paddingBottom: '4px',
                marginBottom: '4px',
              }}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default RTCChatTest;
