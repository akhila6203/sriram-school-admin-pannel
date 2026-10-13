import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material'
import EmptyState from './EmptyState'
import LoadingSkeleton from './LoadingSkeleton'

/**
 * @param {Array<{id: string, label: string, align?: string, width?: number|string, render?: Function}>} columns
 */
export default function DataTable({
  columns,
  rows = [],
  loading = false,
  error = null,
  page = 0,
  pageSize = 20,
  total = 0,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  emptyTitle = 'No records found',
  emptyDescription,
  getRowId = (row) => row.id,
  stickyHeader = true,
}) {
  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    )
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <TableContainer className="scrollbar-hidden" sx={{ maxHeight: '70vh', overflowX: 'auto' }}>
        <Table stickyHeader={stickyHeader} size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id} align={col.align || 'left'} sx={{ width: col.width }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ p: 0 }}>
                  <LoadingSkeleton rows={5} height={36} />
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              rows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  hover
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} align={col.align || 'left'}>
                      {col.render ? col.render(row) : row[col.id]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      {onPageChange && (
        <Box>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => onPageChange(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => onPageSizeChange?.(parseInt(e.target.value, 10))}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Box>
      )}
    </Paper>
  )
}
