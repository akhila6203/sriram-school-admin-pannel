import { useEffect, useState } from 'react'
// import { Link as RouterLink, useParams } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import {
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { useSnackbar } from '../context/SnackbarContext'
import { formatDateTime, formatINR } from '../utils/format'
import { getOrder, updateOrderStatus } from '../api/admin'
import api from '../api/client'

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']

export default function OrderDetail() {
  const { id } = useParams()
  const { showToast } = useSnackbar()
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('confirmed')
  const [note, setNote] = useState('')
  const [tracking, setTracking] = useState({ trackingNumber: '', courier: '', trackingUrl: '' })
  const [refund, setRefund] = useState({ amount: '', reason: '' })
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await getOrder(id)
      setData(res.data)
      setStatus(res.data.order.status)
      setTracking({
        trackingNumber: res.data.order.trackingNumber || '',
        courier: res.data.order.courier || '',
        trackingUrl: res.data.order.trackingUrl || '',
      })
      setRefund({ amount: String(res.data.order.total || ''), reason: '' })
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  if (loading || !data) {
    return (
      <>
        <PageHeader title="Order" breadcrumbs={[{ label: 'Orders', to: '/admin/orders' }]} />
        <LoadingSkeleton rows={8} />
      </>
    )
  }

  const { order, items, history, payment } = data
  const addr = order.addressSnapshot || {}
  const isPaytmPaid = order.paymentMethod === 'paytm' && ['paid', 'partially_refunded'].includes(order.paymentStatus)

  return (
    <>
    <PageHeader
  title={order.orderNumber}
  subtitle={`${order.studentName} · ${order.admissionNumber}`}
  breadcrumbs={[
    { label: 'Orders', to: '/admin/orders' },
    { label: order.orderNumber },
  ]}
/>
      {/* <PageHeader
        title={order.orderNumber}
        subtitle={`${order.studentName} · ${order.admissionNumber}`}
        breadcrumbs={[{ label: 'Orders', to: '/admin/orders' }, { label: order.orderNumber }]}
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              href={`/api/admin/gst/download?type=invoice&orderIds=${order.id}`}
            >
              Download GST invoice
            </Button>
            <Button
              variant="outlined"
              href={`/api/admin/gst/download?type=packing-slip&orderIds=${order.id}`}
            >
              Download packing slip
            </Button>
            <Button component={RouterLink} to="/admin/orders" variant="outlined">Back</Button>
          </Stack>
        }
      /> */}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Summary</Typography>
              <Stack spacing={0.5}>
                <Typography>Status: <StatusBadge status={order.status} /></Typography>

                <Typography>Type: <StatusBadge status={order.type} /></Typography>
                <Typography>Subtotal: {formatINR(order.subtotal)}</Typography>
                <Typography>Tax: {formatINR(order.tax)}</Typography>
                <Typography>Shipping: {formatINR(order.shipping)}</Typography>
                <Typography fontWeight={700}>Total: {formatINR(order.total)}</Typography>
                {order.invoiceNumber && <Typography>Invoice: {order.invoiceNumber}</Typography>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Billing / Shipping</Typography>
              <Typography>{order.studentName} ({order.admissionNumber}) · {order.houseColor}</Typography>
              <Typography>{addr.parentName}</Typography>
              <Typography>{addr.address1}</Typography>
              <Typography>{addr.address2}</Typography>
              <Typography>{addr.city}, {addr.state} {addr.zipcode}</Typography>
              <Typography>{addr.phone || data.studentPhone || '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Line items</Typography>
              <Stack spacing={1}>
                {items.map((i) => (
                  <Stack key={i.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                    <Typography variant="body2">
                      {i.nameSnapshot} · {i.skuSnapshot} · HSN {i.hsnCode || '—'} · {i.optionSnapshot || '—'}
                    </Typography>
                    <Typography variant="body2">
                      ×{i.quantity} · {formatINR(i.unitPrice)} · GST {i.gstRate ?? '—'}% · {formatINR(i.lineTotal)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Payment</Typography>
              <Typography>Method: {order.paymentMethod}</Typography>
              <Typography>Status: <StatusBadge status={order.paymentStatus} /></Typography>
<Typography sx={{ mt: 1 }}>
  Payment Status:{' '}
  <StatusBadge
    status={
      ['paid', 'partially_refunded', 'refunded'].includes(
        order.paymentStatus
      )
        ? 'success'
        : 'pending'
    }
  />
</Typography>
              {/* {payment && (
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  <Typography variant="body2">Paytm order: {payment.paytmOrderId}</Typography>
                  <Typography variant="body2">Txn: {payment.txnId || '—'}</Typography>
                  <Typography variant="body2">Bank txn: {payment.bankTxnId || '—'}</Typography>
                  <Typography variant="body2">{payment.respMsg}</Typography>
                </Stack>
              )} */}
              {payment && (
  <Stack spacing={0.5} sx={{ mt: 1 }}>
    <Typography variant="body2">
      Paytm order: {payment.paytmOrderId || '—'}
    </Typography>

    <Typography variant="body2">
      Txn: {payment.txnId || 'Awaiting confirmation'}
    </Typography>

    <Typography variant="body2">
      Bank txn: {payment.bankTxnId || '—'}
    </Typography>

    <Typography variant="body2">
      {payment.respMsg || 'No gateway response yet'}
    </Typography>
  </Stack>
)}

{order.paymentStatus === 'pending' && (
  <Typography
    variant="body2"
    sx={{ mt: 1, color: 'warning.main' }}
  >
    Payment confirmation is pending. Verify with Paytm
    before marking this order as paid.
  </Typography>
)}
              <Stack
  direction="row"
  spacing={1}
  sx={{ mt: 2 }}
  flexWrap="wrap"
  useFlexGap
>
  <Button
    size="small"
    variant="outlined"
    disabled={
      order.paymentMethod !== 'paytm' ||
      order.paymentStatus !== 'pending'
    }
    onClick={async () => {
      try {
        await api.post(
          `/admin/orders/${id}/paytm/status`
        )

        const res = await getOrder(id)

        setData(res.data)

        const updatedStatus =
          res.data.order.paymentStatus

        if (
          ['paid', 'partially_refunded', 'refunded'].includes(
            updatedStatus
          )
        ) {
          showToast(
            'Payment verified successfully',
            'success'
          )
        } else {
          showToast(
            'Payment confirmation is still pending',
            'info'
          )
        }
      } catch (err) {
        showToast(
          err.response?.data?.message ||
            'Unable to verify Paytm payment',
          'error'
        )
      }
    }}
  >
    {order.paymentStatus === 'pending'
      ? 'Verify payment & update status'
      : 'Payment verified'}
  </Button>
</Stack>
              {/* <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => {
                    try {
                      await api.post(`/admin/orders/${id}/paytm/status`)
                      showToast('Status refreshed', 'success')
                      load()
                    } catch (err) {
                      showToast(err.response?.data?.message || 'Check failed', 'error')
                    }
                  }}
                >
                  Check status with Paytm
                </Button>
              </Stack> */}
              {isPaytmPaid && (
                <Stack spacing={1} sx={{ mt: 2 }}>
                  <TextField label="Refund amount" type="number" value={refund.amount} onChange={(e) => setRefund((r) => ({ ...r, amount: e.target.value }))} />
                  <TextField label="Reason" value={refund.reason} onChange={(e) => setRefund((r) => ({ ...r, reason: e.target.value }))} />
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={async () => {
                      try {
                        await api.post(`/admin/orders/${id}/paytm/refund`, {
                          amount: Number(refund.amount),
                          reason: refund.reason,
                        })
                        showToast('Refund requested', 'success')
                        load()
                      } catch (err) {
                        showToast(err.response?.data?.message || 'Refund failed', 'error')
                      }
                    }}
                  >
                    Refund
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Update status</Typography>
              <Stack spacing={2}>
                <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </TextField>
                <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button
                  variant="contained"
                  onClick={async () => {
                    await updateOrderStatus(id, { status, note })
                    showToast('Status updated', 'success')
                    setNote('')
                    load()
                  }}
                >
                  Save status
                </Button>
              </Stack>
              <Typography fontWeight={700} sx={{ mt: 3, mb: 1 }}>History</Typography>
              {history.map((h) => (
                <Typography key={h.id} variant="body2">
                  {h.status} · {h.changedBy} · {formatDateTime(h.createdAt)} {h.note ? `· ${h.note}` : ''}
                </Typography>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Order notes</Typography>
              <Typography variant="body2">{order.notes || '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Shipping / tracking</Typography>
              <Stack spacing={2}>
                <TextField label="Courier" value={tracking.courier} onChange={(e) => setTracking((t) => ({ ...t, courier: e.target.value }))} />
                <TextField label="Tracking number" value={tracking.trackingNumber} onChange={(e) => setTracking((t) => ({ ...t, trackingNumber: e.target.value }))} />
                <TextField label="Tracking URL" value={tracking.trackingUrl} onChange={(e) => setTracking((t) => ({ ...t, trackingUrl: e.target.value }))} />
                <Button
                  variant="outlined"
                  onClick={async () => {
                    try {
                      await api.patch(`/admin/orders/${id}/shipping`, tracking)
                      showToast('Shipping saved', 'success')
                    } catch (err) {
                      showToast(err.response?.data?.message || 'Save failed', 'error')
                    }
                  }}
                >
                  Save tracking
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}
