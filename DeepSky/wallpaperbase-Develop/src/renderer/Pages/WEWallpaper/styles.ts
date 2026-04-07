import { createStyles } from 'antd-style';
import { scrollbarMixin } from '../../styles/scrollbar';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    width: 100%;
    height: 100%;
    overflow: auto;
    overflow-x: hidden;
    padding-right: 10px;
    ${scrollbarMixin}
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  `,
  headerTitle: css`
    color: #ffffff;
    font-size: 14px;
    line-height: 32px;
  `,
  grid: css`
    display: grid;
    gap: 6px;
  `,
  wallpaperCard: css`
    position: relative;
    width: 100%;
    height: 180px;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(25, 30, 33, 1);
    cursor: pointer;
    outline: 2px solid transparent;
    transition: outline-color 0.2s ease;

    &:hover,
    &:focus-visible {
      outline-color: #008485;
    }
  `,
  previewArea: css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 80%;
    background: rgba(36, 40, 43, 1);
  `,
  previewImage: css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  `,
  previewFallback: css`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(236, 238, 237, 0.7);
    font-size: 12px;
    background: linear-gradient(
      135deg,
      rgba(69, 69, 69, 1) 0%,
      rgba(42, 42, 42, 1) 100%
    );
  `,
  loadingBadge: css`
    position: absolute;
    right: 10px;
    top: 10px;
    z-index: 2;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(17, 20, 22, 0.9);
  `,
  metaBar: css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 20%;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(25, 30, 33, 0.95);
  `,
  title: css`
    flex: 1;
    min-width: 0;
    color: #fff;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  typeTag: css`
    margin-inline-end: 0 !important;
    flex-shrink: 0;
  `,
}));
