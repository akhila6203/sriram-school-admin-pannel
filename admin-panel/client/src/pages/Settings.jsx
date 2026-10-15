import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined'
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined'
import PageHeader from '../components/PageHeader'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { useSnackbar } from '../context/SnackbarContext'
import api from '../api/client'

function TabPanel({ value, index, children }) {
  if (value !== index) return null
  return <Box sx={{ pt: 3 }}>{children}</Box>
}

const empty = {
  school_name: '',
  school_logo: '',
  contact_email: '',
  contact_phone: '',
  order_number_prefix: 'SS',
  shipping_fee: 0,
  free_shipping_threshold: '',
  catalog_switch_rule: 'after_kit_order',
  allow_kit_reorder: false,
  extra_login_check: 'none',
  low_stock_default_threshold: 5,
  allow_student_edit_address: false,
  paytm_enabled: false,
  paytm_environment: 'staging',
  paytm_mid: '',
  paytm_merchant_key: '',
  paytm_website: 'WEBSTAGING',
  paytm_industry_type: 'Retail',
  paytm_channel_id: 'WEB',
  paytm_callback_url: '',
  smtp_host: '',
  smtp_port: 587,
  smtp_secure: false,
  smtp_user: '',
  smtp_password: '',
  smtp_from_name: 'Scholar Store',
  smtp_from_email: '',
  payment_methods: [],
}

