import { useState } from 'react';
import { useStyles } from './styles';
import '../../index.css';
import eyeIcon from '$assets/icons/Cteation/eye.png';

interface ModifyCharacterProps {
  onClose: () => void;
}

function Modify({ onClose }: ModifyCharacterProps) {
  const { styles } = useStyles();
  const [hoveredCharacterId, setHoveredCharacterId] = useState<string | null>(
    null,
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );

  // 示例数据
  const characters = [
    { id: '1', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '2', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '3', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '4', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '5', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '6', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '7', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '8', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '9', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '10', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '11', gender: '女', age: '22岁', name: '人设的名称' },
    { id: '12', gender: '女', age: '22岁', name: '人设的名称' },
  ];

  return (
    <div className={styles.modifyContainer}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          title="关闭"
        >
          ✕
        </button>
      )}
      <div className={styles.buttonRow}>
        <button type="button" className={styles.allButton}>
          全部人设
        </button>
      </div>

      <div className={styles.charactersGrid}>
        {characters.map((character) => (
          <div
            key={character.id}
            className={`${styles.characterCard} ${selectedCharacterId === character.id ? styles.characterCardSelected : ''}`}
            onClick={() => setSelectedCharacterId(character.id)}
            onMouseEnter={() => setHoveredCharacterId(character.id)}
            onMouseLeave={() => setHoveredCharacterId(null)}
          >
            <div className={styles.characterCardHeader}>
              {hoveredCharacterId === character.id && (
                <div className={styles.modifydelectIcon}>
                  <img src={eyeIcon} alt="查看" />
                </div>
              )}
            </div>
            <div className={styles.characterCardContent}>
              <div className={styles.characterTags}>
                <span className={styles.characterTag}>{character.gender}</span>
                <span className={styles.characterTag}>{character.age}</span>
              </div>
              <div className={styles.characterName}>{character.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Modify;
