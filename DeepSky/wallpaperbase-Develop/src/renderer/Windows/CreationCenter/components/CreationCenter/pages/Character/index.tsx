import { useCallback, useState } from 'react';
import { message } from 'antd';
import '../../../../index.css';

interface CreationTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  thumbnail: string;
  type: 'wallpaper' | 'character' | 'scene';
}

const CREATION_TEMPLATES: CreationTemplate[] = [
  {
    id: '3',
    name: '角色模板1',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '9',
    name: '角色模板2',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '4',
    name: '角色模板3',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '5',
    name: '角色模板4',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '6',
    name: '角色模板5',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '7',
    name: '角色模板6',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '8',
    name: '角色模板7',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '10',
    name: '角色模板8',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '11',
    name: '角色模板9',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
  {
    id: '12',
    name: '角色模板10',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'character',
  },
];

function Character() {
  // 选中的筛选类型状态 - 必须在所有条件之前调用
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // 过滤出角色类型的模板
  const filteredTemplates = CREATION_TEMPLATES.filter(
    (template) => template.type === 'character',
  );

  const handleTemplateClick = useCallback((template: CreationTemplate) => {
    message.info(`选择模板: ${template.name}`);
  }, []);

  const handleCreateNew = useCallback(() => {
    message.info('创建新角色功能开发中');
  }, []);

  const handleFilterClick = useCallback((filter: string) => {
    setSelectedFilter(filter);
  }, []);

  return (
    <div className="character-container">
      <div className="typeButtons">
        <button
          type="button"
          className={`character-typeButton ${selectedFilter === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterClick('all')}
        >
          所有角色
        </button>
        <button
          type="button"
          className={`character-typeButton ${selectedFilter === 'female' ? 'active' : ''}`}
          onClick={() => handleFilterClick('female')}
        >
          女性
        </button>
        <button
          type="button"
          className={`character-typeButton ${selectedFilter === 'male' ? 'active' : ''}`}
          onClick={() => handleFilterClick('male')}
        >
          男性
        </button>
        <button
          type="button"
          className="createNewButton-character"
          onClick={handleCreateNew}
        >
          创建角色
        </button>
      </div>
      <div className="templatesGrid">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="templateCard"
            onClick={() => handleTemplateClick(template)}
          >
            <div className="templateThumbnail">
              {template.thumbnail ? (
                <img src={template.thumbnail} alt={template.name} />
              ) : (
                <div className="placeholder" />
              )}
            </div>
            <div className="templateInfo">
              <h3 className="templateTitle">{template.author}</h3>
              {/* <p className="templateDescription">{template.description}</p> */}
            </div>
          </div>
        ))}
      </div>
      <div className="character-view">
        <div className="choice-Title">选择的角色名称</div>
        <div
          className="flex"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '10px',
            width: '100%',
          }}
        >
          <div className="view-name">
            <div className="view-name-title">人设</div>
            <div className="view-name-content">人设的名称</div>
            <button type="button" className="view-name-button">
              修改人设
            </button>
          </div>
          <div className="view-sound">
            <div className="view-sound-title">音色</div>
            <div className="view-sound-content">音色的名称</div>
            <button type="button" className="view-sound-modify-button">
              修改音色
            </button>
          </div>
        </div>
        <div className="view-control">
          <div className="view-control-title">角色控制</div>
          <div className="view-control-content">
            <div className="view-control-position">
              <span className="view-control-label">位置</span>
              <div className="view-control-input-group">
                <span className="view-control-input-label">X</span>
                <input
                  type="number"
                  className="view-control-input"
                  defaultValue="300"
                />
                <span className="view-control-input-label">Y</span>
                <input
                  type="number"
                  className="view-control-input"
                  defaultValue="300"
                />
              </div>
            </div>
            <div className="view-control-scale">
              <span className="view-control-label">缩放</span>
              <div className="view-control-input-group">
                <input
                  type="number"
                  className="view-control-input"
                  defaultValue="3"
                />
                <span className="view-control-unit">倍</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Character;
