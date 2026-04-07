import CommonPagination from '@components/CommonPagination';
import { useGridColumns } from '@hooks/useGridColumns';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Spin, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../api';
import { ModelItem } from '../../../api/types/wallpaper';
import { previewActions } from '../../../stores/PreviewStore';
import { openCreateCharacterWindow } from '../../../utils/createCharacter';
import { analytics } from '../../../utils/Weblogger/analyticsAPI';
import { getVisitorId } from '../../../utils/Weblogger/weblogger';
import { AnalyticsEvent } from '../../../utils/Weblogger/webloggerConstance';
import { DEFAULT_CHARACTERS } from '../../Character/constance';
import TaskCardList from '../../Character/TaskCardList';
import { CharacterItem, GenderType } from '../../Character/types';
import CharacterCard from '../CharacterCard/index';
import { useStyles } from '../styles';

const ipcEvents = getIpcEvents();

const PAGE_SIZE = 20;

const CHARACTER_GRID_CALC = (width: number) => {
  const maxCardWidth = 330;
  const minCardWidth = 285;
  const gap = 8;
  const minColumns = 2;
  if (width >= maxCardWidth) {
    return Math.max(minColumns, Math.floor(width / maxCardWidth) + 1);
  }
  return Math.max(minColumns, Math.floor((width + gap) / (minCardWidth + gap)));
};

const convertModelToCharacter = (
  model: ModelItem,
  currentUsingId?: string,
): CharacterItem => ({
  id: model.id,
  name: model.name,
  avatar: (model.metadata as any)?.original_images?.[0]?.url || '',
  description: model.description,
  tags: model.tags,
  createdAt: new Date(model.created_at).toLocaleDateString('zh-CN'),
  author: model.creator_id,
  isUsing: model.id === currentUsingId,
  metadata: model.metadata as any,
  additional_files: model.additional_files,
});

interface CharacterSectionProps {
  onFilteredCharactersChange: (chars: CharacterItem[]) => void;
}

function CharacterSection({
  onFilteredCharactersChange,
}: CharacterSectionProps) {
  const { styles } = useStyles();
  const gridRef = useRef<HTMLDivElement>(null);
  const calcFn = useCallback(CHARACTER_GRID_CALC, []);
  const gridColumns = useGridColumns(gridRef, calcFn);

  const [characters, setCharacters] =
    useState<CharacterItem[]>(DEFAULT_CHARACTERS);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    '000001',
  );
  const [selectedGender, setSelectedGender] = useState<GenderType>('all');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const filteredCharacters = useMemo(() => {
    if (selectedGender === 'all') return characters;
    return characters.filter((char) => char.metadata.gender === selectedGender);
  }, [characters, selectedGender]);

  useEffect(() => {
    onFilteredCharactersChange(filteredCharacters);
  }, [filteredCharacters, onFilteredCharactersChange]);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      const response = await api.getPrivateModelList({
        page: currentPage,
        page_size: PAGE_SIZE,
        model_type: 'digital_human',
      });
      if (response.code === 0 && response.data) {
        const apiList = response.data.items.map((model) =>
          convertModelToCharacter(model, selectedCharacterId || undefined),
        );
        const defaultWithState = DEFAULT_CHARACTERS.map((char) => ({
          ...char,
          isUsing: char.id === selectedCharacterId,
        }));
        setCharacters([...defaultWithState, ...apiList]);
        setTotalCount(response.data.total);
        setCurrentPage(response.data.page);
      } else {
        message.error(response.message || '加载角色列表失败');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('加载角色列表失败:', error);
      }
      message.error('加载角色列表失败，请稍候重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClickGender = (gender: GenderType) => {
    const eventMap = {
      all: AnalyticsEvent.MY_ROLES_ALL_CLICK,
      male: AnalyticsEvent.MY_ROLES_MALE_CLICK,
      female: AnalyticsEvent.MY_ROLES_FEMALE_CLICK,
    } as const;
    const event = eventMap[gender];
    if (event) {
      analytics
        .track(event, { visitor_id: getVisitorId() || 'unknown' })
        .catch(() => {});
    }
    setSelectedGender(gender);
  };

  const handlePreview = (character: CharacterItem) => {
    previewActions.showPreview(
      character.avatar,
      character.name,
      '头像加载失败',
    );
    setSelectedCharacterId(character.id);
  };

  const handleDelete = async (character: CharacterItem) => {
    const visitorId = getVisitorId();
    analytics
      .track(AnalyticsEvent.DELECT_CHARACTER, {
        chunk_id: character.metadata?.chunk_id || null,
        visitor_id: visitorId || 'unknown',
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('删除角色埋点失败:', err);
      });
    const res = await api.deleteModel('digital_human', character.id);
    if (res.code === 0) {
      message.success('🎉 角色删除成功');
    } else {
      message.error(`🚨 角色删除失败: ${res.data || res.message}`);
    }
  };

  const handleSelect = (_character: CharacterItem) => {
    // reserved for future use
  };

  const handleCardBtnClick = (_character: CharacterItem) => {
    // reserved for future use
  };

  const handleCreate = async () => {
    const hideMainResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.HIDE_MAIN_WINDOW,
    )) as any;
    if (!hideMainResult.success) {
      console.warn('隐藏主窗口失败:', hideMainResult.error);
    }
    const hideLiveResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.HIDE_LIVE_WINDOW,
    )) as any;
    if (!hideLiveResult.success) {
      console.warn('隐藏Live窗口失败:', hideLiveResult.error);
    }
    await openCreateCharacterWindow();
  };

  const genderOptions: { key: GenderType; label: string }[] = [
    { key: 'all', label: '所有角色' },
    { key: 'female', label: '女性' },
    { key: 'male', label: '男性' },
  ];

  return (
    <>
      <div className={styles.filterItem}>
        {genderOptions.map((opt) => (
          <div
            key={opt.key}
            className={`${styles.filterItemCon} ${selectedGender === opt.key ? 'active' : ''}`}
            onClick={() => handleClickGender(opt.key)}
          >
            {opt.label}
          </div>
        ))}
      </div>
      <Spin spinning={loading} size="large">
        <div
          ref={gridRef}
          className={styles.characterGridContainer}
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(285px, 1fr))`,
          }}
        >
          <div
            className={styles.createCharacter}
            role="button"
            tabIndex={0}
            onClick={handleCreate}
          >
            创建角色
          </div>
          <TaskCardList selectedGender={selectedGender} />
          {filteredCharacters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character as any}
              onSelect={handleSelect as any}
              onPreview={handlePreview as any}
              onDelete={handleDelete as any}
              onCardBtnClick={handleCardBtnClick as any}
            />
          ))}
        </div>
      </Spin>
      {!loading && totalCount > 0 && (
        <CommonPagination
          current={currentPage}
          total={totalCount}
          pageSize={PAGE_SIZE}
          onChange={(page) => {
            setCurrentPage(page);
            loadCharacters();
          }}
        />
      )}
    </>
  );
}

export default CharacterSection;
