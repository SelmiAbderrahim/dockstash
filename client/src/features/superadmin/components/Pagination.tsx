import { useTranslation } from 'react-i18next';
import { Button } from '@shared/ui/button';

interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ page, pages, onPageChange }: PaginationProps) => {
  const { t } = useTranslation('superadmin');
  return (
    <div className="flex items-center justify-between pt-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('pagination.previous')}
      </Button>
      <span className="text-muted-foreground text-sm">
        {t('pagination.pageOf', { page, pages: Math.max(pages, 1) })}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('pagination.next')}
      </Button>
    </div>
  );
};
