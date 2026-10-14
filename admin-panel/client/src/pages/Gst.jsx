import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import GstSalesRegister from '../components/GstSalesRegister';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import StatCard from '../components/StatCard'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { useSnackbar } from '../context/SnackbarContext'
import { formatINR } from '../utils/format'
import api from '../api/client'

const RANGES = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['select', 'Select date'],
  ['last7', 'Last 7 Days'],
  ['last30', 'Last 30 Days'],
  ['this_month', 'This Month'],
  ['custom', 'Custom'],
]

export default function Gst() {
  const { showToast } = useSnackbar()
  const [tab, setTab] = useState(0)
  const [range, setRange] = useState('this_month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [docs, setDocs] = useState({ items: [], stats: {}, pagination: { total: 0 } })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [summary, setSummary] = useState(null)
  const [mapping, setMapping] = useState([])
  const [missingOnly, setMissingOnly] = useState(false)
  const [profile, setProfile] = useState({})
  const [schedule, setSchedule] = useState({ email: '', time: '08:00', reportDay: 'yesterday', timezone: 'Asia/Kolkata', smtpConfigured: false })
  const [bulkHsn, setBulkHsn] = useState('')
  const [bulkRate, setBulkRate] = useState(5)
  const [students, setStudents] = useState([])
  const [selectedStudents, setSelectedStudents] = useState([])

  async function loadDocs() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/gst/documents', {
        params: {
          range,
          from,
          to,
          page: 1,
          pageSize: 50,
          studentIds: selectedStudents.map((s) => s.id).join(','),
        },
      })
      setDocs(data.data)
      setSelected([])
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load documents', 'error')
    } finally {
      setLoading(false)
    }
  }

  const downloadDocument = async (type, orderIds = []) => {
  try {
    const params = {
      type,
    }

    if (orderIds.length > 0) {
      params.orderIds = orderIds.join(',')
    } else {
      params.range = range
      params.from = from
      params.to = to
      params.studentIds = selectedStudents
        .map((student) => student.id)
        .join(',')
    }

    const response = await api.get('/admin/gst/download', {
      params,
      responseType: 'blob',
    })

    const blob = new Blob([response.data], {
      type: 'application/pdf',
    })

    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url

    const kind =
      type === 'invoice' ? 'invoices' : 'packing-slips'

    link.download =
      orderIds.length === 1
        ? `${kind}-order-${orderIds[0]}.pdf`
        : `${kind}-${orderIds.length ? 'selected' : range}.pdf`

    document.body.appendChild(link)
    link.click()
    link.remove()

    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    showToast(
      'Unable to download documents',
      'error'
    )
  }
}

