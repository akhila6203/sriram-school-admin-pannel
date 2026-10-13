
import { useEffect, useState } from 'react'
import {
  Link as RouterLink,
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
} from '@mui/material'

import EditIcon from '@mui/icons-material/Edit'

import StatusBadge from '../components/StatusBadge'
import DataTable from '../components/DataTable'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { useSnackbar } from '../context/SnackbarContext'
import { useRegisterPageHeader } from '../context/PageHeaderContext'
import { formatDateTime, formatINR } from '../utils/format'
import {
  getStudent,
  updateStudentControls,
} from '../api/students'

function DetailRow({ label, value }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 2,
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ flexShrink: 0 }}
      >
        {label}
      </Typography>

      <Typography
        variant="body2"
        fontWeight={500}
        textAlign="right"
        sx={{ overflowWrap: 'anywhere' }}
      >
        {value === null ||
        value === undefined ||
        value === ''
          ? '—'
          : value}
      </Typography>
    </Box>
  )
}

function DetailCard({ title, children }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography
          fontWeight={700}
          sx={{ mb: 2 }}
        >
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  )
}

export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useSnackbar()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useRegisterPageHeader(
    {
      title: data?.student?.studentName || 'Student Details',
      subtitle: '',
      backTo: null,
    },
    [data?.student?.studentName]
  )

  async function load() {
    setLoading(true)

    try {
      const res = await getStudent(id)
      setData(res.data)
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          'Failed to load student',
        'error'
      )
      navigate('/admin/students')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function patchControls(patch) {
    try {
      await updateStudentControls(id, patch)
      showToast('Updated successfully', 'success')
      await load()
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          'Update failed',
        'error'
      )
    }
  }

  if (loading || !data) {
    return <LoadingSkeleton rows={8} />
  }

  const s = data.student
  const extraFields = Object.entries(
    data.extraFields || {}
  )

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Stack
        direction="row"
        justifyContent="flex-end"
        alignItems="center"
        sx={{ width: '100%', mb: 3 }}
      >
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() =>
            navigate('/admin/students', {
              state: { editStudentId: s.id },
            })
          }
          sx={{
            ml: 'auto',
            borderRadius: 2,
            textTransform: 'none',
            px: 3,
          }}
        >
          Edit Student
        </Button>
      </Stack>

      <Card
        variant="outlined"
        sx={{ mb: 3, borderRadius: 3 }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{
              xs: 'flex-start',
              sm: 'center',
            }}
            gap={2}
          >
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
              >
                {s.studentName}
              </Typography>

              <Typography
                color="text.secondary"
                variant="body2"
                sx={{ mt: 0.5 }}
              >
                Admission: {s.admissionNumber}
                {' · '}
                Class: {s.className || '—'}
              </Typography>
            </Box>

            <Stack direction="row" gap={1}>
              <Chip
                label={
                  s.isActive ? 'Active' : 'Inactive'
                }
                color={
                  s.isActive ? 'success' : 'default'
                }
                size="small"
              />
              <StatusBadge status={s.kitStatus} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <DetailCard title="Student Information">
            <DetailRow
              label="Admission Number"
              value={s.admissionNumber}
            />
            <DetailRow
              label="Student Name"
              value={s.studentName}
            />
            <DetailRow
              label="Class"
              value={s.className}
            />
            <DetailRow
              label="Age"
              value={s.age}
            />
            <DetailRow
              label="Gender"
              value={s.gender}
            />
            <DetailRow
              label="Email"
              value={s.email}
            />
            <DetailRow
              label="House"
              value={s.houseColor}
            />
          </DetailCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DetailCard title="Parent & Contact Details">
            <DetailRow
              label="Parent Name"
              value={s.parentName}
            />
            <DetailRow
              label="Phone"
              value={s.phone}
            />
            <DetailRow
              label="Address"
              value={[s.address1, s.address2]
                .filter(Boolean)
                .join(', ')}
            />
            <DetailRow
              label="City"
              value={s.city}
            />
            <DetailRow
              label="State"
              value={s.state}
            />
            <DetailRow
              label="Zipcode"
              value={s.zipcode}
            />
            <DetailRow
              label="First Login"
              value={formatDateTime(s.firstLoginAt)}
            />
            <DetailRow
              label="Last Login"
              value={formatDateTime(s.lastLoginAt)}
            />
          </DetailCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DetailCard title="Student Controls">
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(s.isActive)}
                    onChange={(e) =>
                      patchControls({
                        isActive: e.target.checked,
                      })
                    }
                  />
                }
                label="Active"
              />

              <TextField
                select
                size="small"
                label="Kit Status"
                value={s.kitStatus}
                onChange={(e) =>
                  patchControls({
                    kitStatus: e.target.value,
                  })
                }
              >
                <MenuItem value="pending">
                  Pending
                </MenuItem>
                <MenuItem value="ordered">
                  Ordered
                </MenuItem>
              </TextField>

              <Button
                variant="outlined"
                onClick={() =>
                  patchControls({
                    kitStatus: 'pending',
                  })
                }
              >
                Reset Kit Status
              </Button>

              <TextField
                select
                size="small"
                label="Catalog Override"
                value={
                  s.catalogOverride || 'default'
                }
                onChange={(e) =>
                  patchControls({
                    catalogOverride: e.target.value,
                  })
                }
              >
                <MenuItem value="default">
                  Default
                </MenuItem>
                <MenuItem value="force_kit">
                  Force Kit
                </MenuItem>
                <MenuItem value="force_individual">
                  Force Individual
                </MenuItem>
              </TextField>
            </Stack>
          </DetailCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DetailCard title="Additional Excel Details">
            {extraFields.length ? (
              extraFields.map(([key, value]) => (
                <DetailRow
                  key={key}
                  label={key}
                  value={value}
                />
              ))
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                No additional Excel fields.
              </Typography>
            )}
          </DetailCard>
        </Grid>
      </Grid>

      <Typography
        fontWeight={700}
        sx={{ mb: 2 }}
      >
        Order History
      </Typography>

      <DataTable
        columns={[
          {
            id: 'orderNumber',
            label: 'Order',
            render: (r) => (
              <Button
                size="small"
                component={RouterLink}
                to={`/admin/orders/${r.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                {r.orderNumber}
              </Button>
            ),
          },
          {
            id: 'type',
            label: 'Type',
            render: (r) => (
              <StatusBadge status={r.type} />
            ),
          },
          {
            id: 'status',
            label: 'Status',
            render: (r) => (
              <StatusBadge status={r.status} />
            ),
          },
          {
            id: 'paymentStatus',
            label: 'Payment',
            render: (r) => (
              <StatusBadge status={r.paymentStatus} />
            ),
          },
          {
            id: 'total',
            label: 'Total',
            render: (r) => formatINR(r.total),
          },
          {
            id: 'createdAt',
            label: 'Date',
            render: (r) =>
              formatDateTime(r.createdAt),
          },
        ]}
        rows={data.orders || []}
        loading={false}
        emptyTitle="No orders yet"
      />
    </Box>
  )
}



// import { useEffect, useState } from 'react'
// import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
// import {
//   Box,
//   Button,
//   Card,
//   CardContent,
//   FormControlLabel,
//   MenuItem,
//   Stack,
//   Switch,
//   TextField,
//   Typography,
// } from '@mui/material'
// import PageHeader from '../components/PageHeader'
// import StatusBadge from '../components/StatusBadge'
// import DataTable from '../components/DataTable'
// import LoadingSkeleton from '../components/LoadingSkeleton'
// import { useSnackbar } from '../context/SnackbarContext'
// import { formatDateTime, formatINR } from '../utils/format'
// import { getStudent, updateStudentControls } from '../api/students'

// export default function StudentDetail() {
//   const { id } = useParams()
//   const navigate = useNavigate()
//   const { showToast } = useSnackbar()
//   const [data, setData] = useState(null)
//   const [loading, setLoading] = useState(true)

//   async function load() {
//     setLoading(true)
//     try {
//       const res = await getStudent(id)
//       setData(res.data)
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Failed to load student', 'error')
//       navigate('/admin/students')
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     load()
//   }, [id])

//   async function patchControls(patch) {
//     try {
//       await updateStudentControls(id, patch)
//       showToast('Updated', 'success')
//       load()
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Update failed', 'error')
//     }
//   }

//   if (loading || !data) {
//     return (
//       <>
//         <PageHeader title="Student" breadcrumbs={[{ label: 'Students', to: '/admin/students' }, { label: '…' }]} />
//         <LoadingSkeleton rows={6} />
//       </>
//     )
//   }

//   const s = data.student

//   return (
//     <>
//       <PageHeader
//         title={`${s.studentName} (${s.admissionNumber})`}
//         subtitle={`${s.parentName} · ${s.houseColor} · ${s.city}`}
//         breadcrumbs={[
//           { label: 'Students', to: '/admin/students' },
//           { label: s.admissionNumber },
//         ]}
//         actions={
//           <Button component={RouterLink} to="/admin/students" variant="outlined">
//             Back to list
//           </Button>
//         }
//       />

//       <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
//         <Card variant="outlined" sx={{ flex: 1 }}>
//           <CardContent>
//             <Typography fontWeight={600} sx={{ mb: 2 }}>Profile</Typography>
//             <Stack spacing={1} sx={{ typography: 'body2' }}>
//               <Box>Address: {[s.address1, s.address2, s.city, s.state, s.zipcode].filter(Boolean).join(', ')}</Box>
//               <Box>Phone: {s.phone || '—'}</Box>
//               <Box>Last login: {formatDateTime(s.lastLoginAt)}</Box>
//               <Box>First login: {formatDateTime(s.firstLoginAt)}</Box>
//               <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//                 Kit status: <StatusBadge status={s.kitStatus} />
//               </Box>
//             </Stack>
//           </CardContent>
//         </Card>

//         <Card variant="outlined" sx={{ flex: 1 }}>
//           <CardContent>
//             <Typography fontWeight={600} sx={{ mb: 2 }}>Controls</Typography>
//             <Stack spacing={2}>
//               <FormControlLabel
//                 control={
//                   <Switch
//                     checked={s.isActive}
//                     onChange={(e) => patchControls({ isActive: e.target.checked })}
//                   />
//                 }
//                 label="Active"
//               />
//               <TextField
//                 select
//                 size="small"
//                 label="Kit status"
//                 value={s.kitStatus}
//                 onChange={(e) => patchControls({ kitStatus: e.target.value })}
//               >
//                 <MenuItem value="pending">Pending</MenuItem>
//                 <MenuItem value="ordered">Ordered</MenuItem>
//               </TextField>
//               <Button
//                 variant="outlined"
//                 onClick={() => patchControls({ kitStatus: 'pending' })}
//               >
//                 Reset kit status to pending
//               </Button>
//               <TextField
//                 select
//                 size="small"
//                 label="Catalog override"
//                 value={s.catalogOverride || 'default'}
//                 onChange={(e) => patchControls({ catalogOverride: e.target.value })}
//               >
//                 <MenuItem value="default">Default (follow store rules)</MenuItem>
//                 <MenuItem value="force_kit">Force kit</MenuItem>
//                 <MenuItem value="force_individual">Force individual</MenuItem>
//               </TextField>
//             </Stack>
//           </CardContent>
//         </Card>
//       </Stack>

//       <Typography fontWeight={600} sx={{ mb: 1 }}>Order history</Typography>
//       <DataTable
//         columns={[
//           {
//             id: 'orderNumber',
//             label: 'Order',
//             render: (r) => (
//               <Button size="small" component={RouterLink} to={`/admin/orders/${r.id}`} onClick={(e) => e.stopPropagation()}>
//                 {r.orderNumber}
//               </Button>
//             ),
//           },
//           { id: 'type', label: 'Type', render: (r) => <StatusBadge status={r.type} /> },
//           { id: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
//           { id: 'paymentStatus', label: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
//           { id: 'total', label: 'Total', render: (r) => formatINR(r.total) },
//           { id: 'createdAt', label: 'Date', render: (r) => formatDateTime(r.createdAt) },
//         ]}
//         rows={data.orders || []}
//         loading={false}
//         emptyTitle="No orders yet"
//       />
//     </>
//   )
// }
