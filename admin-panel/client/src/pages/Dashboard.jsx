import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Link,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { CardGridSkeleton } from '../components/LoadingSkeleton'
import StatusBadge from '../components/StatusBadge'
import { useSnackbar } from '../context/SnackbarContext'
import { formatDateTime, formatINR } from '../utils/format'
import api from '../api/client'

const INDIGO = '#4f46e5'
const STATUS_COLORS = ['#4f46e5', '#4338ca', '#6366f1', '#818cf8', '#059669', '#dc2626', '#d97706']

export default function Dashboard() {
  const { showToast } = useSnackbar()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/admin/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to load dashboard'
        setError(msg)
        showToast(msg, 'error')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Overview of sales, stock, and students." />
        <CardGridSkeleton count={8} />
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Overview of sales, stock, and students." />
        <EmptyState title="Could not load dashboard" description={error || 'No data'} />
      </>
    )
  }

  const c = data.cards
  const kpis = [
    ['Total revenue', formatINR(c.totalRevenue)],
    ["Today's sales", formatINR(c.todaySales)],
    ['Total orders', c.totalOrders],
    ['Students', c.totalStudents],
    ['Products', c.products],
    ['Stock alerts', c.stockAlerts],
    ['Kit / Individual', `${c.kitOrders} / ${c.individualOrders}`],
    ['GST this month', formatINR(c.gstThisMonth)],
    ['Online payments', formatINR(c.onlinePayments)],
  ]

  // const statuses = Object.entries(data.statusCounts || {})
  const orderStatusNames = [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
]

const statuses = orderStatusNames.map((status) => [
  status,
  Number(data.statusCounts?.[status] || 0),
])

