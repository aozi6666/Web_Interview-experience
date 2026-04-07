import { createStyles } from 'antd-style';
import { scrollbarMixin } from '../../styles/scrollbar';

export const useStyles = createStyles(({ css }) => ({
  slideHost: css`
    /* position: relative; */
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
    padding-bottom: 35px;
    ${scrollbarMixin}
  `,
  recommendTitle: css`
    color: #ffffff;
    font-size: 14px;
    line-height: 32px;
  `,
  wallpaperHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
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
  wallpaperGrid: css`
    flex: 1;
  `,
  listStatusBox: css`
    padding: 8px 4px;
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
