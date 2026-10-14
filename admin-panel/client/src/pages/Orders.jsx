import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'

import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import usePaginatedList from '../hooks/usePaginatedList'
import { useSnackbar } from '../context/SnackbarContext'
import { formatDateTime, formatINR } from '../utils/format'
import { bulkOrderStatus, listOrders, pickList } from '../api/admin'
import api from '../api/client'

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']

export default function Orders() {
  const { showToast } = useSnackbar()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [statusTab, setStatusTab] = useState('')
  const [filters, setFilters] = useState({
  search: '',
  type: '',
  houseColor: '',
  from: '',
  to: '',
})
  const [selected, setSelected] = useState([])
  const [pick, setPick] = useState(null)
  const [counts, setCounts] = useState({})
  const [payFilters, setPayFilters] = useState({ search: '' })

const [paymentStats, setPaymentStats] = useState({
  totalTransactions: 0,
  successful: 0,
  totalItems: 0,
  totalCollection: 0,
})
  // const [payFilters, setPayFilters] = useState({ search: '', status: '' })

  const orderFilters = useMemo(
    () => ({ ...filters, status: statusTab }),
    [filters, statusTab]
  )
  const fetcher = useMemo(() => (params) => listOrders(params), [])
  const { items, pagination, loading, error, page, pageSize, setPage, setPageSize, reload } =
    usePaginatedList(fetcher, orderFilters)

  const payFetcher = useMemo(
    () => async (params) => {
      try {
        const { data } = await api.get('/admin/payments', { params })
        return data
      } catch {
        return { data: { items: [], pagination: { total: 0 } } }
      }
    },
    []
  )
  const payments = usePaginatedList(payFetcher, payFilters)

  useEffect(() => {
    api
      .get('/admin/orders/counts')
      .then((r) => setCounts(r.data.data.counts || {}))
      .catch(() => {})
  }, [items])

  useEffect(() => {
  if (tab !== 1) return

  const loadPaymentSummary = async () => {
    try {
      const response = await api.get('/admin/payments/summary')

      setPaymentStats(response.data.data)
    } catch (error) {
      console.error('Unable to load payment summary:', error)
    }
  }

  loadPaymentSummary()
}, [tab, payments.items])

  const allChecked = items.length > 0 && selected.length === items.length

  return (
    <>
      

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Orders" />
        <Tab label="Payments" />
      </Tabs>

      {tab === 0 && (
        <>
          {/* <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Button size="small" variant={statusTab === '' ? 'contained' : 'outlined'} onClick={() => setStatusTab('')}>
              All ({Object.values(counts).reduce((a, b) => a + Number(b || 0), 0) || '—'})
            </Button>
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="small"
                variant={statusTab === s ? 'contained' : 'outlined'}
                onClick={() => setStatusTab(s)}
              >
                {s} ({counts[s] ?? 0})
              </Button>
            ))}
          </Stack> */}

          <Stack
  direction={{ xs: 'column', lg: 'row' }}
  spacing={1.5}
  sx={{ mb: 2, alignItems: { lg: 'center' } }}
>
  {/* SEARCH */}
  <TextField
    size="small"
    placeholder="Search"
    value={filters.search}
    onChange={(e) =>
      setFilters((f) => ({
        ...f,
        search: e.target.value,
      }))
    }
    sx={{ flex: 1, minWidth: 160 }}
  />

  {/* ORDER STATUS */}
  <TextField
    select
    size="small"
    label="Status"
    value={statusTab}
    onChange={(e) => {
      setStatusTab(e.target.value)
      setPage(1)
    }}
    sx={{ width: { xs: '100%', lg: 175 } }}
  >
    <MenuItem value="">
      All ({Object.values(counts).reduce(
        (a, b) => a + Number(b || 0),
        0
      )})
    </MenuItem>

    {STATUSES.map((status) => (
      <MenuItem key={status} value={status}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
        {' '}({counts[status] ?? 0})
      </MenuItem>
    ))}
  </TextField>

  {/* TYPE */}
  <TextField
    select
    size="small"
    label="Type"
    value={filters.type}
    onChange={(e) =>
      setFilters((f) => ({
        ...f,
        type: e.target.value,
      }))
    }
    sx={{ width: { xs: '100%', lg: 140 } }}
  >
    <MenuItem value="">All</MenuItem>
    <MenuItem value="kit">Kit</MenuItem>
    <MenuItem value="individual">Individual</MenuItem>
  </TextField>

  {/* HOUSE */}
  <TextField
    select
    size="small"
    label="House"
    value={filters.houseColor}
    onChange={(e) =>
      setFilters((f) => ({
        ...f,
        houseColor: e.target.value,
      }))
    }
    sx={{ width: { xs: '100%', lg: 130 } }}
  >
    <MenuItem value="">All</MenuItem>
    {['Red', 'Yellow', 'Green', 'Blue'].map((color) => (
      <MenuItem key={color} value={color}>
        {color}
      </MenuItem>
    ))}
  </TextField>

  {/* FROM DATE */}
  <TextField
    type="date"
    size="small"
    label="From Date"
    value={filters.from}
    onChange={(e) =>
      setFilters((f) => ({
        ...f,
        from: e.target.value,
      }))
    }
    InputLabelProps={{ shrink: true }}
    sx={{
      width: { xs: '100%', lg: 180 },
      '& .MuiInputLabel-root': {
        backgroundColor: '#f8fafc',
        px: 0.5,
      },
    }}
  />

  {/* TO DATE */}
  <TextField
    type="date"
    size="small"
    label="To Date"
    value={filters.to}
    onChange={(e) =>
      setFilters((f) => ({
        ...f,
        to: e.target.value,
      }))
    }
    InputLabelProps={{ shrink: true }}
    inputProps={{
      min: filters.from || undefined,
    }}
    sx={{
      width: { xs: '100%', lg: 180 },
      '& .MuiInputLabel-root': {
        backgroundColor: '#f8fafc',
        px: 0.5,
      },
    }}
  />
</Stack>

          {selected.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <TextField
                select
                size="small"
                label="Bulk status"
                defaultValue=""
                sx={{ minWidth: 180 }}
                onChange={async (e) => {
                  if (!e.target.value) return
                  await bulkOrderStatus(selected, e.target.value)
                  showToast('Status updated', 'success')
                  reload()
                }}
              >
                <MenuItem value="">Choose…</MenuItem>
                {['confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'].map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  const res = await pickList(selected)
                  setPick(res.data.lines)
                }}
              >
                Pick list
              </Button>
              <Button
                size="small"
                variant="outlined"
                href={`/api/admin/gst/download?type=packing-slip&orderIds=${selected.join(',')}`}
              >
                Bulk packing slips
              </Button>
            </Stack>
          )}

          <DataTable
            columns={[
              {
                id: 'sel',
                width: 48,
                label: (
                  <Checkbox
                    size="small"
                    checked={allChecked}
                    onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])}
                    onClick={(ev) => ev.stopPropagation()}
                  />
                ),
                render: (r) => (
                  <Checkbox
                    size="small"
                    checked={selected.includes(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))}
                  />
                ),
              },
              { id: 'id', label: 'ID', render: (r) => r.orderNumber || r.id },
              { id: 'date', label: 'Date', render: (r) => formatDateTime(r.createdAt) },
              { id: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { id: 'student', label: 'Student', render: (r) => r.studentName },
              { id: 'adm', label: 'Admission no.', render: (r) => r.admissionNumber },
              { id: 'house', label: 'House', render: (r) => r.houseColor },
              { id: 'type', label: 'Type', render: (r) => <StatusBadge status={r.type} /> },
              { id: 'phone', label: 'Phone/Email', render: (r) => r.phone || r.email || '—' },
              { id: 'items', label: 'Items', render: (r) => r.itemCount },
              { id: 'sub', label: 'Subtotal', render: (r) => formatINR(r.subtotal) },
              { id: 'tax', label: 'Tax', render: (r) => formatINR(r.tax) },
              { id: 'total', label: 'Total', render: (r) => formatINR(r.total) },
              { id: 'pm', label: 'Payment method', render: (r) => r.paymentMethod },
              { id: 'ps', label: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
              { id: 'txn', label: 'Txn ID', render: (r) => r.txnId || '—' },
            ]}
            rows={items}
            loading={loading}
            error={error}
            page={page}
            pageSize={pageSize}
            total={pagination.total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onRowClick={(r) => navigate(`/admin/orders/${r.id}`)}
            emptyTitle="No orders"
          />
        </>
      )}

      {tab === 1 && (
        <>
        <Box
  sx={{
    display: 'grid',
    gridTemplateColumns: {
      xs: 'repeat(2, minmax(0, 1fr))',
      lg: 'repeat(4, minmax(0, 1fr))',
    },
    gap: 2,
    mb: 3,
  }}
>
  {[
    {
      label: 'Total Transactions',
      value: paymentStats.totalTransactions,
    },
    {
      label: 'Successful',
      value: paymentStats.successful,
    },
    {
      label: 'Total Items',
      value: paymentStats.totalItems,
    },
    {
      label: 'Total Collection',
      value: formatINR(paymentStats.totalCollection),
    },
  ].map((stat) => (
    <Card
      key={stat.label}
      variant="outlined"
      sx={{
        borderRadius: 2,
        boxShadow: 'none',
        minWidth: 0,
      }}
    >
      <CardContent>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          {stat.label}
        </Typography>

        <Typography
          variant="h5"
          fontWeight={800}
          sx={{ overflowWrap: 'anywhere' }}
        >
          {stat.value}
        </Typography>
      </CardContent>
    </Card>
  ))}
</Box>
          <Stack
  direction="row"
  justifyContent="flex-end"
  sx={{ mb: 2 }}
>
  <TextField
    size="small"
    placeholder="Search order / txn"
    value={payFilters.search}
    onChange={(e) =>
      setPayFilters((f) => ({
        ...f,
        search: e.target.value,
      }))
    }
    sx={{
      width: {
        xs: '100%',
        sm: 320,
      },
    }}
  />
</Stack>
          <DataTable
            columns={[
              { id: 'date', label: 'Date', render: (r) => formatDateTime(r.createdAt) },
              { id: 'order', label: 'Order', render: (r) => (
                <Box component={RouterLink} to={`/admin/orders/${r.orderId}`}>{r.orderNumber}</Box>
              ) },
              { id: 'paytm', label: 'Paytm order id', render: (r) => r.paytmOrderId },
              { id: 'txn', label: 'Txn id', render: (r) => r.txnId || '—' },
              { id: 'bank', label: 'Bank txn id', render: (r) => r.bankTxnId || '—' },
              { id: 'mode', label: 'Mode', render: (r) => r.paymentMode || '—' },
              { id: 'amt', label: 'Amount', render: (r) => formatINR(r.amount) },
              { id: 'st', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { id: 'msg', label: 'Response', render: (r) => r.respMsg || '—' },
            ]}
            rows={payments.items}
            loading={payments.loading}
            error={payments.error}
            page={payments.page}
            pageSize={payments.pageSize}
            total={payments.pagination.total}
            onPageChange={payments.setPage}
            onPageSizeChange={payments.setPageSize}
            emptyTitle="No payment transactions"
          />
        </>
      )}

      <Dialog open={Boolean(pick)} onClose={() => setPick(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Pick list</DialogTitle>
        <DialogContent>
          {(pick || []).map((l) => (
            <Stack key={l.sku + l.options} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
              <Typography variant="body2">{l.sku} · {l.options || '—'} · {l.name}</Typography>
              <Typography fontWeight={700}>×{l.quantity}</Typography>
            </Stack>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPick(null)}>Close</Button>
          <Button variant="contained" onClick={() => window.print()}>Print</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}





// import { useEffect, useMemo, useState } from 'react'
// import { Link as RouterLink, useNavigate } from 'react-router-dom'
// import {
//   Box,
//   Button,
//   Checkbox,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   MenuItem,
//   Stack,
//   Tab,
//   Tabs,
//   TextField,
//   Typography,
// } from '@mui/material'
// import PageHeader from '../components/PageHeader'
// import DataTable from '../components/DataTable'
// import StatusBadge from '../components/StatusBadge'
// import usePaginatedList from '../hooks/usePaginatedList'
// import { useSnackbar } from '../context/SnackbarContext'
// import { formatDateTime, formatINR } from '../utils/format'
// import { bulkOrderStatus, listOrders, pickList } from '../api/admin'
// import api from '../api/client'

// const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']

// export default function Orders() {
//   const { showToast } = useSnackbar()
//   const navigate = useNavigate()
//   const [tab, setTab] = useState(0)
//   const [statusTab, setStatusTab] = useState('')
//   const [filters, setFilters] = useState({
//     search: '',
//     type: '',
//     paymentStatus: '',
//     houseColor: '',
//     from: '',
//     to: '',
//   })
//   const [selected, setSelected] = useState([])
//   const [pick, setPick] = useState(null)
//   const [counts, setCounts] = useState({})
//   const [payFilters, setPayFilters] = useState({ search: '', status: '' })

//   const orderFilters = useMemo(
//     () => ({ ...filters, status: statusTab }),
//     [filters, statusTab]
//   )
//   const fetcher = useMemo(() => (params) => listOrders(params), [])
//   const { items, pagination, loading, error, page, pageSize, setPage, setPageSize, reload } =
//     usePaginatedList(fetcher, orderFilters)

//   const payFetcher = useMemo(
//     () => async (params) => {
//       try {
//         const { data } = await api.get('/admin/payments', { params })
//         return data
//       } catch {
//         return { data: { items: [], pagination: { total: 0 } } }
//       }
//     },
//     []
//   )
//   const payments = usePaginatedList(payFetcher, payFilters)

//   useEffect(() => {
//     api
//       .get('/admin/orders/counts')
//       .then((r) => setCounts(r.data.data.counts || {}))
//       .catch(() => {})
//   }, [items])

//   const allChecked = items.length > 0 && selected.length === items.length

//   return (
//     <>
//       <PageHeader
//         title="Orders"
//         subtitle="Fulfillment, packing slips, and payments."
//         actions={
//           tab === 0 ? (
//             <Stack direction="row" spacing={1}>
//               <Button variant="outlined" href="/api/admin/orders/export?format=csv">Export CSV</Button>
//               <Button variant="outlined" href="/api/admin/orders/export?format=xlsx">Export Excel</Button>
//             </Stack>
//           ) : (
//             <Button variant="outlined" href="/api/admin/payments/export">Export payments</Button>
//           )
//         }
//       />

//       <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
//         <Tab label="Orders" />
//         <Tab label="Payments" />
//       </Tabs>

//       {tab === 0 && (
//         <>
//           <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
//             <Button size="small" variant={statusTab === '' ? 'contained' : 'outlined'} onClick={() => setStatusTab('')}>
//               All ({Object.values(counts).reduce((a, b) => a + Number(b || 0), 0) || '—'})
//             </Button>
//             {STATUSES.map((s) => (
//               <Button
//                 key={s}
//                 size="small"
//                 variant={statusTab === s ? 'contained' : 'outlined'}
//                 onClick={() => setStatusTab(s)}
//               >
//                 {s} ({counts[s] ?? 0})
//               </Button>
//             ))}
//           </Stack>

//           <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
//             <TextField placeholder="Search" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} sx={{ minWidth: 180, flex: 1 }} />
//             <TextField select label="Type" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} sx={{ minWidth: 130 }}>
//               <MenuItem value="">All</MenuItem>
//               <MenuItem value="kit">Kit</MenuItem>
//               <MenuItem value="individual">Individual</MenuItem>
//             </TextField>
//             <TextField select label="Payment" value={filters.paymentStatus} onChange={(e) => setFilters((f) => ({ ...f, paymentStatus: e.target.value }))} sx={{ minWidth: 140 }}>
//               <MenuItem value="">All</MenuItem>
//               {['pending', 'paid', 'failed', 'refunded', 'partially_refunded'].map((s) => (
//                 <MenuItem key={s} value={s}>{s}</MenuItem>
//               ))}
//             </TextField>
//             <TextField select label="House" value={filters.houseColor} onChange={(e) => setFilters((f) => ({ ...f, houseColor: e.target.value }))} sx={{ minWidth: 120 }}>
//               <MenuItem value="">All</MenuItem>
//               {['Red', 'Yellow', 'Green', 'Blue'].map((c) => (
//                 <MenuItem key={c} value={c}>{c}</MenuItem>
//               ))}
//             </TextField>
//             <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
//             <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
//           </Stack>

//           {selected.length > 0 && (
//             <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
//               <TextField
//                 select
//                 size="small"
//                 label="Bulk status"
//                 defaultValue=""
//                 sx={{ minWidth: 180 }}
//                 onChange={async (e) => {
//                   if (!e.target.value) return
//                   await bulkOrderStatus(selected, e.target.value)
//                   showToast('Status updated', 'success')
//                   reload()
//                 }}
//               >
//                 <MenuItem value="">Choose…</MenuItem>
//                 {['confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'].map((s) => (
//                   <MenuItem key={s} value={s}>{s}</MenuItem>
//                 ))}
//               </TextField>
//               <Button
//                 size="small"
//                 variant="outlined"
//                 onClick={async () => {
//                   const res = await pickList(selected)
//                   setPick(res.data.lines)
//                 }}
//               >
//                 Pick list
//               </Button>
//               <Button
//                 size="small"
//                 variant="outlined"
//                 href={`/api/admin/gst/download?type=packing-slip&orderIds=${selected.join(',')}`}
//               >
//                 Bulk packing slips
//               </Button>
//             </Stack>
//           )}

//           <DataTable
//             columns={[
//               {
//                 id: 'sel',
//                 width: 48,
//                 label: (
//                   <Checkbox
//                     size="small"
//                     checked={allChecked}
//                     onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])}
//                     onClick={(ev) => ev.stopPropagation()}
//                   />
//                 ),
//                 render: (r) => (
//                   <Checkbox
//                     size="small"
//                     checked={selected.includes(r.id)}
//                     onClick={(e) => e.stopPropagation()}
//                     onChange={() => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))}
//                   />
//                 ),
//               },
//               { id: 'id', label: 'ID', render: (r) => r.orderNumber || r.id },
//               { id: 'date', label: 'Date', render: (r) => formatDateTime(r.createdAt) },
//               { id: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
//               { id: 'student', label: 'Student', render: (r) => r.studentName },
//               { id: 'adm', label: 'Admission no.', render: (r) => r.admissionNumber },
//               { id: 'house', label: 'House', render: (r) => r.houseColor },
//               { id: 'type', label: 'Type', render: (r) => <StatusBadge status={r.type} /> },
//               { id: 'phone', label: 'Phone/Email', render: (r) => r.phone || r.email || '—' },
//               { id: 'items', label: 'Items', render: (r) => r.itemCount },
//               { id: 'sub', label: 'Subtotal', render: (r) => formatINR(r.subtotal) },
//               { id: 'tax', label: 'Tax', render: (r) => formatINR(r.tax) },
//               { id: 'total', label: 'Total', render: (r) => formatINR(r.total) },
//               { id: 'pm', label: 'Payment method', render: (r) => r.paymentMethod },
//               { id: 'ps', label: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
//               { id: 'txn', label: 'Txn ID', render: (r) => r.txnId || '—' },
//             ]}
//             rows={items}
//             loading={loading}
//             error={error}
//             page={page}
//             pageSize={pageSize}
//             total={pagination.total}
//             onPageChange={setPage}
//             onPageSizeChange={setPageSize}
//             onRowClick={(r) => navigate(`/admin/orders/${r.id}`)}
//             emptyTitle="No orders"
//           />
//         </>
//       )}

//       {tab === 1 && (
//         <>
//           <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
//             <TextField placeholder="Search order / txn" value={payFilters.search} onChange={(e) => setPayFilters((f) => ({ ...f, search: e.target.value }))} fullWidth />
//             <TextField select label="Status" value={payFilters.status} onChange={(e) => setPayFilters((f) => ({ ...f, status: e.target.value }))} sx={{ minWidth: 160 }}>
//               <MenuItem value="">All</MenuItem>
//               {['initiated', 'pending', 'success', 'failed', 'refunded'].map((s) => (
//                 <MenuItem key={s} value={s}>{s}</MenuItem>
//               ))}
//             </TextField>
//           </Stack>
//           <DataTable
//             columns={[
//               { id: 'date', label: 'Date', render: (r) => formatDateTime(r.createdAt) },
//               { id: 'order', label: 'Order', render: (r) => (
//                 <Box component={RouterLink} to={`/admin/orders/${r.orderId}`}>{r.orderNumber}</Box>
//               ) },
//               { id: 'paytm', label: 'Paytm order id', render: (r) => r.paytmOrderId },
//               { id: 'txn', label: 'Txn id', render: (r) => r.txnId || '—' },
//               { id: 'bank', label: 'Bank txn id', render: (r) => r.bankTxnId || '—' },
//               { id: 'mode', label: 'Mode', render: (r) => r.paymentMode || '—' },
//               { id: 'amt', label: 'Amount', render: (r) => formatINR(r.amount) },
//               { id: 'st', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
//               { id: 'msg', label: 'Response', render: (r) => r.respMsg || '—' },
//             ]}
//             rows={payments.items}
//             loading={payments.loading}
//             error={payments.error}
//             page={payments.page}
//             pageSize={payments.pageSize}
//             total={payments.pagination.total}
//             onPageChange={payments.setPage}
//             onPageSizeChange={payments.setPageSize}
//             emptyTitle="No payment transactions"
//           />
//         </>
//       )}

//       <Dialog open={Boolean(pick)} onClose={() => setPick(null)} maxWidth="sm" fullWidth>
//         <DialogTitle>Pick list</DialogTitle>
//         <DialogContent>
//           {(pick || []).map((l) => (
//             <Stack key={l.sku + l.options} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
//               <Typography variant="body2">{l.sku} · {l.options || '—'} · {l.name}</Typography>
//               <Typography fontWeight={700}>×{l.quantity}</Typography>
//             </Stack>
//           ))}
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setPick(null)}>Close</Button>
//           <Button variant="contained" onClick={() => window.print()}>Print</Button>
//         </DialogActions>
//       </Dialog>
//     </>
//   )
// }
