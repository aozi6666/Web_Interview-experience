import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  filterItem: css`
    color: #9d9d9d;
    margin-bottom: 10px;
    padding-left: 2px;
    font-size: 13px;
    display: flex;
  `,
  tagFilterWrapper: css`
    width: 100%;
    position: relative;
    min-width: 0;
  `,
  tagFilter: css`
    display: flex;
    flex-wrap: nowrap;
    gap: 15px;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    scroll-behavior: smooth;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  tagFilterArrow: css`
    position: absolute;
    top: 50%;
    z-index: 1;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: rgba(0, 73, 74, 0.3);
    color: rgba(236, 238, 237, 1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transform: translateY(-50%);
    transition:
      opacity 0.2s ease,
      visibility 0.2s ease;

    &:hover {
      background: rgba(0, 73, 74, 0.3);
    }
  `,
  tagFilterArrowHidden: css`
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  `,
  tagFilterArrowLeft: css`
    left: 0;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: -8px;
      width: 68px;
      height: 40px;
      transform: translateY(-50%);
      border-radius: 4px 0 0 4px;
      background: linear-gradient(
        90deg,
        rgba(40, 40, 40, 1) 0%,
        rgba(40, 40, 40, 0.9) 48%,
        rgba(40, 40, 40, 0) 100%
      );
      pointer-events: none;
      z-index: -1;
    }
  `,
  tagFilterArrowRight: css`
    right: 0;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      right: -8px;
      width: 68px;
      height: 40px;
      transform: translateY(-50%);
      border-radius: 0 4px 4px 0;
      background: linear-gradient(
        270deg,
        rgba(40, 40, 40, 1) 0%,
        rgba(40, 40, 40, 0.9) 48%,
        rgba(40, 40, 40, 0) 100%
      );
      pointer-events: none;
      z-index: -1;
    }
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
}));
