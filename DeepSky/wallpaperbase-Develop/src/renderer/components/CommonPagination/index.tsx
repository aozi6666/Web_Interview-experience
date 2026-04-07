import { Pagination, PaginationProps } from 'antd';
import { useStyles } from './styles';

interface CommonPaginationProps extends Omit<PaginationProps, 'className'> {
  className?: string;
}

function CommonPagination({
  className,
  current,
  total,
  pageSize,
  onChange,
  showTotal,
  disabled,
}: CommonPaginationProps) {
  const { styles } = useStyles();

  return (
    <div className={`${styles.pagination} ${className || ''}`}>
      <Pagination
        current={current}
        total={total}
        pageSize={pageSize}
        onChange={onChange}
        showSizeChanger={false}
        showQuickJumper={false}
        showTotal={showTotal}
        disabled={disabled}
      />
    </div>
  );
}

export default CommonPagination;