const downloadSelectedOrFiltered = async (type) => {
  await downloadDocument(type, selected)
}

  useEffect(() => {
    api.get('/admin/students', { params: { page: 1, pageSize: 200 } }).then((r) => {
      setStudents(r.data.data.items || [])
    }).catch(() => {})
  }, [])

 useEffect(() => {
  if (tab === 0) loadDocs()

  if (tab === 1) {
    api.get('/admin/gst/summary')
      .then((r) => setSummary(r.data.data))
      .catch(() => {})
  }


 if (tab === 2) {
  api.get('/admin/gst/email-schedule')
    .then((r) =>
      setSchedule((s) => ({ ...s, ...r.data.data }))
    )
    .catch(() => {})
}
}, [tab, range, from, to])

  const stats = docs.stats || {}

  return (
    <>
      
     <Box
  sx={{
    width: '100%',
    minWidth: 0,
    backgroundColor: 'transparent',
    border: 'none',
    boxShadow: 'none',
  }}
>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Reports" />
          <Tab label="GST" />
          <Tab label="Daily Email Report" />
        </Tabs>
       <Box sx={{ pt: 2, px: 0, pb: 2 }}>
          {tab === 0 && (
  <Stack spacing={2}>

    {/* RANGE LEFT - DOWNLOAD BUTTONS RIGHT */}
    <Box
      sx={{
        display: 'flex',
        flexDirection: {
          xs: 'column',
          md: 'row',
        },
        alignItems: {
          xs: 'stretch',
          md: 'center',
        },
        justifyContent: 'space-between',
        gap: 2,
        width: '100%',
      }}
    >

      {/* LEFT SIDE - RANGE */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          flexShrink: 0,
          alignItems: {
            xs: 'stretch',
            sm: 'center',
          },
        }}
      >
        <TextField
          select
          size="small"
          label="Range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          sx={{
            width: {
              xs: '100%',
              sm: 210,
            },
          }}
        >
          {RANGES.map(([v, l]) => (
            <MenuItem key={v} value={v}>
              {l}
            </MenuItem>
          ))}
        </TextField>

        {(range === 'custom' || range === 'select') && (
          <>
            <TextField
              size="small"
              type="date"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />

            <TextField
              size="small"
              type="date"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
      </Stack>

      {/* RIGHT SIDE - DOWNLOAD BUTTONS */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          marginLeft: {
            xs: 0,
            md: 'auto',
          },
          justifyContent: {
            xs: 'flex-start',
            md: 'flex-end',
          },
          flexShrink: 0,
        }}
      >
        <Button
          variant="contained"
          startIcon={<DownloadRoundedIcon />}
          onClick={() =>
            downloadSelectedOrFiltered('invoice')
          }
          disabled={
            loading ||
            (!selected.length && !docs.pagination?.total)
          }
          sx={{
            whiteSpace: 'nowrap',
            textTransform: 'none',
          }}
        >
          Download invoices
        </Button>

        <Button
          variant="outlined"
          startIcon={<DownloadRoundedIcon />}
          onClick={() =>
            downloadSelectedOrFiltered('packing-slip')
          }
          disabled={
            loading ||
            (!selected.length && !docs.pagination?.total)
          }
          sx={{
            whiteSpace: 'nowrap',
            textTransform: 'none',
          }}
        >
          Download packing slips
        </Button>
      </Stack>

    </Box>

{selected.length > 0 && (
  <Alert
    severity="info"
    onClose={() => setSelected([])}
  >
    {selected.length} order(s) selected.
    Downloads will include only selected orders.
  </Alert>
)}
              {/* <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                <TextField select label="Range" value={range} onChange={(e) => setRange(e.target.value)} sx={{ minWidth: 180 }}>
                  {RANGES.map(([v, l]) => (
                    <MenuItem key={v} value={v}>{l}</MenuItem>
                  ))}
                </TextField>
                {(range === 'custom' || range === 'select') && (
                  <>
                    <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
                    <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
                  </>
                )}
                <Autocomplete
                  multiple
                  options={students}
                  getOptionLabel={(s) => `${s.admissionNumber} ${s.studentName}`}
                  value={selectedStudents}
                  onChange={(_, v) => setSelectedStudents(v)}
                  sx={{ minWidth: 280, flex: 1 }}
                  renderInput={(params) => <TextField {...params} label="Students" />}
                />
              </Stack> */}
              {loading ? <LoadingSkeleton rows={4} /> : (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Total sales" value={formatINR(stats.totalSales)} /></Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Collected" value={formatINR(stats.collected)} /></Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Refunded" value={formatINR(stats.refunded)} /></Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Taxable subtotal" value={formatINR(stats.taxableSubtotal)} /></Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Total GST" value={formatINR(stats.totalGst)} /></Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Net sales" value={formatINR(stats.netSales)} /></Grid>
                </Grid>
              )}
              {/* {selected.length > 0 && (
                <Stack direction="row" spacing={1}>
                  <Button size="small" href={`/api/admin/gst/download?type=invoice&orderIds=${selected.join(',')}`}>Bulk invoices</Button>
                  <Button size="small" href={`/api/admin/gst/download?type=packing-slip&orderIds=${selected.join(',')}`}>Bulk packing slips</Button>
                </Stack>
              )} */}
              <DataTable
                columns={[
                  {
                    id: 'sel',
                    width: 48,
                    label: (
                      <Checkbox
                        size="small"
                        checked={docs.items?.length > 0 && selected.length === docs.items.length}
                        onChange={(e) => setSelected(e.target.checked ? docs.items.map((i) => i.id) : [])}
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
                  {
  id: 'order',
  label: 'Order',
  render: (r) => r.order_number || '—',
},
{
  id: 'invoiceNumber',
  label: 'Invoice #',
  render: (r) => r.invoice_number || '—',
},
{
  id: 'packingSlip',
  label: 'Packing Slip #',
  render: (r) => r.packing_slip_number || '—',
},
{
  id: 'student',
  label: 'Student',
  render: (r) =>
    `${r.student_name || ''} (${r.admission_number || ''})`,
},
{
  id: 'total',
  label: 'Total',
  render: (r) => formatINR(r.total),
},
{
  id: 'gst',
  label: 'GST',
  render: (r) =>
    formatINR(
      Number(r.cgst_total || 0) +
      Number(r.sgst_total || 0) +
      Number(r.igst_total || 0)
    ),
},
{
  id: 'shipping',
  label: 'Shipping',
  render: (r) => formatINR(r.shipping),
},
{
  id: 'orderDate',
  label: 'Order Date',
  render: (r) =>
    r.created_at
      ? new Date(r.created_at).toLocaleDateString('en-IN')
      : '—',
},
{
  id: 'invoiceDownload',
  label: 'Invoice',
  render: (r) => (
    <Button
      size="small"
      onClick={(e) => {
        e.stopPropagation()
        downloadDocument('invoice', [r.id])
      }}
    >
      Invoice
    </Button>
  ),
},
{
  id: 'slipDownload',
  label: 'Slip',
  render: (r) => (
    <Button
      size="small"
      onClick={(e) => {
        e.stopPropagation()
        downloadDocument('packing-slip', [r.id])
      }}
    >
      Slip
    </Button>
  ),
},
                ]}
                rows={docs.items || []}
                loading={loading}
                emptyTitle="No documents in this range"
              />
            </Stack>
          )}

          {tab === 1 && <GstSalesRegister />}

          {tab === 2&& (
            <Stack spacing={2} maxWidth={640}>
              <Alert severity={schedule.smtpConfigured ? 'success' : 'warning'}>
                SMTP {schedule.smtpConfigured ? 'configured' : 'not configured — set it in Settings → Email'}
              </Alert>
              <TextField label="Admin email" fullWidth value={schedule.email || ''} onChange={(e) => setSchedule((s) => ({ ...s, email: e.target.value }))} />
              <TextField label="Send time (HH:mm)" fullWidth value={schedule.time || '08:00'} onChange={(e) => setSchedule((s) => ({ ...s, time: e.target.value }))} />
              <TextField select label="Report day" fullWidth value={schedule.reportDay || 'yesterday'} onChange={(e) => setSchedule((s) => ({ ...s, reportDay: e.target.value }))}>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="today">Today</MenuItem>
              </TextField>
              <TextField label="Timezone" fullWidth value={schedule.timezone || 'Asia/Kolkata'} onChange={(e) => setSchedule((s) => ({ ...s, timezone: e.target.value }))} />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={async () => {
                    await api.put('/admin/gst/email-schedule', {
                      gst_email_to: schedule.email,
                      gst_email_time: schedule.time,
                      gst_email_report_day: schedule.reportDay,
                      gst_email_timezone: schedule.timezone,
                    })
                    showToast('Schedule saved', 'success')
                  }}
                >
                  Save schedule
                </Button>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    try {
                      await api.post('/admin/gst/send-test-email', { to: schedule.email })
                      showToast('Test email sent', 'success')
                    } catch (err) {
                      showToast(err.response?.data?.message || 'Send failed', 'error')
                    }
                  }}
                >
                  Send test email
                </Button>
              </Stack>
            </Stack>
          )}
       </Box>
