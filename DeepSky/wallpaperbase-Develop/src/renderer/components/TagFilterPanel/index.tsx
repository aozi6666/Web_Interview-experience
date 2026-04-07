import checkIcon from '../../../../assets/comment/check.svg';
import { useStyles } from './styles';

export type TagItem = {
  id: string | number;
  name: string;
};

export type GroupedTags = {
  interaction: TagItem[];
  gender: TagItem[];
  type: TagItem[];
};

type TagFilterPanelProps = {
  groupedTags: GroupedTags;
  selectedTags: string[];
  onClickTag: (tag: string) => void;
};

function TagFilterPanel({
  groupedTags,
  selectedTags,
  onClickTag,
}: TagFilterPanelProps) {
  const { styles } = useStyles();

  const renderTagButtons = (tagList: TagItem[]) =>
    tagList.map((tag) => {
      const isSelected = selectedTags.includes(tag.name);
      return (
        <button
          key={tag.id}
          type="button"
          onClick={() => onClickTag(tag.name)}
          className={`${styles.tagButton} ${isSelected ? 'active' : ''}`}
        >
          {isSelected && (
            <img src={checkIcon} alt="" aria-hidden className={styles.checkIcon} />
          )}
          {tag.name}
        </button>
      );
    });

  return (
    <div className={styles.panel}>
      <div className={styles.groupTitle}>互动性</div>
      <div className={styles.groupTags}>{renderTagButtons(groupedTags.interaction)}</div>

      <div className={styles.groupTitle}>性别</div>
      <div className={styles.groupTags}>{renderTagButtons(groupedTags.gender)}</div>

      <div className={styles.groupTitle}>类型</div>
      <div className={styles.groupTagsLast}>{renderTagButtons(groupedTags.type)}</div>

      <button
        type="button"
        onClick={() => onClickTag('all')}
        className={`${styles.clearButton} ${selectedTags.length > 0 ? 'active' : ''}`}
      >
        清空筛选
      </button>
    </div>
  );
}

export default TagFilterPanel;

