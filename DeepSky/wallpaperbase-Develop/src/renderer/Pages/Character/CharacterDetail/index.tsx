import { CharacterItem } from '../types';
import { useStyles } from './styles';

interface CharacterDetailProps {
  character: CharacterItem | null;
  handleCreateCharacter: () => void;
}

function CharacterDetail({
  character,
  handleCreateCharacter,
}: CharacterDetailProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.detailPanel}>
      <div
        className={styles.createCharacter}
        onClick={handleCreateCharacter}
        role="button"
        tabIndex={0}
      >
        {/* <img src={createCharacter} alt="createCharacter" /> */}
        点击创建角色
      </div>
    </div>
  );
}

export default CharacterDetail;
