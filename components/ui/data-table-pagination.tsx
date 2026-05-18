'use client';

import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  showSelectedCount?: boolean;
  showTotalCount?: boolean;
  showPageNumbers?: boolean;
  pageSizeOptions?: number[];
  isServerPaginated?: boolean;
  goToPage?: (page: number) => void;
  handlePageSizeChange?: (size: number) => void;
  firstItem?: number;
  lastItem?: number;
  total?: number;
}

export function DataTablePagination<TData>({
  table,
  showSelectedCount = true,
  showTotalCount = true,
  showPageNumbers = false,
  pageSizeOptions = [10, 25, 50, 100],
  isServerPaginated = false,
  goToPage,
  handlePageSizeChange,
  firstItem,
  lastItem,
  total,
}: DataTablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();
  const pageSize = table.getState().pagination.pageSize;

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        {showSelectedCount && (
          <>{table.getFilteredSelectedRowModel().rows.length} de </>
        )}
        {showTotalCount && isServerPaginated && total !== undefined ? (
          <>{firstItem}-{lastItem} de {total} fila(s)</>
        ) : showTotalCount ? (
          <>{table.getFilteredRowModel().rows.length} fila(s)</>
        ) : null}
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        {/* Selector de items por página */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Mostrar:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              if (isServerPaginated && handlePageSizeChange) {
                handlePageSizeChange(size);
              } else {
                table.setPageSize(size);
              }
            }}
            className="border rounded px-2 py-1 text-sm"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Navegación de páginas */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => isServerPaginated && goToPage ? goToPage(1) : table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => isServerPaginated && goToPage ? goToPage(currentPage - 1) : table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Numeración de páginas */}
          {showPageNumbers && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {pageCount}
              </span>
            </div>
          )}

          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => isServerPaginated && goToPage ? goToPage(currentPage + 1) : table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => isServerPaginated && goToPage ? goToPage(pageCount) : table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}