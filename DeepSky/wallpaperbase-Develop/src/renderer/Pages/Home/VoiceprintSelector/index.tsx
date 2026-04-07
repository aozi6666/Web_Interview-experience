import { useEffect, useState } from 'react';
import {
  getVoiceprintGroups,
  type VoiceprintGroup,
} from '../../../utils/voiceManager';
import './index.css';

interface VoiceprintSelectorProps {
  selectedVoiceprint?: VoiceprintGroup | null;
  onVoiceprintSelect?: (voiceprint: VoiceprintGroup | null) => void;
}

function VoiceprintSelector({
  selectedVoiceprint = null,
  onVoiceprintSelect,
}: VoiceprintSelectorProps) {
  const [voiceprintGroups, setVoiceprintGroups] = useState<VoiceprintGroup[]>(
    [],
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // 加载声纹组列表
  const loadVoiceprintGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await getVoiceprintGroups();
      setVoiceprintGroups(groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载声纹组失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVoiceprintGroups();
  }, []);

  // 处理声纹选择
  const handleVoiceprintSelect = (group: VoiceprintGroup | null) => {
    onVoiceprintSelect?.(group);
    setIsOpen(false);
  };

  // 重试加载
  const handleRetry = () => {
    loadVoiceprintGroups();
  };

  return (
    <div className="voiceprint-selector">
      <div className="voiceprint-selector-header">
        <h3>声纹选择</h3>
        {loading && <span className="loading-indicator">加载中...</span>}
      </div>

      {error ? (
        <div className="voiceprint-error">
          <p>加载失败: {error}</p>
          <button type="button" onClick={handleRetry} className="retry-button">
            重试
          </button>
        </div>
      ) : (
        <div className="voiceprint-dropdown">
          <div
            className={`voiceprint-selector-button ${isOpen ? 'open' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(!isOpen);
              }
            }}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <span className="selected-voiceprint">
              {selectedVoiceprint ? selectedVoiceprint.name : '请选择声纹'}
            </span>
            <span className="dropdown-arrow">▼</span>
          </div>

          {isOpen && (
            <div className="voiceprint-dropdown-menu" role="listbox">
              {/* 默认选项 */}
              <div
                className={`voiceprint-option ${!selectedVoiceprint ? 'selected' : ''}`}
                onClick={() => handleVoiceprintSelect(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleVoiceprintSelect(null);
                  }
                }}
                role="option"
                tabIndex={0}
                aria-selected={!selectedVoiceprint}
              >
                <div className="voiceprint-info">
                  <span className="voiceprint-name">不使用声纹</span>
                  <span className="voiceprint-desc">使用默认音色</span>
                </div>
              </div>

              {/* 声纹组选项 */}
              {voiceprintGroups.map((group) => (
                <div
                  key={group.id}
                  className={`voiceprint-option ${
                    selectedVoiceprint?.id === group.id ? 'selected' : ''
                  }`}
                  onClick={() => handleVoiceprintSelect(group)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleVoiceprintSelect(group);
                    }
                  }}
                  role="option"
                  tabIndex={0}
                  aria-selected={selectedVoiceprint?.id === group.id}
                >
                  <div className="voiceprint-info">
                    <span className="voiceprint-name">{group.name}</span>
                    {group.desc && (
                      <span className="voiceprint-desc">{group.desc}</span>
                    )}
                    <span className="voiceprint-count">
                      {group.feature_count} 个特征
                    </span>
                  </div>
                  <div className="voiceprint-status">
                    <span className="status-badge active">可用</span>
                  </div>
                </div>
              ))}

              {voiceprintGroups.length === 0 && !loading && (
                <div className="voiceprint-empty">
                  <span>暂无可用声纹</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedVoiceprint && (
        <div className="selected-voiceprint-info">
          <div className="voiceprint-details">
            <h4>{selectedVoiceprint.name}</h4>
            {selectedVoiceprint.desc && (
              <p className="voiceprint-description">
                {selectedVoiceprint.desc}
              </p>
            )}
            <div className="voiceprint-meta">
              <span>
                创建时间:{' '}
                {new Date(
                  selectedVoiceprint.created_at * 1000,
                ).toLocaleDateString()}
              </span>
              <span>特征数量: {selectedVoiceprint.feature_count}</span>
              {selectedVoiceprint.user_info && (
                <span>创建者: {selectedVoiceprint.user_info.nickname}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 默认props
VoiceprintSelector.defaultProps = {
  selectedVoiceprint: null,
  onVoiceprintSelect: undefined,
};

export default VoiceprintSelector;
