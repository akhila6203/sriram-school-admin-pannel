
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import {
  getInventoryReport,
  downloadInventoryReport,
  adjustInventoryStock,
} from '../api/inventoryReport'
import { getImageUrl } from '../utils/imageUrl'

import { useSnackbar } from '../context/SnackbarContext'
import { formatINR, formatNumber } from '../utils/format'

const PRIMARY = '#4f46e5'
const PRIMARY_DARK = '#4338ca'
const PRIMARY_LIGHT = '#eef2ff'
const BORDER = '#dfe5ef'

const PERIODS = [
  ['today', 'Today'],
  ['date', 'Date'],
  ['range', 'Date Range'],
  ['week', 'This Week'],
  ['month', 'Month'],
  ['year', 'Year'],
]

const STOCK_FILTERS = [
  ['all', 'All Stock'],
  ['in', 'In Stock'],
  ['low', 'Low Stock'],
  ['out', 'Out of Stock'],
]

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function localToday() {
  const d = new Date()

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDisplayDate(value) {
  if (!value) return '—'

  const parts = String(value).slice(0, 10).split('-')

  if (parts.length !== 3) return value

  const [year, month, day] = parts

  return `${day} ${MONTHS[Number(month) - 1] || month} ${year}`
}

// function getImageUrl(value) {
//   if (!value) return ''

//   const path = String(value).replace(/\\/g, '/')

//   if (/^(https?:\/\/|data:|blob:)/i.test(path)) {
//     return path
//   }

//   return `/${path.replace(/^\/+/, '')}`
// }

function DownloadIcon() {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      sx={{ width: 19, height: 19, fill: 'none' }}
    >
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  )
}

function EditIcon() {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      sx={{ width: 19, height: 19, fill: 'none' }}
    >
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  )
}

function CloseIcon() {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      sx={{ width: 20, height: 20, fill: 'none' }}
    >
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Box>
  )
}

function ProductImage({ src, name }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <Box
      sx={{
        width: 54,
        height: 54,
        borderRadius: 2,
        bgcolor: '#f1f5f9',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {src && !failed ? (
        <Box
          component="img"
          src={getImageUrl(src)}
          alt={name || 'Product'}
          onError={() => setFailed(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <Typography
          fontWeight={700}
          color="text.secondary"
        >
          {String(name || 'P').charAt(0).toUpperCase()}
        </Typography>
      )}
    </Box>
  )
}

function StockStatus({ status }) {
  const settings =
    status === 'out'
      ? { label: 'Out of Stock', color: 'error' }
      : status === 'low'
        ? { label: 'Low Stock', color: 'warning' }
        : { label: 'In Stock', color: 'success' }

  return (
    <Chip
      label={settings.label}
      color={settings.color}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 700 }}
    />
  )
}

function SummaryCard({ title, value }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 2.5,
        borderColor: BORDER,
        boxShadow: 'none',
      }}
    >
      <CardContent
        sx={{
          p: { xs: 1.75, sm: 2.2 },
          '&:last-child': {
            pb: { xs: 1.75, sm: 2.2 },
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: '#64748b',
            mb: 1,
            fontWeight: 500,
          }}
        >
          {title}
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: 20, sm: 24 },
            fontWeight: 750,
            color: '#111827',
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

const inputStyle = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: PRIMARY,
    },
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: PRIMARY,
  },
}

const periodButtonStyle = (active) => ({
  minWidth: 'auto',
  minHeight: 38,
  px: 2,
  borderRadius: 2,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  fontWeight: 650,
  fontSize: 13.5,
  boxShadow: 'none',
  color: active ? '#fff' : PRIMARY,
  bgcolor: active ? PRIMARY : '#fff',
  border: `1px solid ${active ? PRIMARY : '#b8b4fa'}`,
  '&:hover': {
    bgcolor: active ? PRIMARY_DARK : PRIMARY_LIGHT,
    boxShadow: 'none',
    borderColor: PRIMARY,
  },
})

