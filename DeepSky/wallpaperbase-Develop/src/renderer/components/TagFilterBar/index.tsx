import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useStyles } from './styles';

interface TagItem {
  id: string;
  name: string;
}

interface TagFilterBarProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  allLabel?: string;
}

function TagFilterBar({
  selectedTags,
  onTagsChange,
  allLabel = '所有壁纸',
}: TagFilterBarProps) {
  const { styles } = useStyles();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.getTagsList();
        if (response.code === 0 && response.data) {
          setTags(response.data);
        }
      } catch {
        // silently ignore
      }
    };
    fetchTags();
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => updateScrollState();
    el.addEventListener('scroll', handler);
    window.addEventListener('resize', handler);
    handler();
    return () => {
      el.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [updateScrollState, tags]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' });
  }, []);

  const handleClickTag = (tagName: string) => {
    if (tagName === '__all__') {
      onTagsChange([]);
      return;
    }
    const next = selectedTags.includes(tagName)
      ? selectedTags.filter((t) => t !== tagName)
      : [...selectedTags, tagName];
    onTagsChange(next);
  };

  return (
    <div className={styles.filterItem}>
      <div className={styles.tagFilterWrapper}>
        <button
          type="button"
          className={`${styles.tagFilterArrow} ${styles.tagFilterArrowLeft} ${!canScrollLeft ? styles.tagFilterArrowHidden : ''}`}
          onClick={() => scroll('left')}
          aria-hidden={!canScrollLeft}
          tabIndex={canScrollLeft ? 0 : -1}
        >
          <LeftOutlined />
        </button>

        <div ref={scrollRef} className={styles.tagFilter}>
          <div
            className={`${styles.filterItemCon} ${selectedTags.length === 0 ? 'active' : ''}`}
            onClick={() => handleClickTag('__all__')}
          >
            {allLabel}
          </div>
          {tags.map((tag) => (
            <div
              key={tag.id}
              className={`${styles.filterItemCon} ${selectedTags.includes(tag.name) ? 'active' : ''}`}
              onClick={() => handleClickTag(tag.name)}
            >
              {tag.name}
            </div>
          ))}
        </div>

        <button
          type="button"
          className={`${styles.tagFilterArrow} ${styles.tagFilterArrowRight} ${!canScrollRight ? styles.tagFilterArrowHidden : ''}`}
          onClick={() => scroll('right')}
          aria-hidden={!canScrollRight}
          tabIndex={canScrollRight ? 0 : -1}
        >
          <RightOutlined />
        </button>
      </div>
    </div>
  );
}

export default TagFilterBar;