</Box>
    </>
  )
}







// import { useEffect, useState } from 'react'
// import {
//   Alert,
//   Autocomplete,
//   Box,
//   Button,
//   Card,
//   CardContent,
//   Checkbox,
//   Grid,
//   MenuItem,
//   Stack,
//   Tab,
//   Tabs,
//   TextField,
//   Typography,
// } from '@mui/material'
// import {
//   Area,
//   AreaChart,
//   CartesianGrid,
//   ResponsiveContainer,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from 'recharts'
// import PageHeader from '../components/PageHeader'
// import DataTable from '../components/DataTable'
// import StatCard from '../components/StatCard'
// import LoadingSkeleton from '../components/LoadingSkeleton'
// import { useSnackbar } from '../context/SnackbarContext'
// import { formatINR } from '../utils/format'
// import api from '../api/client'

// const RANGES = [
//   ['today', 'Today'],
//   ['yesterday', 'Yesterday'],
//   ['select', 'Select date'],
//   ['last7', 'Last 7 Days'],
//   ['last30', 'Last 30 Days'],
//   ['this_month', 'This Month'],
//   ['custom', 'Custom'],
// ]

// export default function Gst() {
//   const { showToast } = useSnackbar()
//   const [tab, setTab] = useState(0)
//   const [range, setRange] = useState('this_month')
//   const [from, setFrom] = useState('')
//   const [to, setTo] = useState('')
//   const [docs, setDocs] = useState({ items: [], stats: {}, pagination: { total: 0 } })
//   const [loading, setLoading] = useState(true)
//   const [selected, setSelected] = useState([])
//   const [summary, setSummary] = useState(null)
//   const [mapping, setMapping] = useState([])
//   const [missingOnly, setMissingOnly] = useState(false)
//   const [profile, setProfile] = useState({})
//   const [schedule, setSchedule] = useState({ email: '', time: '08:00', reportDay: 'yesterday', timezone: 'Asia/Kolkata', smtpConfigured: false })
//   const [bulkHsn, setBulkHsn] = useState('')
//   const [bulkRate, setBulkRate] = useState(5)
//   const [students, setStudents] = useState([])
//   const [selectedStudents, setSelectedStudents] = useState([])