export default function Inventory() {
  const { showToast } = useSnackbar()

  const initialDate = useMemo(() => localToday(), [])
  const currentYear = new Date().getFullYear()

  const [period, setPeriod] = useState('today')
  const [stockFilter, setStockFilter] = useState('all')

  const [date, setDate] = useState(initialDate)
  const [from, setFrom] = useState(initialDate)
  const [to, setTo] = useState(initialDate)

  const [month, setMonth] = useState(
    new Date().getMonth() + 1
  )
  const [year, setYear] = useState(currentYear)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('most')

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [downloading, setDownloading] = useState(false)

  const [editing, setEditing] = useState(null)
  const [newStock, setNewStock] = useState('')
  const [reason, setReason] = useState('')
  const [savingStock, setSavingStock] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  const params = useMemo(
    () => ({
      period,
      stockFilter,
      date,
      from,
      to,
      month,
      year,
      search,
      sort,
    }),
    [
      period,
      stockFilter,
      date,
      from,
      to,
      month,
      year,
      search,
      sort,
    ]
  )

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      setLoading(true)
      setError('')

      try {
        const result = await getInventoryReport(params)

        if (!cancelled) {
          setReport(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              'Unable to load inventory report'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadReport()

    return () => {
      cancelled = true
    }
  }, [params, refreshKey])

  const summary = report?.summary || {}
  const items = report?.items || []

  const years = Array.from(
    { length: 11 },
    (_, index) => currentYear - 5 + index
  )

  const showingText = useMemo(() => {
    if (period === 'today') {
      return `Today · ${formatDisplayDate(
        report?.filters?.from || initialDate
      )}`
    }

    if (period === 'date') {
      return `Date · ${formatDisplayDate(date)}`
    }

    if (period === 'week') {
      return `This Week · ${formatDisplayDate(
        report?.filters?.from
      )} to ${formatDisplayDate(report?.filters?.to)}`
    }

    if (period === 'month') {
      return `${MONTHS[Number(month) - 1]} ${year}`
    }

    if (period === 'year') {
      return `Year · ${year}`
    }

    return `${formatDisplayDate(from)} to ${formatDisplayDate(
      to
    )}`
  }, [
    period,
    date,
    from,
    to,
    month,
    year,
    report,
    initialDate,
  ])

  function openStockEditor(item) {
    setEditing(item)
    setNewStock(String(item.unitsInStock ?? 0))
    setReason('')
  }

  function closeStockEditor() {
    if (!savingStock) {
      setEditing(null)
    }
  }

  async function saveStock() {
    if (!editing) return

    const quantity = Number(newStock)

    if (
      newStock.trim() === '' ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0
    ) {
      showToast(
        'Enter a valid stock quantity',
        'error'
      )
      return
    }

    if (!reason.trim()) {
      showToast(
        'Please enter a reason for stock adjustment',
        'error'
      )
      return
    }

    setSavingStock(true)

    try {
      await adjustInventoryStock(
        editing.variantId,
        quantity,
        reason.trim()
      )

      setEditing(null)
      showToast('Stock updated successfully', 'success')
      refresh()
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          'Stock update failed',
        'error'
      )
    } finally {
      setSavingStock(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)

    try {
      await downloadInventoryReport(params)

      showToast(
        'Inventory sheet downloaded successfully',
        'success'
      )
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          'Failed to download sheet',
        'error'
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Box sx={{ width: '100%', minWidth: 0, pb: 5 }}>
      {/* PERIOD FILTERS AND DOWNLOAD */}
      <Stack
  direction="row"
  alignItems="center"
  justifyContent="space-between"
  flexWrap="wrap"
  gap={2}
  sx={{
    mb: 2,
    width: "100%",
  }}
>
        {/* PERIOD FILTERS AND DOWNLOAD */}
<Box
  sx={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 2,
    mb: 2,
    flexWrap: { xs: "wrap", lg: "nowrap" },
  }}
>
  {/* LEFT SIDE - FILTER BUTTONS */}
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.25,
      flexWrap: "wrap",
      minWidth: 0,
      flex: "1 1 auto",
    }}
  >
    {PERIODS.map(([value, label]) => (
      <Button
        key={value}
        onClick={() => setPeriod(value)}
        sx={periodButtonStyle(period === value)}
      >
        {label}
      </Button>
    ))}
  </Box>

  {/* RIGHT SIDE - DOWNLOAD BUTTON */}
  <Button
    variant="contained"
    startIcon={<DownloadIcon />}
    disabled={downloading}
    onClick={handleDownload}
    sx={{
      bgcolor: PRIMARY,
      borderRadius: 2,
      boxShadow: "none",
      textTransform: "none",
      fontWeight: 700,
      px: 2.5,
      minHeight: 42,
      whiteSpace: "nowrap",
      flexShrink: 0,
      ml: "auto",
      "&:hover": {
        bgcolor: PRIMARY_DARK,
        boxShadow: "none",
      },
    }}
  >
    {downloading ? "Downloading..." : "Download Sheet"}
  </Button>
</Box>
      </Stack>

      {/* DATE INPUTS */}
      {period === 'date' && (
        <TextField
          type="date"
          size="small"
          label="Select Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{
            ...inputStyle,
            width: 220,
            maxWidth: '100%',
            mb: 2,
          }}
        />
      )}

      {period === 'range' && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1.5}
          sx={{ mb: 2 }}
        >
          <TextField
            type="date"
            size="small"
            label="From Date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{
              ...inputStyle,
              width: { xs: '100%', sm: 220 },
            }}
          />

          <TextField
            type="date"
            size="small"
            label="To Date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{
              ...inputStyle,
              width: { xs: '100%', sm: 220 },
            }}
          />
        </Stack>
      )}

      {period === 'month' && (
        <Stack
          direction="row"
          gap={1.5}
          sx={{ mb: 2 }}
        >
          <TextField
            select
            size="small"
            label="Month"
            value={month}
            onChange={(e) =>
              setMonth(Number(e.target.value))
            }
            sx={{
              ...inputStyle,
              width: { xs: '55%', sm: 175 },
            }}
          >
            {MONTHS.map((name, index) => (
              <MenuItem key={name} value={index + 1}>
                {name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Year"
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value))
            }
            sx={{
              ...inputStyle,
              width: { xs: '45%', sm: 125 },
            }}
          >
            {years.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )}

      {period === 'year' && (
        <TextField
          select
          size="small"
          label="Year"
          value={year}
          onChange={(e) =>
            setYear(Number(e.target.value))
          }
          sx={{
            ...inputStyle,
            width: 220,
            maxWidth: '100%',
            mb: 2,
          }}
        >
          {years.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
      )}

      <Typography
        sx={{
          fontSize: 14,
          color: '#64748b',
          mb: 3,
        }}
      >
        Showing: {showingText}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* SUMMARY CARDS */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2,minmax(0,1fr))',
            md: 'repeat(4,minmax(0,1fr))',
          },
          gap: 2,
          mb: 3,
        }}
      >
        <SummaryCard
          title="Total Units Sold"
          value={formatNumber(summary.totalUnitsSold || 0)}
        />

        <SummaryCard
          title="Products Sold"
          value={formatNumber(summary.productsSold || 0)}
        />

        <SummaryCard
          title="Total Sales"
          value={formatINR(summary.totalSales || 0)}
        />

        <SummaryCard
          title="Orders"
          value={formatNumber(summary.orders || 0)}
        />

        <SummaryCard
          title="Units In Stock"
          value={formatNumber(summary.unitsInStock || 0)}
        />
        

        <SummaryCard
          title="Low Stock"
          value={formatNumber(summary.lowStock || 0)}
        />

        <SummaryCard
          title="Out of Stock"
          value={formatNumber(summary.outOfStock || 0)}
        />
      </Box>

      {/* STOCK DROPDOWN + SEARCH + SORT */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '180px minmax(0,1fr)',
            lg: '190px minmax(0,1fr) 190px',
          },
          gap: 1.5,
          mb: 2.5,
          alignItems: 'center',
        }}
      >
        <TextField
          select
          size="small"
          label="Stock"
          value={stockFilter}
          onChange={(e) =>
            setStockFilter(e.target.value)
          }
          sx={inputStyle}
        >
          {STOCK_FILTERS.map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          fullWidth
          placeholder="Search product, SKU or options..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            ...inputStyle,
            minWidth: 0,
          }}
        />

        <TextField
          select
          size="small"
          label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          sx={{
            ...inputStyle,
            gridColumn: {
              xs: 'auto',
              sm: '2',
              lg: 'auto',
            },
          }}
        >
          <MenuItem value="most">Most Sold</MenuItem>
          <MenuItem value="least">Least Sold</MenuItem>
          <MenuItem value="sales">Highest Sales</MenuItem>
          <MenuItem value="stock">Highest Stock</MenuItem>
          <MenuItem value="name">Product Name</MenuItem>
        </TextField>
      </Box>

      {/* INVENTORY TABLE */}
      <Card
        variant="outlined"
        sx={{
          borderRadius: 3,
          borderColor: BORDER,
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <Box
            sx={{
              py: 7,
              textAlign: 'center',
            }}
          >
            <CircularProgress sx={{ color: PRIMARY }} />
          </Box>
        ) : items.length === 0 ? (
          <Box
            sx={{
              py: 7,
              textAlign: 'center',
            }}
          >
            <Typography color="text.secondary">
              No inventory records found.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              overflowX: 'auto',
            }}
          >
            <Box
              component="table"
              sx={{
                width: '100%',
                minWidth: 1050,
                borderCollapse: 'collapse',
                '& th': {
                  bgcolor: '#f8f9ff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'left',
                  px: 1.7,
                  py: 1.8,
                  whiteSpace: 'nowrap',
                  borderBottom: `1px solid ${BORDER}`,
                },
                '& td': {
                  px: 1.7,
                  py: 1.5,
                  borderBottom: `1px solid ${BORDER}`,
                  fontSize: 14,
                },
                '& tbody tr:hover': {
                  bgcolor: '#fafaff',
                },
                '& tbody tr:last-child td': {
                  borderBottom: 'none',
                },
              }}
            >
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Options</th>
                  <th>Units Sold</th>
                  <th>Sales Amount</th>
                  <th>Units In Stock</th>
                  <th>Stock Status</th>
                  <th>Adjust Stock</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.variantId}>
                    <td>
                      <ProductImage
                        src={item.imageUrl}
                        name={item.productName}
                      />
                    </td>

                    <td>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ minWidth: 125 }}
                      >
                        {item.productName}
                      </Typography>
                    </td>

                    <td>
                      {item.sku || '—'}
                    </td>

                    <td>
                      <Typography
                        variant="body2"
                        sx={{
                          minWidth: 110,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {item.options || '—'}
                      </Typography>
                    </td>

                    <td>
                      <Typography fontWeight={700}>
                        {formatNumber(item.unitsSold || 0)}
                      </Typography>
                    </td>

                    <td>
                      <Typography fontWeight={700}>
                        {formatINR(item.salesAmount || 0)}
                      </Typography>
                    </td>

                    <td>
                      <Typography fontWeight={700}>
                        {formatNumber(item.unitsInStock || 0)}
                      </Typography>
                    </td>

                    <td>
                      <StockStatus status={item.stockStatus} />
                    </td>

                    <td>
                      <IconButton
                        title="Adjust Stock"
                        aria-label={`Adjust stock for ${item.sku}`}
                        onClick={() => openStockEditor(item)}
                        sx={{
                          color: PRIMARY,
                          bgcolor: PRIMARY_LIGHT,
                          borderRadius: 2,
                          '&:hover': {
                            bgcolor: '#dddafe',
                          },
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        )}
      </Card>

      {/* EDIT STOCK DIALOG */}
      <Dialog
        open={Boolean(editing)}
        onClose={closeStockEditor}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography
              variant="h6"
              fontWeight={700}
            >
              Adjust Stock
            </Typography>

            <IconButton
              onClick={closeStockEditor}
              disabled={savingStock}
              aria-label="Close"
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent>
          {editing && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
              >
                <ProductImage
                  src={editing.imageUrl}
                  name={editing.productName}
                />

                <Box>
                  <Typography fontWeight={700}>
                    {editing.productName}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    SKU: {editing.sku || '—'}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {editing.options || '—'}
                  </Typography>
                </Box>
              </Stack>

              <Box
                sx={{
                  bgcolor: PRIMARY_LIGHT,
                  p: 2,
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Current Stock
                </Typography>

                <Typography
                  variant="h5"
                  fontWeight={750}
                >
                  {formatNumber(editing.unitsInStock || 0)}
                </Typography>
              </Box>

              <TextField
                fullWidth
                required
                size="small"
                type="number"
                label="New Stock Quantity"
                value={newStock}
                onChange={(e) =>
                  setNewStock(e.target.value)
                }
                inputProps={{
                  min: 0,
                  step: 1,
                }}
                helperText="Enter the final available stock quantity."
                sx={inputStyle}
              />

              <TextField
                fullWidth
                required
                size="small"
                multiline
                minRows={2}
                label="Reason / Note"
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value)
                }
                placeholder="Example: Physical stock correction"
                sx={inputStyle}
              />

              <Alert severity="info">
                Stock update chesinappudu corresponding
                product variant stock kuda update avuthundhi.
              </Alert>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={closeStockEditor}
            disabled={savingStock}
            sx={{
              textTransform: 'none',
              color: PRIMARY,
              borderColor: '#b8b4fa',
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={saveStock}
            disabled={savingStock}
            sx={{
              bgcolor: PRIMARY,
              textTransform: 'none',
              boxShadow: 'none',
              px: 2.5,
              '&:hover': {
                bgcolor: PRIMARY_DARK,
                boxShadow: 'none',
              },
            }}
          >
            {savingStock
              ? 'Saving...'
              : 'Update Stock'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}



// import { useEffect, useMemo, useState } from 'react'
// import {
//   Button,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   Drawer,
//   Grid,
//   MenuItem,
//   Stack,
//   TextField,
//   Typography,
// } from '@mui/material'
// import PageHeader from '../components/PageHeader'
// import DataTable from '../components/DataTable'
// import StatCard from '../components/StatCard'
// import StatusBadge from '../components/StatusBadge'
// import { CardGridSkeleton } from '../components/LoadingSkeleton'
// import usePaginatedList from '../hooks/usePaginatedList'
// import { useSnackbar } from '../context/SnackbarContext'
// import { formatINR, formatNumber, formatDateTime } from '../utils/format'
// import {
//   adjustStock,
//   bulkStockCommit,
//   bulkStockPreview,
//   listInventory,
//   listMovements,
// } from '../api/admin'
// import api from '../api/client'

// export default function Inventory() {
//   const { showToast } = useSnackbar()
//   const [filters, setFilters] = useState({ search: '', stockFilter: '' })
//   const [kpis, setKpis] = useState(null)
//   const [dialog, setDialog] = useState(null)
//   const [history, setHistory] = useState(null)
//   const [bulkPreview, setBulkPreview] = useState(null)
//   const [bulkFile, setBulkFile] = useState(null)
//   const [inline, setInline] = useState({})

//   const fetcher = useMemo(() => (params) => listInventory(params), [])
//   const { items, pagination, loading, error, page, pageSize, setPage, setPageSize, reload } =
//     usePaginatedList(fetcher, filters)

//   useEffect(() => {
//     api
//       .get('/admin/inventory/summary')
//       .then((r) => setKpis(r.data.data))
//       .catch(() => {})
//   }, [items])

//   async function submitAdjust(e) {
//     e.preventDefault()
//     try {
//       await adjustStock(dialog.id, {
//         mode: dialog.mode,
//         quantity: Number(dialog.quantity),
//         note: dialog.note,
//       })
//       showToast('Stock updated', 'success')
//       setDialog(null)
//       reload()
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Update failed', 'error')
//     }
//   }

//   return (
//     <>
//       <PageHeader
//         title="Inventory"
//         subtitle="Variant stock, restock, adjustments, and bulk Excel."
//         actions={
//           <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//             <Button variant="outlined" href="/api/admin/inventory/export?format=csv">Export CSV</Button>
//             <Button variant="outlined" href="/api/admin/inventory/export?format=xlsx">Export Excel</Button>
//             <Button variant="outlined" href="/api/admin/inventory/low-stock-report">Low-stock report</Button>
//             <Button variant="contained" component="label">
//               Bulk Excel
//               <input
//                 hidden
//                 type="file"
//                 accept=".xlsx,.xls,.csv"
//                 onChange={async (e) => {
//                   const file = e.target.files?.[0]
//                   if (!file) return
//                   setBulkFile(file)
//                   try {
//                     const res = await bulkStockPreview(file)
//                     setBulkPreview(res.data)
//                   } catch (err) {
//                     showToast(err.response?.data?.message || 'Preview failed', 'error')
//                   }
//                 }}
//               />
//             </Button>
//           </Stack>
//         }
//       />

//       {!kpis ? (
//         <CardGridSkeleton count={5} />
//       ) : (
//         <Grid container spacing={2} sx={{ mb: 2 }}>
//           <Grid size={{ xs: 12, sm: 6, md: 2.4 }}><StatCard title="Total SKUs" value={formatNumber(kpis.totalSkus)} /></Grid>
//           <Grid size={{ xs: 12, sm: 6, md: 2.4 }}><StatCard title="Units in stock" value={formatNumber(kpis.unitsInStock)} /></Grid>
//           <Grid size={{ xs: 12, sm: 6, md: 2.4 }}><StatCard title="Stock value" value={formatINR(kpis.stockValue)} /></Grid>
//           <Grid size={{ xs: 12, sm: 6, md: 2.4 }}><StatCard title="Low stock" value={kpis.lowStock} /></Grid>
//           <Grid size={{ xs: 12, sm: 6, md: 2.4 }}><StatCard title="Out of stock" value={kpis.outOfStock} /></Grid>
//         </Grid>
//       )}

//       <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
//         <TextField
//           placeholder="Search SKU / product"
//           fullWidth
//           value={filters.search}
//           onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
//         />
//         <TextField
//           select
//           label="Stock"
//           value={filters.stockFilter}
//           onChange={(e) => setFilters((f) => ({ ...f, stockFilter: e.target.value }))}
//           sx={{ minWidth: 160 }}
//         >
//           <MenuItem value="">All</MenuItem>
//           <MenuItem value="low">Low</MenuItem>
//           <MenuItem value="out">Out of stock</MenuItem>
//         </TextField>
//       </Stack>

//       <DataTable
//         columns={[
//           { id: 'productName', label: 'Product', render: (r) => r.productName },
//           { id: 'sku', label: 'SKU', render: (r) => r.sku },
//           { id: 'opts', label: 'Options', render: (r) => [r.option1Value, r.option2Value].filter(Boolean).join(' / ') || '—' },
//           {
//             id: 'stockQty',
//             label: 'Qty',
//             width: 140,
//             render: (r) => (
//               <TextField
//                 size="small"
//                 type="number"
//                 value={inline[r.id] ?? r.stockQty}
//                 onClick={(e) => e.stopPropagation()}
//                 onChange={(e) => setInline((s) => ({ ...s, [r.id]: e.target.value }))}
//                 onBlur={async (e) => {
//                   const qty = Number(e.target.value)
//                   if (qty === r.stockQty || Number.isNaN(qty)) return
//                   try {
//                     await adjustStock(r.id, { mode: 'set', quantity: qty, note: 'Inline qty edit' })
//                     showToast('Qty saved', 'success')
//                     reload()
//                   } catch (err) {
//                     showToast(err.response?.data?.message || 'Failed', 'error')
//                   }
//                 }}
//                 sx={{ width: 90 }}
//               />
//             ),
//           },
//           { id: 'th', label: 'Threshold', render: (r) => r.lowStockThreshold },
//           { id: 'status', label: 'Status', render: (r) => <StatusBadge status={r.statusBadge === 'ok' ? 'in stock' : r.statusBadge} /> },
//           {
//             id: 'actions',
//             label: '',
//             align: 'right',
//             render: (r) => (
//               <Stack direction="row" spacing={0.5} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
//                 <Button size="small" onClick={() => setDialog({ id: r.id, mode: 'restock', quantity: 10, note: '', sku: r.sku })}>Restock</Button>
//                 <Button size="small" onClick={() => setDialog({ id: r.id, mode: 'adjust', quantity: -1, note: '', sku: r.sku })}>Adjust</Button>
//                 <Button
//                   size="small"
//                   onClick={async () => {
//                     const res = await listMovements(r.id)
//                     setHistory({ sku: r.sku, items: res.data.items })
//                   }}
//                 >
//                   History
//                 </Button>
//               </Stack>
//             ),
//           },
//         ]}
//         rows={items}
//         loading={loading}
//         error={error}
//         page={page}
//         pageSize={pageSize}
//         total={pagination.total}
//         onPageChange={setPage}
//         onPageSizeChange={setPageSize}
//         emptyTitle="No variants"
//       />

//       <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
//         <form onSubmit={submitAdjust}>
//           <DialogTitle sx={{ textTransform: 'capitalize' }}>{dialog?.mode} · {dialog?.sku}</DialogTitle>
//           <DialogContent>
//             <Stack spacing={2} sx={{ mt: 1 }}>
//               <TextField
//                 type="number"
//                 label="Quantity"
//                 required
//                 fullWidth
//                 value={dialog?.quantity ?? ''}
//                 onChange={(e) => setDialog((d) => ({ ...d, quantity: e.target.value }))}
//               />
//               <TextField
//                 label="Reason"
//                 required
//                 fullWidth
//                 value={dialog?.note ?? ''}
//                 onChange={(e) => setDialog((d) => ({ ...d, note: e.target.value }))}
//               />
//             </Stack>
//           </DialogContent>
//           <DialogActions>
//             <Button onClick={() => setDialog(null)}>Cancel</Button>
//             <Button type="submit" variant="contained">Save</Button>
//           </DialogActions>
//         </form>
//       </Dialog>

//       <Drawer anchor="right" open={Boolean(history)} onClose={() => setHistory(null)}>
//         <Stack sx={{ width: { xs: 320, sm: 420 }, p: 2 }} spacing={1}>
//           <Typography fontWeight={700}>Movements · {history?.sku}</Typography>
//           {(history?.items || []).map((m) => (
//             <Stack key={m.id} direction="row" justifyContent="space-between" sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}>
//               <Typography variant="body2">
//                 {m.changeQty > 0 ? '+' : ''}{m.changeQty} · {m.reason}
//                 <br />
//                 <Typography component="span" variant="caption" color="text.secondary">
//                   {m.note || '—'} · {m.adminName || 'system'} · {formatDateTime(m.createdAt)}
//                 </Typography>
//               </Typography>
//             </Stack>
//           ))}
//           {!history?.items?.length && <Typography variant="body2" color="text.secondary">No movements</Typography>}
//         </Stack>
//       </Drawer>

//       <Dialog open={Boolean(bulkPreview)} onClose={() => setBulkPreview(null)} maxWidth="sm" fullWidth>
//         <DialogTitle>Bulk stock preview</DialogTitle>
//         <DialogContent>
//           <Typography variant="body2">
//             Valid {bulkPreview?.counts?.valid} / Invalid {bulkPreview?.counts?.invalid}
//           </Typography>
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setBulkPreview(null)}>Close</Button>
//           <Button
//             variant="contained"
//             onClick={async () => {
//               const res = await bulkStockCommit(bulkFile)
//               showToast(`Updated ${res.data.updated}`, 'success')
//               setBulkPreview(null)
//               reload()
//             }}
//           >
//             Commit
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </>
//   )
// }
