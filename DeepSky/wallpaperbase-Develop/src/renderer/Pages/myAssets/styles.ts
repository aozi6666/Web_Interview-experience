import { createStyles } from 'antd-style';
import { scrollbarMixin } from '../../styles/scrollbar';

export const useStyles = createStyles(({ css }) => ({
  slideHost: css`
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
  `,
  slideHostScroll: css`
    /* position: relative; */
    flex: 1;
    min-height: 0;
    overflow: auto;
    overflow-x: hidden;
    padding-right: 10px;
    padding-bottom: 68px;
    ${scrollbarMixin}
  `,
  container: css`
    width: 100%;
    height: 100%;
    overflow: auto;
    overflow-x: hidden;
    padding-right: 10px;
    /* padding-bottom: 35px; */
    ${scrollbarMixin}
  `,
  wallpaperGrid: css`
    flex: 1;
    ${scrollbarMixin}
  `,
  wallpaperHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-left: 10px;
  `,
  wallpaperTitle: css`
    font-size: 14px;
    color: rgba(236, 238, 237, 1);
    line-height: 32px;
  `,
  tagFilterBtn: css`
    padding: 0px 12px;
    border-radius: 15px;
    border: 1px solid rgba(91, 98, 95, 1);
    background: rgba(46, 49, 48, 1);
    color: rgba(173, 181, 178, 1);
    font-size: 14px;
    height: 30px !important;
    line-height: 28px !important;
    cursor: pointer;
  `,
  filterItem: css`
    color: #9d9d9d;
    margin-bottom: 10px;
    padding-left: 10px;
    font-size: 13px;
    display: flex;
  `,
  filterItemCon: css`
    height: 32px;
    display: inline-flex;
    place-content: center;
    place-items: center;
    flex-shrink: 0;
    padding: 8px 16px;
    border-radius: 4px;
    color: #9d9d9d;
    cursor: pointer;

    &:hover {
      color: rgba(49, 211, 211, 1);
    }

    &.active {
      background: rgba(0, 73, 74, 1);
      color: rgba(49, 211, 211, 1);
    }
  `,
  characterGridContainer: css`
    display: grid;
    gap: 8px;
    padding: 0;
  `,
  createCharacter: css`
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    place-content: center;
    place-items: center;
    font-size: 16px;
    color: rgba(230, 230, 230, 1);
    border: 2px solid rgba(89, 89, 89, 1);
    border-radius: 16px;
    background: rgba(51, 51, 51, 1);
    box-sizing: border-box;
    &:hover {
      color: rgba(25, 200, 200, 1);
      border: 2px solid rgba(25, 200, 200, 1);
    }
  `,
  paginationWrap: css`
    width: calc(100% - 16px);
    position: absolute;
    bottom: 0;
    z-index: 99;
    background: rgba(31, 33, 32, 0.92);
    padding: 0px 0 4px;
    backdrop-filter: blur(2px);
  `,
}));