//   async function loadDocs() {
//     setLoading(true)
//     try {
//       const { data } = await api.get('/admin/gst/documents', {
//         params: {
//           range,
//           from,
//           to,
//           page: 1,
//           pageSize: 50,
//           studentIds: selectedStudents.map((s) => s.id).join(','),
//         },
//       })
//       setDocs(data.data)
//       setSelected([])
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Failed to load documents', 'error')
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     api.get('/admin/students', { params: { page: 1, pageSize: 200 } }).then((r) => {
//       setStudents(r.data.data.items || [])
//     }).catch(() => {})
//   }, [])

//   useEffect(() => {
//     if (tab === 0) loadDocs()
//     if (tab === 1) {
//       api.get('/admin/gst/summary').then((r) => setSummary(r.data.data)).catch(() => {})
//     }
//     if (tab === 2) {
//       api.get('/admin/gst/tax-mapping', { params: { missing: missingOnly } }).then((r) => setMapping(r.data.data.items)).catch(() => {})
//     }
//     if (tab === 3) {
//       api.get('/admin/gst/profile').then((r) => setProfile(r.data.data.profile || {})).catch(() => {})
//     }
//     if (tab === 4) {
//       api.get('/admin/gst/email-schedule').then((r) => setSchedule((s) => ({ ...s, ...r.data.data }))).catch(() => {})
//     }
//   }, [tab, range, from, to, missingOnly, selectedStudents])

//   const stats = docs.stats || {}

//   return (
//     <>
//       <PageHeader title="GST" subtitle="Invoices, tax mapping, and daily reports." />
//       <Card variant="outlined">
//         <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
//           <Tab label="Invoices & Documents" />
//           <Tab label="GST Summary" />
//           <Tab label="Product Tax Mapping" />
//           <Tab label="Business Details" />
//           <Tab label="Daily Email Report" />
//         </Tabs>
//         <CardContent>
//           {tab === 0 && (
//             <Stack spacing={2}>
//               <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
//                 <TextField select label="Range" value={range} onChange={(e) => setRange(e.target.value)} sx={{ minWidth: 180 }}>
//                   {RANGES.map(([v, l]) => (
//                     <MenuItem key={v} value={v}>{l}</MenuItem>
//                   ))}
//                 </TextField>
//                 {(range === 'custom' || range === 'select') && (
//                   <>
//                     <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
//                     <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
//                   </>
//                 )}
//                 <Autocomplete
//                   multiple
//                   options={students}
//                   getOptionLabel={(s) => `${s.admissionNumber} ${s.studentName}`}
//                   value={selectedStudents}
//                   onChange={(_, v) => setSelectedStudents(v)}
//                   sx={{ minWidth: 280, flex: 1 }}
//                   renderInput={(params) => <TextField {...params} label="Students" />}
//                 />
//               </Stack>
//               {loading ? <LoadingSkeleton rows={4} /> : (
//                 <Grid container spacing={2}>
//                   <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Total sales" value={formatINR(stats.totalSales)} /></Grid>
//                   <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Collected" value={formatINR(stats.collected)} /></Grid>
//                   <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Refunded" value={formatINR(stats.refunded)} /></Grid>
//                   <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Taxable subtotal" value={formatINR(stats.taxableSubtotal)} /></Grid>
//                   <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Total GST" value={formatINR(stats.totalGst)} /></Grid>
//                   <Grid size={{ xs: 12, sm: 6, md: 2 }}><StatCard title="Net sales" value={formatINR(stats.netSales)} /></Grid>
//                 </Grid>
//               )}
//               {selected.length > 0 && (
//                 <Stack direction="row" spacing={1}>
//                   <Button size="small" href={`/api/admin/gst/download?type=invoice&orderIds=${selected.join(',')}`}>Bulk invoices</Button>
//                   <Button size="small" href={`/api/admin/gst/download?type=packing-slip&orderIds=${selected.join(',')}`}>Bulk packing slips</Button>
//                 </Stack>
//               )}
//               <DataTable
//                 columns={[
//                   {
//                     id: 'sel',
//                     width: 48,
//                     label: (
//                       <Checkbox
//                         size="small"
//                         checked={docs.items?.length > 0 && selected.length === docs.items.length}
//                         onChange={(e) => setSelected(e.target.checked ? docs.items.map((i) => i.id) : [])}
//                         onClick={(ev) => ev.stopPropagation()}
//                       />
//                     ),
//                     render: (r) => (
//                       <Checkbox
//                         size="small"
//                         checked={selected.includes(r.id)}
//                         onClick={(e) => e.stopPropagation()}
//                         onChange={() => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))}
//                       />
//                     ),
//                   },
//                   { id: 'invoice', label: 'Invoice', render: (r) => r.invoice_number || '—' },
//                   { id: 'order', label: 'Order', render: (r) => r.order_number },
//                   { id: 'student', label: 'Student', render: (r) => `${r.student_name} (${r.admission_number})` },
//                   { id: 'total', label: 'Total', render: (r) => formatINR(r.total) },
//                   { id: 'gst', label: 'GST', render: (r) => formatINR(Number(r.cgst_total || 0) + Number(r.sgst_total || 0) + Number(r.igst_total || 0)) },
//                   {
//                     id: 'dl',
//                     label: '',
//                     align: 'right',
//                     render: (r) => (
//                       <Stack direction="row" spacing={0.5} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
//                         <Button size="small" href={`/api/admin/gst/download?type=invoice&orderIds=${r.id}`}>Invoice</Button>
//                         <Button size="small" href={`/api/admin/gst/download?type=packing-slip&orderIds=${r.id}`}>Slip</Button>
//                       </Stack>
//                     ),
//                   },
//                 ]}
//                 rows={docs.items || []}
//                 loading={loading}
//                 emptyTitle="No documents in this range"
//               />
//             </Stack>
//           )}

//           {tab === 1 && (
//             <Stack spacing={2}>
//               <Button href="/api/admin/gst/export" variant="outlined" sx={{ alignSelf: 'flex-start' }}>Export Excel</Button>
//               <Box sx={{ height: 280 }}>
//                 <ResponsiveContainer>
//                   <AreaChart data={summary?.monthly || []}>
//                     <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
//                     <XAxis dataKey="month" tick={{ fontSize: 11 }} />
//                     <YAxis tick={{ fontSize: 11 }} />
//                     <Tooltip />
//                     <Area type="monotone" dataKey="gst" stroke="#4f46e5" fill="#eef2ff" />
//                   </AreaChart>
//                 </ResponsiveContainer>
//               </Box>
//               <Typography fontWeight={700}>Rate-wise</Typography>
//               <DataTable
//                 columns={[
//                   { id: 'gst_rate', label: 'Rate', render: (r) => `${r.gst_rate}%` },
//                   { id: 'taxable', label: 'Taxable', render: (r) => formatINR(r.taxable) },
//                   { id: 'cgst', label: 'CGST', render: (r) => formatINR(r.cgst) },
//                   { id: 'sgst', label: 'SGST', render: (r) => formatINR(r.sgst) },
//                   { id: 'igst', label: 'IGST', render: (r) => formatINR(r.igst) },
//                 ]}
//                 rows={summary?.rateWise || []}
//                 emptyTitle="No GST data"
//               />
//               <Typography fontWeight={700}>HSN-wise</Typography>
//               <DataTable
//                 columns={[
//                   { id: 'hsn_code', label: 'HSN', render: (r) => r.hsn_code || '—' },
//                   { id: 'qty', label: 'Qty', render: (r) => r.qty },
//                   { id: 'taxable', label: 'Taxable', render: (r) => formatINR(r.taxable) },
//                 ]}
//                 rows={summary?.hsnWise || []}
//                 emptyTitle="No HSN data"
//               />
//             </Stack>
//           )}

//           {tab === 2 && (
//             <Stack spacing={2}>
//               <Stack direction="row" spacing={1} alignItems="center">
//                 <Button variant={missingOnly ? 'contained' : 'outlined'} onClick={() => setMissingOnly((v) => !v)}>Missing HSN/GST</Button>
//                 <TextField size="small" label="HSN" value={bulkHsn} onChange={(e) => setBulkHsn(e.target.value)} />
//                 <TextField size="small" select label="GST" value={bulkRate} onChange={(e) => setBulkRate(Number(e.target.value))} sx={{ width: 100 }}>
//                   {[0, 5, 12, 18, 28].map((r) => <MenuItem key={r} value={r}>{r}%</MenuItem>)}
//                 </TextField>
//                 <Button
//                   variant="contained"
//                   onClick={async () => {
//                     await api.post('/admin/gst/tax-mapping/bulk', { ids: mapping.map((m) => m.id), hsnCode: bulkHsn, gstRate: bulkRate })
//                     showToast('Bulk assigned', 'success')
//                     setTab(2)
//                     const r = await api.get('/admin/gst/tax-mapping', { params: { missing: missingOnly } })
//                     setMapping(r.data.data.items)
//                   }}
//                 >
//                   Bulk assign all listed
//                 </Button>
//               </Stack>
//               <DataTable
//                 columns={[
//                   { id: 'name', label: 'Product', render: (r) => r.name },
//                   { id: 'cat', label: 'Category', render: (r) => r.categoryName },
//                   {
//                     id: 'hsn',
//                     label: 'HSN',
//                     render: (r) => (
//                       <TextField
//                         size="small"
//                         defaultValue={r.hsnCode || ''}
//                         onBlur={async (e) => {
//                           await api.patch(`/admin/gst/tax-mapping/${r.id}`, { hsnCode: e.target.value })
//                         }}
//                       />
//                     ),
//                   },
//                   {
//                     id: 'gst',
//                     label: 'GST %',
//                     render: (r) => (
//                       <TextField
//                         select
//                         size="small"
//                         defaultValue={r.gstRate}
//                         onChange={async (e) => {
//                           await api.patch(`/admin/gst/tax-mapping/${r.id}`, { gstRate: Number(e.target.value) })
//                         }}
//                         sx={{ width: 90 }}
//                       >
//                         {[0, 5, 12, 18, 28].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
//                       </TextField>
//                     ),
//                   },
//                 ]}
//                 rows={mapping}
//                 emptyTitle="No products"
//               />
//             </Stack>
//           )}

//           {tab === 3 && (
//             <Stack spacing={2} maxWidth={640}>
//               <TextField label="Legal name" fullWidth value={profile.legal_name || ''} onChange={(e) => setProfile((p) => ({ ...p, legal_name: e.target.value }))} />
//               <TextField label="GSTIN" fullWidth value={profile.gstin || ''} onChange={(e) => setProfile((p) => ({ ...p, gstin: e.target.value }))} helperText="15-character GSTIN" />
//               <TextField label="Address" fullWidth value={profile.address || ''} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
//               <TextField label="City" fullWidth value={profile.city || ''} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} />
//               <TextField label="State" fullWidth value={profile.state || ''} onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))} />
//               <TextField label="State code" fullWidth value={profile.state_code || ''} onChange={(e) => setProfile((p) => ({ ...p, state_code: e.target.value }))} />
//               <TextField label="Pincode" fullWidth value={profile.pincode || ''} onChange={(e) => setProfile((p) => ({ ...p, pincode: e.target.value }))} />
//               <TextField label="Email" fullWidth value={profile.email || ''} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
//               <TextField label="Phone" fullWidth value={profile.phone || ''} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
//               <Button
//                 variant="contained"
//                 onClick={async () => {
//                   try {
//                     const { data } = await api.put('/admin/gst/profile', profile)
//                     setProfile(data.data.profile)
//                     showToast('Profile saved', 'success')
//                   } catch (err) {
//                     showToast(err.response?.data?.message || 'Save failed', 'error')
//                   }
//                 }}
//               >
//                 Save business details
//               </Button>
//             </Stack>
//           )}

//           {tab === 4 && (
//             <Stack spacing={2} maxWidth={640}>
//               <Alert severity={schedule.smtpConfigured ? 'success' : 'warning'}>
//                 SMTP {schedule.smtpConfigured ? 'configured' : 'not configured — set it in Settings → Email'}
//               </Alert>
//               <TextField label="Admin email" fullWidth value={schedule.email || ''} onChange={(e) => setSchedule((s) => ({ ...s, email: e.target.value }))} />
//               <TextField label="Send time (HH:mm)" fullWidth value={schedule.time || '08:00'} onChange={(e) => setSchedule((s) => ({ ...s, time: e.target.value }))} />
//               <TextField select label="Report day" fullWidth value={schedule.reportDay || 'yesterday'} onChange={(e) => setSchedule((s) => ({ ...s, reportDay: e.target.value }))}>
//                 <MenuItem value="yesterday">Yesterday</MenuItem>
//                 <MenuItem value="today">Today</MenuItem>
//               </TextField>
//               <TextField label="Timezone" fullWidth value={schedule.timezone || 'Asia/Kolkata'} onChange={(e) => setSchedule((s) => ({ ...s, timezone: e.target.value }))} />
//               <Stack direction="row" spacing={1}>
//                 <Button
//                   variant="contained"
//                   onClick={async () => {
//                     await api.put('/admin/gst/email-schedule', {
//                       gst_email_to: schedule.email,
//                       gst_email_time: schedule.time,
//                       gst_email_report_day: schedule.reportDay,
//                       gst_email_timezone: schedule.timezone,
//                     })
//                     showToast('Schedule saved', 'success')
//                   }}
//                 >
//                   Save schedule
//                 </Button>
//                 <Button
//                   variant="outlined"
//                   onClick={async () => {
//                     try {
//                       await api.post('/admin/gst/send-test-email', { to: schedule.email })
//                       showToast('Test email sent', 'success')
//                     } catch (err) {
//                       showToast(err.response?.data?.message || 'Send failed', 'error')
//                     }
//                   }}
//                 >
//                   Send test email
//                 </Button>
//               </Stack>
//             </Stack>
//           )}
//         </CardContent>
//       </Card>
//     </>
//   )
// }
