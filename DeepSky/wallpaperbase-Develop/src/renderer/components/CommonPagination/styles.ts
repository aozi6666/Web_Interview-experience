import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  pagination: css`
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 16px;

    .ant-pagination {
      background: rgba(51, 51, 51, 1);
      border-radius: 8px;
      padding: 4px 24px;

      .ant-pagination-item {
        background: transparent !important;
        border: none !important;
        border-radius: 8px;
        margin-inline-end: 0 !important;

        a {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        &:hover {
          background: #333;
          border-color: #444;

          a {
            color: #fff;
          }
        }

        &.ant-pagination-item-active {
          background:rgba(0, 0, 0, 0.25) !important;
          border-color: transparent;

          a {
            color: #fff;
            font-weight: 600;
          }
        }
      }

      .ant-pagination-prev,
      .ant-pagination-next {
        margin-inline-end: 0 !important;
        background: transparent !important;

        .ant-pagination-item-link {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px !important;
          color: rgba(255, 255, 255, 0.8);
          background: transparent;
          box-shadow: none !important;
          border: none;
        }

        &:hover {
          background: #333;
          border-color: #444;

          .ant-pagination-item-link {
            color: #fff;
          }
        }

        &.ant-pagination-disabled {
          background: #1a1a1a;
          border-color: #222;

          .ant-pagination-item-link {
            color: rgba(255, 255, 255, 0.3);
          }
        }
      }

      .ant-pagination-jump-prev,
      .ant-pagination-jump-next {
        .ant-pagination-item-link {
          color: rgba(255, 255, 255, 0.6);
        }

        &:hover .ant-pagination-item-link {
          color: #fff;
        }
      }
    }
  `,
}));