const paymentCounts = {
  paid: Number(data.paymentCounts?.paid || 0),
  pending: Number(data.paymentCounts?.pending || 0),
}

  return (
    <>
      {/* <PageHeader title="Dashboard" subtitle="Overview of sales, stock, and students." /> */}

      {/* <Grid container spacing={2} sx={{ mb: 2 }}>
        {kpis.map(([title, value]) => (
          <Grid key={title} size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
            <StatCard title={title} value={value} />
          </Grid>
        ))}
      </Grid> */}
      <Box
  sx={{
    display: 'grid',
    gridTemplateColumns: {
      xs: '1fr',
      sm: 'repeat(2, minmax(0, 1fr))',
      md: 'repeat(3, minmax(0, 1fr))',
      lg: 'repeat(5, minmax(0, 1fr))',
    },
    gap: 2,
    mb: 2,
  }}
>
  {kpis.map(([title, value]) => (
    <Box key={title} sx={{ minWidth: 0 }}>
      <StatCard title={title} value={value} />
    </Box>
  ))}
</Box>

      {/* <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase' }}>
        Order status
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statuses.map(([status, count]) => (
          <Grid key={status} size={{ xs: 6, sm: 4, md: 3, lg: 'auto' }}>
            <Card variant="outlined" sx={{ minWidth: 120 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <StatusBadge status={status} />
                <Typography variant="h6" sx={{ mt: 1 }}>{count}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid> */}
      
<Typography
  variant="subtitle2"
  color="text.secondary"
  sx={{
    mb: 1,
    textTransform: 'uppercase',
  }}
>
  Order status
</Typography>

<Box
  sx={{
    display: 'grid',
    gridTemplateColumns: {
      xs: 'repeat(2, minmax(0, 1fr))',
      sm: 'repeat(3, minmax(0, 1fr))',
      md: 'repeat(4, minmax(0, 1fr))',
      lg: 'repeat(9, minmax(0, 1fr))',
    },
    gap: 2,
    mb: 3,
  }}
>
  {/* Existing order statuses - unchanged */}
  {statuses.map(([status, count]) => (
    <Card
      key={status}
      variant="outlined"
      sx={{
        minWidth: 0,
        borderRadius: 2,
      }}
    >
      <CardContent
        sx={{
          px: 1.5,
          py: 1.5,
          '&:last-child': {
            pb: 1.5,
          },
        }}
      >
        <StatusBadge status={status} />

        <Typography
          variant="h6"
          sx={{
            mt: 1,
            fontWeight: 700,
          }}
        >
          {count}
        </Typography>
      </CardContent>
    </Card>
  ))}

  {/* Paid - successful payments */}
  <Card
    variant="outlined"
    sx={{
      minWidth: 0,
      borderRadius: 2,
    }}
  >
    <CardContent
      sx={{
        px: 1.5,
        py: 1.5,
        '&:last-child': {
          pb: 1.5,
        },
      }}
    >
      <Box
        sx={{
          display: 'inline-block',
          bgcolor: '#059669',
          color: '#fff',
          px: 1.2,
          py: 0.4,
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Paid
      </Box>

      <Typography
        variant="h6"
        sx={{
          mt: 1,
          fontWeight: 700,
        }}
      >
        {paymentCounts.paid}
      </Typography>
    </CardContent>
  </Card>

  {/* Pending - payment not completed */}
  <Card
    variant="outlined"
    sx={{
      minWidth: 0,
      borderRadius: 2,
    }}
  >
    <CardContent
      sx={{
        px: 1.5,
        py: 1.5,
        '&:last-child': {
          pb: 1.5,
        },
      }}
    >
      <Box
        sx={{
          display: 'inline-block',
          bgcolor: '#f59e0b',
          color: '#fff',
          px: 1.2,
          py: 0.4,
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Pending
      </Box>

      <Typography
        variant="h6"
        sx={{
          mt: 1,
          fontWeight: 700,
        }}
      >
        {paymentCounts.pending}
      </Typography>
    </CardContent>
  </Card>
</Box>


      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card variant="outlined" sx={{ p: 2, height: 320 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>Revenue (12 months)</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={data.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke={INDIGO} fill="#eef2ff" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card variant="outlined" sx={{ p: 2, height: 320 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>Orders by status</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie data={data.ordersByStatus.filter((d) => d.value > 0)} dataKey="value" nameKey="name" outerRadius={90} label>
                  {data.ordersByStatus.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card variant="outlined" sx={{ p: 2, height: 300 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>Daily sales (30 days)</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={data.ordersPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="sales" stroke={INDIGO} fill="#eef2ff" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card variant="outlined" sx={{ p: 2, height: 300 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>Top-selling products</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={data.topProducts} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="qty" fill={INDIGO} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={600} sx={{ mb: 1 }}>Recent orders</Typography>
              <List dense>
                {/* {data.recentOrders.map((o) => ( */}
                {(data.recentOrders || []).slice(0, 5).map((o) => (
                  <ListItem key={o.id} disableGutters>
                    <ListItemText
                      primary={<Link component={RouterLink} to={`/admin/orders/${o.id}`} underline="hover">{o.order_number}</Link>}
                      secondary={`${o.student_name} · ${formatINR(o.total)}`}
                    />
                    {/* <StatusBadge status={o.status} /> */}
                    <Box
  sx={{
    bgcolor:
      o.payment_status === 'paid'
        ? '#059669'
        : '#f59e0b',
    color: '#fff',
    borderRadius: 5,
    px: 1.2,
    py: 0.4,
    fontSize: 12,
    fontWeight: 700,
  }}
>
  {o.payment_status === 'paid'
    ? 'Paid'
    : 'Pending'}
</Box>
                  </ListItem>
                ))}
                {!data.recentOrders.length && <Typography variant="body2" color="text.secondary">No orders yet</Typography>}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={600} sx={{ mb: 1 }}>Low stock</Typography>
              <List dense>
                {data.lowStockList.map((v) => (
                  <ListItem key={v.sku} disableGutters>
                    <ListItemText primary={v.product_name} secondary={v.sku} />
                    <Typography color="warning.main" fontWeight={700}>{v.stock_qty}</Typography>
                  </ListItem>
                ))}
                {!data.lowStockList.length && <Typography variant="body2" color="text.secondary">All good</Typography>}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={600} sx={{ mb: 1 }}>Recent logins</Typography>
              <List dense>
                {data.recentLogins.map((s) => (
                  <ListItem key={s.id} disableGutters>
                    <ListItemText
                      primary={`${s.student_name} (${s.admission_number})`}
                      secondary={`${s.house_color} · ${formatDateTime(s.last_login_at)}`}
                    />
                  </ListItem>
                ))}
                {!data.recentLogins.length && <Typography variant="body2" color="text.secondary">No logins yet</Typography>}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}