export default function Settings() {
  const { showToast } = useSnackbar()
  const [tab, setTab] = useState(0)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/settings')
      setForm({ ...empty, ...data.data.settings })
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(partial) {
    setSaving(true)
    try {
      const payload = { ...partial }
      if (payload.free_shipping_threshold === '') payload.free_shipping_threshold = null
      const { data } = await api.put('/admin/settings', payload)
      setForm({ ...empty, ...data.data.settings })
      showToast('Settings saved', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function onUploadLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const body = new FormData()
    body.append('logo', file)
    try {
      const { data } = await api.post('/admin/settings/logo', body)
      setField('school_logo', data.data.school_logo)
      showToast('Logo uploaded', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Upload failed', 'error')
    }
  }

  async function sendTestEmail() {
    try {
      const { data } = await api.post('/admin/settings/test-email', {})
      showToast(data.message || 'Test email sent', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Test email failed', 'error')
    }
  }

  if (loading) return <LoadingSkeleton rows={8} />

  return (
    <>

      {/* <Card variant="outlined"> */}
      <Box sx={{ width: '60%', bgcolor: 'transparent' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          // sx={{ px: 0, bgcolor: 'transparent', border: 'none' }}
          sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
        >
           <Tab label="General" value={0} />
  <Tab label="Payments – Paytm" value={2} />
  <Tab label="Email (SMTP)" value={3} />
          {/* <Tab label="General" />
          <Tab label="Store Rules" />
          <Tab label="Payments – Paytm" />
          <Tab label="Email (SMTP)" />
          <Tab label="Payment methods" /> */}
        </Tabs>
        <Box>
          <TabPanel value={tab} index={0}>
            <Stack spacing={2} maxWidth={640}>
              <TextField label="School name" fullWidth value={form.school_name || ''} onChange={(e) => setField('school_name', e.target.value)} />
              <Stack direction="row" spacing={2} alignItems="center">
                {form.school_logo ? (
                  <Box component="img" src={form.school_logo} alt="Logo" sx={{ height: 48, borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
                ) : null}
                <Button variant="outlined" component="label">
                  Upload logo
                  <input hidden type="file" accept="image/*" onChange={onUploadLogo} />
                </Button>
              </Stack>
              <TextField label="Contact email" fullWidth value={form.contact_email || ''} onChange={(e) => setField('contact_email', e.target.value)} />
              <TextField label="Contact phone" fullWidth value={form.contact_phone || ''} onChange={(e) => setField('contact_phone', e.target.value)} />
              <TextField label="Order number prefix" fullWidth value={form.order_number_prefix || ''} onChange={(e) => setField('order_number_prefix', e.target.value)} />
              <TextField type="number" label="Flat shipping fee (₹)" fullWidth value={form.shipping_fee ?? 0} onChange={(e) => setField('shipping_fee', e.target.value)} />
              <TextField type="number" label="Free shipping threshold (optional)" fullWidth value={form.free_shipping_threshold ?? ''} onChange={(e) => setField('free_shipping_threshold', e.target.value)} />
              <Button variant="contained" disabled={saving} onClick={() => save({
                school_name: form.school_name,
                contact_email: form.contact_email,
                contact_phone: form.contact_phone,
                order_number_prefix: form.order_number_prefix,
                shipping_fee: Number(form.shipping_fee || 0),
                free_shipping_threshold: form.free_shipping_threshold === '' || form.free_shipping_threshold == null
                  ? null
                  : Number(form.free_shipping_threshold),
              })}>
                Save general
              </Button>
            </Stack>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <Stack spacing={2} maxWidth={640}>
              <TextField
                select
                label="Catalog switching rule"
                fullWidth
                value={form.catalog_switch_rule || 'after_kit_order'}
                onChange={(e) => setField('catalog_switch_rule', e.target.value)}
              >
                <MenuItem value="after_kit_order">After kit order</MenuItem>
                <MenuItem value="after_first_login">After first login</MenuItem>
              </TextField>
              <FormControlLabel
                control={<Switch checked={Boolean(form.allow_kit_reorder)} onChange={(e) => setField('allow_kit_reorder', e.target.checked)} />}
                label="Allow kit re-order"
              />
              <TextField
                select
                label="Extra student login check"
                fullWidth
                value={form.extra_login_check || 'none'}
                onChange={(e) => setField('extra_login_check', e.target.value)}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="zipcode">Zipcode</MenuItem>
                <MenuItem value="parent_phone">Parent phone</MenuItem>
              </TextField>
              <TextField
                type="number"
                label="Default low-stock threshold"
                fullWidth
                value={form.low_stock_default_threshold ?? 5}
                onChange={(e) => setField('low_stock_default_threshold', Number(e.target.value))}
              />
              <FormControlLabel
                control={<Switch checked={Boolean(form.allow_student_edit_address)} onChange={(e) => setField('allow_student_edit_address', e.target.checked)} />}
                label="Allow students to edit address"
              />
              <Button variant="contained" disabled={saving} onClick={() => save({
                catalog_switch_rule: form.catalog_switch_rule,
                allow_kit_reorder: Boolean(form.allow_kit_reorder),
                extra_login_check: form.extra_login_check,
                low_stock_default_threshold: Number(form.low_stock_default_threshold || 5),
                allow_student_edit_address: Boolean(form.allow_student_edit_address),
              })}>
                Save store rules
              </Button>
            </Stack>
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <Stack spacing={2} maxWidth={720}>
              {form.paytm_environment === 'production' ? (
                <Alert severity="warning">Production mode — real charges will be processed.</Alert>
              ) : (
                <Alert severity="info">Staging mode — use Paytm staging credentials only.</Alert>
              )}
              <FormControlLabel
                control={<Switch checked={Boolean(form.paytm_enabled)} onChange={(e) => setField('paytm_enabled', e.target.checked)} />}
                label="Enable Paytm"
              />
              <TextField
                select
                label="Environment"
                fullWidth
                value={form.paytm_environment || 'staging'}
                onChange={(e) => {
                  const env = e.target.value
                  setForm((f) => ({
                    ...f,
                    paytm_environment: env,
                    paytm_website: env === 'production' ? 'DEFAULT' : 'WEBSTAGING',
                  }))
                }}
              >
                <MenuItem value="staging">Staging</MenuItem>
                <MenuItem value="production">Production</MenuItem>
              </TextField>
              <TextField label="Merchant ID (MID)" fullWidth value={form.paytm_mid || ''} onChange={(e) => setField('paytm_mid', e.target.value)} />
              <TextField
                label="Merchant Key"
                fullWidth
                type="password"
                value={form.paytm_merchant_key || ''}
                onChange={(e) => setField('paytm_merchant_key', e.target.value)}
                helperText="Leave unchanged (masked) to keep the existing key"
              />
              <TextField label="Website name" fullWidth value={form.paytm_website || ''} onChange={(e) => setField('paytm_website', e.target.value)} />
              <TextField label="Industry type" fullWidth value={form.paytm_industry_type || ''} onChange={(e) => setField('paytm_industry_type', e.target.value)} />
              <TextField
                select
                label="Channel ID"
                fullWidth
                value={form.paytm_channel_id || 'WEB'}
                onChange={(e) => setField('paytm_channel_id', e.target.value)}
              >
                <MenuItem value="WEB">WEB</MenuItem>
                <MenuItem value="WAP">WAP</MenuItem>
              </TextField>
              <TextField
                label="Callback URL"
                fullWidth
                value={form.paytm_callback_url || ''}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="Copy callback URL"
                        onClick={() => {
                          navigator.clipboard.writeText(form.paytm_callback_url || '')
                          showToast('Copied', 'success')
                        }}
                      >
                        <ContentCopyOutlinedIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={saving} onClick={() => save({
                  paytm_enabled: Boolean(form.paytm_enabled),
                  paytm_environment: form.paytm_environment,
                  paytm_mid: form.paytm_mid,
                  paytm_merchant_key: form.paytm_merchant_key,
                  paytm_website: form.paytm_website,
                  paytm_industry_type: form.paytm_industry_type,
                  paytm_channel_id: form.paytm_channel_id,
                })}>
                  Save Paytm
                </Button>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const { data } = await api.post('/admin/settings/paytm/test')
                      showToast(data.message || (data.data?.ok ? 'Paytm OK' : 'Check credentials'), data.data?.ok ? 'success' : 'warning')
                    } catch (err) {
                      showToast(err.response?.data?.message || 'Test failed', 'error')
                    }
                  }}
                >
                  Test connection
                </Button>
              </Stack>
            </Stack>
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <Stack spacing={2} maxWidth={640}>
              <TextField label="SMTP host" fullWidth value={form.smtp_host || ''} onChange={(e) => setField('smtp_host', e.target.value)} />
              <TextField type="number" label="Port" fullWidth value={form.smtp_port ?? 587} onChange={(e) => setField('smtp_port', Number(e.target.value))} />
              <FormControlLabel
                control={<Switch checked={Boolean(form.smtp_secure)} onChange={(e) => setField('smtp_secure', e.target.checked)} />}
                label="Secure (TLS/SSL)"
              />
              <TextField label="Username" fullWidth value={form.smtp_user || ''} onChange={(e) => setField('smtp_user', e.target.value)} />
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={form.smtp_password || ''}
                onChange={(e) => setField('smtp_password', e.target.value)}
                helperText="Leave masked value unchanged to keep the existing password"
              />
              <TextField label="From name" fullWidth value={form.smtp_from_name || ''} onChange={(e) => setField('smtp_from_name', e.target.value)} />
              <TextField label="From email" fullWidth value={form.smtp_from_email || ''} onChange={(e) => setField('smtp_from_email', e.target.value)} />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={saving} onClick={() => save({
                  smtp_host: form.smtp_host,
                  smtp_port: Number(form.smtp_port || 587),
                  smtp_secure: Boolean(form.smtp_secure),
                  smtp_user: form.smtp_user,
                  smtp_password: form.smtp_password,
                  smtp_from_name: form.smtp_from_name,
                  smtp_from_email: form.smtp_from_email,
                })}>
                  Save SMTP
                </Button>
                <Button variant="outlined" onClick={sendTestEmail}>Send test email</Button>
              </Stack>
            </Stack>
          </TabPanel>

          <TabPanel value={tab} index={4}>
            <Stack spacing={2} maxWidth={640}>
              <Typography variant="body2" color="text.secondary">
                Enable or disable checkout payment methods for the storefront.
              </Typography>
              {(form.payment_methods || []).map((m, idx) => (
                <Box key={m.id}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(m.enabled)}
                          onChange={(e) => {
                            const next = [...(form.payment_methods || [])]
                            next[idx] = { ...m, enabled: e.target.checked }
                            setField('payment_methods', next)
                          }}
                        />
                      }
                      label={m.label}
                    />
                    <Stack direction="row">
                      <IconButton
                        size="small"
                        aria-label="Move up"
                        disabled={idx === 0}
                        onClick={() => {
                          const next = [...(form.payment_methods || [])]
                          ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                          setField('payment_methods', next)
                        }}
                      >
                        <ArrowUpwardOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Move down"
                        disabled={idx === (form.payment_methods || []).length - 1}
                        onClick={() => {
                          const next = [...(form.payment_methods || [])]
                          ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                          setField('payment_methods', next)
                        }}
                      >
                        <ArrowDownwardOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                  {idx < (form.payment_methods || []).length - 1 && <Divider sx={{ my: 1 }} />}
                </Box>
              ))}
              <Button variant="contained" disabled={saving} onClick={() => save({ payment_methods: form.payment_methods })}>
                Save payment methods
              </Button>
            </Stack>
          </TabPanel>
        </Box>
      </Box>

    </>
  )
}
