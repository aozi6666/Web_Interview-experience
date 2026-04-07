import eyeIcon from '$assets/icons/Cteation/eye.png';
import frameIcon from '$assets/icons/Cteation/Frame.png';
import timbreLightIcon from '$assets/icons/Cteation/timbre-light.png';
import transferIcon from '$assets/icons/Cteation/trash.png';
import selectIcon from '$assets/images/uploadPhoto/icon-ture_state_nor_state_choose2__size_32.png';
import { Image, message } from 'antd';
import { useCallback, useState } from 'react';
import '../../index.css';
import ModifyCharacter from './modifycharacter';
import ModifyCharacterVoice from './modifyvoice';
import { useStyles } from './styles';

interface CreationTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  gender: string;
  thumbnail?: string;
  type: 'wallpaper' | 'character' | 'scene';
}

const CREATION_TEMPLATES: CreationTemplate[] = [
  {
    id: '3',
    name: '小狗',
    description: '个性化角色创建模板',
    author: '小狗',
    gender: '男性',
    thumbnail:
      'https://client-resources.tos-cn-beijing.volces.com/character/files/avatar/b04943b8-2156-4e07-a60c-3d7cab35dd3a.png',
    type: 'character',
  },
  {
    id: '9',
    name: '角色模板2',
    description: '个性化角色创建模板',
    author: '角色2',
    gender: '男性',
    thumbnail:
      'https://client-resources.tos-cn-beijing.volces.com/character/files/model_0/25114b1a-06f3-4267-b1ba-f23f5c649cae.png',
    type: 'character',
  },
  {
    id: '4',
    name: '角色模板3',
    description: '个性化角色创建模板',
    author: '角色3',
    gender: '女性',
    type: 'character',
  },
  {
    id: '5',
    name: '角色模板4',
    description: '个性化角色创建模板',
    author: '角色4',
    gender: '男性',
    type: 'character',
  },
  {
    id: '6',
    name: '角色模板5',
    description: '个性化角色创建模板',
    author: '角色5',
    gender: '女性',
    type: 'character',
  },
  {
    id: '7',
    name: '角色模板6',
    description: '个性化角色创建模板',
    author: '官方',
    gender: '女性',
    type: 'character',
  },
  {
    id: '8',
    name: '角色模板7',
    description: '个性化角色创建模板',
    author: '官方',
    gender: '男性',
    type: 'character',
  },
  {
    id: '10',
    name: '角色模板8',
    description: '个性化角色创建模板',
    author: '官方',
    gender: '女性',
    type: 'character',
  },
  {
    id: '11',
    name: '角色模板9',
    description: '个性化角色创建模板',
    author: '官方',
    gender: '男性',
    type: 'character',
  },
  {
    id: '12',
    name: '角色模板10',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    gender: '男性',
    type: 'character',
  },
  {
    id: '13',
    name: '角色模板11',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    gender: '男性',
    type: 'character',
  },
  {
    id: '14',
    name: '角色模板12',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    gender: '男性',
    type: 'character',
  },
  {
    id: '15',
    name: '角色模板13',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    gender: '男性',
    type: 'character',
  },
  {
    id: '16',
    name: '角色模板14',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    gender: '男性',
    type: 'character',
  },
  {
    id: '17',
    name: '角色模板15',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    gender: '男性',
    type: 'character',
  },
  // {
  //   id: '18',
  //   name: '角色模板16',
  //   description: '个性化角色创建模板',
  //   author: '官方',
  //   thumbnail: '',
  //   gender: '男性',
  //   type: 'character',
  // },
];
interface CharacterProps {
  selectId:string;
  onSelectCharacter?: (id:string) => void;
}
const Character: React.FC<CharacterProps> = ({selectId,onSelectCharacter}) => {
  const { styles } = useStyles();
  // 选中的筛选类型状态 - 必须在所有条件之前调用
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  // 在 Character 组件内部，添加这个状态
  const [showModifyPanel, setShowModifyPanel] = useState<
    'character' | 'voice' | null
  >(null);
  // 选中的角色ID状态
  // const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  // hover 的角色ID状态
  const [hoveredCharacterId, setHoveredCharacterId] = useState<string | null>(
    null,
  );

  const handleModifyCharacter = useCallback(() => {
    setShowModifyPanel('character');
  }, []);

  const handleModifyVoice = useCallback(() => {
    setShowModifyPanel('voice');
  }, []);

  // 关闭面板的函数（可选，如果需要关闭功能）
  const handleCloseModifyPanel = useCallback(() => {
    setShowModifyPanel(null);
  }, []);

  // 根据选中的筛选类型过滤模板
  const filteredTemplates = CREATION_TEMPLATES.filter((template) => {
    // 首先过滤出角色类型
    if (template.type !== 'character') return false;

    // 根据选中的筛选类型进行过滤
    if (selectedFilter === 'all') {
      return true;
    }
    if (selectedFilter === 'female') {
      return template.gender === '女性';
    }
    if (selectedFilter === 'male') {
      return template.gender === '男性';
    }
    return true;
  });

  const handleTemplateClick = useCallback((template: CreationTemplate) => {
    // setSelectedCharacter(template.id);
    message.info(`选择模板: ${template.name}`);
    if (onSelectCharacter) {
      // console.log('filter',template.id);
      onSelectCharacter(template.id);
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    message.info('创建新角色功能开发中');
  }, []);

  const handleFilterClick = useCallback((filter: string) => {
    setSelectedFilter(filter);
    
  }, []);

  return (
    <div className={styles.characterContainer}>
      <div className="typeButtons">
        <button
          type="button"
          className={`${styles.characterTypeButton} ${selectedFilter === 'all' ? styles.characterTypeButtonActiveClick : ''}`}
          onClick={() => handleFilterClick('all')}
        >
          所有角色
        </button>
        <button
          type="button"
          className={`${styles.characterTypeButton} ${selectedFilter === 'female' ? styles.characterTypeButtonActiveClick : ''}`}
          onClick={() => handleFilterClick('female')}
        >
          女性
        </button>
        <button
          type="button"
          className={`${styles.characterTypeButton} ${selectedFilter === 'male' ? styles.characterTypeButtonActiveClick : ''}`}
          onClick={() => handleFilterClick('male')}
        >
          男性
        </button>
        <button
          type="button"
          className={styles.createNewButtonCharacter}
          onClick={handleCreateNew}
        >
          创建角色
        </button>
      </div>

      <div className={styles.templatesGrid}>
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className={styles.templateCardCharacter}
            onClick={() => handleTemplateClick(template)}
            onMouseEnter={() => setHoveredCharacterId(template.id)}
            onMouseLeave={() => setHoveredCharacterId(null)}
          >
            {selectId === template.id && (
              <div className={styles.selectIcon}>
                <Image width={36} src={selectIcon} alt="选择" preview={false} />
              </div>
            )}
            {hoveredCharacterId === template.id && (
              <div className={styles.iconContainer}>
                <div className={styles.deleteIcon}>
                  <img src={eyeIcon} alt="查看" />
                </div>
                <div className={styles.deleteIcon}>
                  <img src={transferIcon} alt="删除" />
                </div>
              </div>
            )}
            <div className="templateThumbnail">
              {template.thumbnail ? (
                <img src={template.thumbnail} alt={template.name} />
              ) : (
                <div className="placeholder" />
              )}
              {hoveredCharacterId === template.id && (
                <button type="button" className={styles.useCharacterButton}>
                  <span className={styles.useCharacterButtonText}>
                    使用角色
                  </span>
                </button>
              )}
            </div>
            <div className="templateInfo">
              <h3 className="templateTitle">{template.author}</h3>
              {/* <p className="templateDescription">{template.description}</p> */}
            </div>
          </div>
        ))}
      </div>
      {/* <Modify /> */}
      {/* 在 characterView 的 </div> 之前添加 */}
      {showModifyPanel === 'character' && (
        <div className={styles.charactermodify}>
          <ModifyCharacter onClose={handleCloseModifyPanel} />
        </div>
      )}

      {showModifyPanel === 'voice' && (
        <div className={styles.charactermodify}>
          <ModifyCharacterVoice onClose={handleCloseModifyPanel} />
        </div>
      )}
      <div className={styles.characterView}>
        {/* <Modify />
        <ModifyVoice /> */}
        <div className="choice-Title">选择的角色名称</div>
        <div
          className={styles.characterViewFlex}
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '10px',
            width: '100%',
          }}
        >
          <div className={styles.characterViewName}>
            <div
              className={styles.characterViewNameTitle}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <img src={frameIcon} alt="Frame" style={{ marginRight: '8px' }} />
              人设
            </div>
            {/* <div className={styles.iconContainer}>
              <div className={styles.deleteIcon}>
                <img src={eyeIcon} alt="查看" />
              </div>
            </div> */}
            <div className={styles.characterViewNameContent}>人设的名称</div>
            <button
              type="button"
              className={styles.characterViewNameButton}
              onClick={handleModifyCharacter}
            >
              修改人设
            </button>
          </div>
          <div className={styles.characterViewSound}>
            <div
              className={styles.characterViewSoundTitle}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <img
                src={timbreLightIcon}
                alt="Timbre"
                style={{ marginRight: '8px' }}
              />
              音色
            </div>
            <div className={styles.characterViewSoundContent}>音色的名称</div>
            <button
              type="button"
              className={styles.characterViewSoundModifyButton}
              onClick={handleModifyVoice}
            >
              修改音色
            </button>
          </div>
        </div>

        <div className={styles.characterViewControl}>
          <div className={styles.characterViewControlTitle}>角色控制</div>
          <div className={styles.characterViewControlContent}>
            <div className={styles.characterViewControlPosition}>
              <span className={styles.characterViewControlLabel}>位置</span>
              <div className={styles.characterViewControlInputGroup}>
                <div className={styles.characterViewControlInputWrapper}>
                  <span className={styles.characterViewControlInputLabel}>
                    X
                  </span>
                  <input
                    type="number"
                    className={styles.characterViewControlInput}
                    defaultValue="300"
                  />
                </div>
                <div className={styles.characterViewControlInputWrapper}>
                  <span className={styles.characterViewControlInputLabel}>
                    Y
                  </span>
                  <input
                    type="number"
                    className={styles.characterViewControlInput}
                    defaultValue="300"
                  />
                </div>
              </div>
            </div>

            <div className={styles.characterViewControlScale}>
              <span className={styles.characterViewControlLabel}>缩放</span>
              <div
                className={`${styles.characterViewControlInputGroup} ${styles.characterViewControlScaleInputGroup}`}
              >
                <div className={styles.characterViewControlInputWrapper}>
                  <input
                    type="number"
                    className={`${styles.characterViewControlInput} ${styles.characterViewControlScaleInputGroup}`}
                    defaultValue="3"
                  />
                  <span className={styles.characterViewControlUnit}>倍</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Character;
