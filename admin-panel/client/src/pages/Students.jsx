
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {
  createStudent,
  deleteStudent,
  getStudent,
  importCommit,
  importPreview,
  listStudents,
  listStudentClasses,
  updateStudent,
  updateStudentControls,
} from '../api/students'

import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/UploadFile'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'

import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import TableIconActions from '../components/TableIconActions'
import usePaginatedList from '../hooks/usePaginatedList'
import { useSnackbar } from '../context/SnackbarContext'
import { useRegisterPageHeader } from '../context/PageHeaderContext'
import { formatDateTime } from '../utils/format'


const emptyForm = {
  admissionNumber: '',
  studentName: '',
  parentName: '',
  className: '',
  age: '',
  gender: '',
  email: '',
  address1: '',
  address2: '',
  city: 'Hyderabad',
  state: 'TS',
  zipcode: '',
  houseColor: 'Red',
  phone: '',
  isActive: true,
}

const houses = ['Red', 'Yellow', 'Green', 'Blue']

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
  },
}

export default function Students() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useSnackbar()

  useRegisterPageHeader(
    {
      title: 'Students',
      subtitle: '',
      backTo: null,
    },
    []
  )

  const [filters, setFilters] = useState({
    search: '',
    className: '',
    houseColor: '',
    kitStatus: '',
    isActive: '',
  })

  const [classes, setClasses] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState(0)
  const [importFile, setImportFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)

  const fetcher = useMemo(
    () => (params) => listStudents(params),
    []
  )

  const {
    items,
    pagination,
    loading,
    error,
    page,
    pageSize,
    setPage,
    setPageSize,
    reload,
  } = usePaginatedList(fetcher, filters)

  async function loadClasses() {
    try {
      const res = await listStudentClasses()
      setClasses(res.data.items || [])
    } catch {
      setClasses([])
    }
  }

  useEffect(() => {
    loadClasses()
  }, [])

  function changeFilter(key, value) {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm })
    setFormOpen(true)
  }

  function openEdit(student) {
    setEditing(student)
    setForm({
      admissionNumber: student.admissionNumber || '',
      studentName: student.studentName || '',
      parentName: student.parentName || '',
      className: student.className || '',
      age: student.age ?? '',
      gender: student.gender || '',
      email: student.email || '',
      address1: student.address1 || '',
      address2: student.address2 || '',
      city: student.city || '',
      state: student.state || '',
      zipcode: student.zipcode || '',
      houseColor: student.houseColor || 'Red',
      phone: student.phone || '',
      isActive: Boolean(student.isActive),
    })
    setFormOpen(true)
  }

  useEffect(() => {
  const studentId = location.state?.editStudentId

  if (!studentId) return

  let cancelled = false

  async function loadStudentForEdit() {
    try {
      const response = await getStudent(studentId)

      if (!cancelled) {
        openEdit(response.data.student)
      }
    } catch (error) {
      if (!cancelled) {
        showToast('Unable to open student for editing', 'error')
      }
    }
  }

  loadStudentForEdit()

  navigate(location.pathname, {
    replace: true,
    state: null,
  })

  return () => {
    cancelled = true
  }
}, [location.state?.editStudentId])

  async function saveStudent(e) {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        ...form,
        className: form.className.trim() || null,
        age: form.age === '' ? null : Number(form.age),
        gender: form.gender || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      }

      if (editing) {
        await updateStudent(editing.id, payload)
      } else {
        await createStudent(payload)
      }

      showToast(
        editing ? 'Student updated' : 'Student created',
        'success'
      )

      setFormOpen(false)
      setEditing(null)
      reload()
      loadClasses()
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Save failed',
        'error'
      )
    } finally {
      setSaving(false)
    }
  }

  function openImport() {
    setImportOpen(true)
    setImportStep(0)
    setImportFile(null)
    setPreview(null)
  }

  async function onPreview(file) {
    setImportFile(file)

    try {
      const res = await importPreview(file)
      setPreview(res.data)
      setImportStep(1)
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Preview failed',
        'error'
      )
    }
  }

  async function onCommit() {
    if (!importFile) return

    setImporting(true)

    try {
      const res = await importCommit(importFile)

      setPreview((previous) => ({
        ...previous,
        commitResult: res.data,
        rowErrors: res.data.rowErrors,
      }))

      setImportStep(2)

      showToast(
        `Import done: ${res.data.created} new, ${res.data.updated} updated`,
        'success'
      )

      reload()
      loadClasses()
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Import failed',
        'error'
      )
    } finally {
      setImporting(false)
    }
  }

  const columns = [
    {
      id: 'admissionNumber',
      label: 'Admission',
      render: (r) => r.admissionNumber,
    },
    {
      id: 'studentName',
      label: 'Name',
      render: (r) => r.studentName,
    },
    {
      id: 'className',
      label: 'Class',
      render: (r) => r.className || '—',
    },
    {
      id: 'age',
      label: 'Age',
      render: (r) => r.age ?? '—',
    },
    {
      id: 'gender',
      label: 'Gender',
      render: (r) => r.gender || '—',
    },
    {
      id: 'parentName',
      label: 'Parent',
      render: (r) => r.parentName,
    },
    {
      id: 'houseColor',
      label: 'SHIRT COLOR',
      render: (r) => (
        <Chip
          size="small"
          label={r.houseColor}
          sx={{
            bgcolor: '#eef2ff',
            color: 'primary.dark',
          }}
        />
      ),
    },
    {
      id: 'city',
      label: 'City',
      render: (r) => r.city,
    },
    {
      id: 'phone',
      label: 'Phone',
      render: (r) => r.phone || '—',
    },
    {
      id: 'kitStatus',
      label: 'Kit',
      render: (r) => (
        <StatusBadge status={r.kitStatus} />
      ),
    },
    {
      id: 'lastLoginAt',
      label: 'Last Login',
      render: (r) => formatDateTime(r.lastLoginAt),
    },
    {
      id: 'isActive',
      label: 'Active',
      render: (r) => (
        <Switch
          size="small"
          checked={Boolean(r.isActive)}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            try {
              await updateStudentControls(r.id, {
                isActive: e.target.checked,
              })
              reload()
            } catch (err) {
              showToast(
                err.response?.data?.message ||
                  'Status update failed',
                'error'
              )
            }
          }}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      width: 130,
      render: (r) => (
        <Box onClick={(e) => e.stopPropagation()}>
          <TableIconActions
            viewLabel="View Student"
            editLabel="Edit Student"
            deleteLabel="Delete Student"
            onView={() =>
              navigate(`/admin/students/${r.id}`)
            }
            onEdit={() => openEdit(r)}
            onDelete={() => setDeleteId(r.id)}
          />
        </Box>
      ),
    },
  ]

  return (
    <>
      {/* TOP RIGHT ACTIONS */}
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 3,
        }}
      >
        <Button
          href="/api/admin/students/export"
          startIcon={<DownloadIcon />}
          sx={{ textTransform: 'none' }}
        >
          Export CSV
        </Button>

        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={openImport}
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          Import Excel
        </Button>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAdd}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Add Student
        </Button>
      </Box>

      {/* SEARCH AND FILTERS */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'minmax(260px, 2fr) repeat(4, minmax(120px, 1fr))',
          },
          gap: 1.5,
          mb: 3,
        }}
      >
        <TextField
          size="small"
          placeholder="Search name, admission, age, class..."
          value={filters.search}
          onChange={(e) =>
            changeFilter('search', e.target.value)
          }
          sx={inputSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          select
          size="small"
          label="Class"
          value={filters.className}
          onChange={(e) =>
            changeFilter('className', e.target.value)
          }
          sx={inputSx}
        >
          <MenuItem value="">All Classes</MenuItem>
          {classes.map((cls) => (
            <MenuItem key={cls} value={cls}>
              Class {cls}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Shirt Color"
          value={filters.houseColor}
          onChange={(e) =>
            changeFilter('houseColor', e.target.value)
          }
          sx={inputSx}
        >
          <MenuItem value="">All Shirt Colors</MenuItem>
          {houses.map((house) => (
            <MenuItem key={house} value={house}>
              {house}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Kit"
          value={filters.kitStatus}
          onChange={(e) =>
            changeFilter('kitStatus', e.target.value)
          }
          sx={inputSx}
        >
          <MenuItem value="">All Kits</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="ordered">Ordered</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Active"
          value={filters.isActive}
          onChange={(e) =>
            changeFilter('isActive', e.target.value)
          }
          sx={inputSx}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
      </Box>

      {/* EXISTING TABLE */}
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={error}
        page={page}
        pageSize={pageSize}
        total={pagination.total || 0}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n)
          setPage(0)
        }}
        onRowClick={(r) =>
          navigate(`/admin/students/${r.id}`)
        }
        emptyTitle="No students found"
        emptyDescription="Try changing the filters or add a student."
      />

      {/* ADD / EDIT STUDENT */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing ? 'Edit Student' : 'Add Student'}
        </DialogTitle>

        <Box component="form" onSubmit={saveStudent}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {[
                ['admissionNumber', 'Admission Number'],
                ['studentName', 'Student Name'],
                ['parentName', 'Parent Name'],
              ].map(([key, label]) => (
                <Grid key={key} size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={label}
                    required
                    fullWidth
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [key]: e.target.value,
                      }))
                    }
                    sx={inputSx}
                  />
                </Grid>
              ))}

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Class"
                  required
                  fullWidth
                  value={form.className}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      className: e.target.value,
                    }))
                  }
                  helperText="Example: 2, 3, 4"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Age"
                  type="number"
                  fullWidth
                  value={form.age}
                  inputProps={{ min: 0, max: 120 }}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      age: e.target.value,
                    }))
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Gender"
                  fullWidth
                  value={form.gender}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      gender: e.target.value,
                    }))
                  }
                >
                  <MenuItem value="">Select Gender</MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      email: e.target.value,
                    }))
                  }
                />
              </Grid>

              {[
                ['address1', 'Address 1'],
                ['address2', 'Address 2'],
                ['city', 'City'],
                ['state', 'State'],
                ['zipcode', 'Zipcode'],
                ['phone', 'Phone'],
              ].map(([key, label]) => (
                <Grid key={key} size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={label}
                    fullWidth
                    required={
                      !['address2', 'phone'].includes(key)
                    }
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [key]: e.target.value,
                      }))
                    }
                  />
                </Grid>
              ))}

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="SHIRT COLOR"
                  fullWidth
                  required
                  value={form.houseColor}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      houseColor: e.target.value,
                    }))
                  }
                >
                  {houses.map((house) => (
                    <MenuItem key={house} value={house}>
                      {house}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isActive: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Active Student"
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, gap: 1 }}>
            <Button onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Student'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Student?"
        message="Students with existing orders cannot be deleted. Deactivate them instead."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          try {
            await deleteStudent(deleteId)
            showToast('Student deleted', 'success')
            setDeleteId(null)
            reload()
            loadClasses()
          } catch (err) {
            showToast(
              err.response?.data?.message ||
                'Delete failed',
              'error'
            )
          }
        }}
      />

      {/* EXISTING EXCEL IMPORT WORKFLOW */}
      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Import Students</DialogTitle>

        <DialogContent>
          <Stepper activeStep={importStep} sx={{ mb: 3 }}>
            <Step><StepLabel>Upload</StepLabel></Step>
            <Step><StepLabel>Preview</StepLabel></Step>
            <Step><StepLabel>Done</StepLabel></Step>
          </Stepper>

          {importStep === 0 && (
            <Button variant="outlined" component="label">
              Choose Excel / CSV
              <input
                hidden
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onPreview(file)
                }}
              />
            </Button>
          )}

          {importStep >= 1 && preview && (
            <Box>
              <Stack
                direction="row"
                spacing={2}
                useFlexGap
                flexWrap="wrap"
                sx={{ mb: 2 }}
              >
                {[
                  ['New', preview.counts?.new],
                  ['Will Update', preview.counts?.willUpdate],
                  ['Invalid', preview.counts?.invalid],
                  ['Duplicates', preview.counts?.duplicateInFile],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      flex: '1 1 120px',
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption">
                      {label}
                    </Typography>
                    <Typography variant="h6">
                      {value ?? 0}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              <Typography fontWeight={600} sx={{ mb: 1 }}>
                First 20 Rows
              </Typography>

              <DataTable
                columns={[
                  {
                    id: 'rowNumber',
                    label: '#',
                    render: (r) => r.rowNumber,
                  },
                  {
                    id: 'admissionNumber',
                    label: 'Admission',
                    render: (r) => r.admissionNumber,
                  },
                  {
                    id: 'studentName',
                    label: 'Name',
                    render: (r) => r.studentName,
                  },
                  {
                    id: 'className',
                    label: 'Class',
                    render: (r) => r.className || '—',
                  },
                  {
                    id: 'houseColor',
                    label: 'Shirt Color',
                    render: (r) => r.houseColor,
                  },
                ]}
                rows={preview.previewRows || []}
                loading={false}
              />

              {preview.rowErrors?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography color="error" fontWeight={600}>
                    Row Errors
                  </Typography>

                  {preview.rowErrors.slice(0, 20).map((err) => (
                    <Typography
                      key={err.row}
                      variant="body2"
                      color="error"
                    >
                      Row {err.row}:{' '}
                      {(err.messages || []).join('; ')}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setImportOpen(false)}>
            Close
          </Button>

          {importStep === 1 && (
            <Button
              variant="contained"
              disabled={importing}
              onClick={onCommit}
            >
              {importing
                ? 'Importing...'
                : 'Confirm Import'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}



// import { useMemo, useState } from 'react'
// import { useNavigate } from 'react-router-dom'
// import {
//   Box,
//   Button,
//   Chip,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   FormControlLabel,
//   MenuItem,
//   Stack,
//   Step,
//   StepLabel,
//   Stepper,
//   Switch,
//   TextField,
//   Typography,
// } from '@mui/material'
// import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
// import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
// import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
// import PageHeader from '../components/PageHeader'
// import DataTable from '../components/DataTable'
// import StatusBadge from '../components/StatusBadge'
// import ConfirmDialog from '../components/ConfirmDialog'
// import usePaginatedList from '../hooks/usePaginatedList'
// import { useSnackbar } from '../context/SnackbarContext'
// import { formatDateTime } from '../utils/format'
// import {
//   createStudent,
//   deleteStudent,
//   importCommit,
//   importPreview,
//   listStudents,
//   updateStudent,
//   updateStudentControls,
// } from '../api/students'

// const emptyForm = {
//   admissionNumber: '',
//   studentName: '',
//   parentName: '',
//   address1: '',
//   address2: '',
//   city: 'Hyderabad',
//   state: 'TS',
//   zipcode: '',
//   houseColor: 'Red',
//   phone: '',
//   isActive: true,
// }

// export default function Students() {
//   const { showToast } = useSnackbar()
//   const navigate = useNavigate()
//   const [filters, setFilters] = useState({ search: '', houseColor: '', kitStatus: '', isActive: '' })
//   const [formOpen, setFormOpen] = useState(false)
//   const [editing, setEditing] = useState(null)
//   const [form, setForm] = useState(emptyForm)
//   const [deleteId, setDeleteId] = useState(null)
//   const [importOpen, setImportOpen] = useState(false)
//   const [importStep, setImportStep] = useState(0)
//   const [importFile, setImportFile] = useState(null)
//   const [preview, setPreview] = useState(null)
//   const [importing, setImporting] = useState(false)

//   const fetcher = useMemo(() => (params) => listStudents(params), [])
//   const { items, pagination, loading, error, page, pageSize, setPage, setPageSize, reload } =
//     usePaginatedList(fetcher, filters)

//   async function saveStudent(e) {
//     e.preventDefault()
//     try {
//       const payload = { ...form, phone: form.phone || null }
//       if (editing) await updateStudent(editing.id, payload)
//       else await createStudent(payload)
//       showToast(editing ? 'Student updated' : 'Student created', 'success')
//       setFormOpen(false)
//       reload()
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Save failed', 'error')
//     }
//   }

//   async function onPreview(file) {
//     setImportFile(file)
//     try {
//       const res = await importPreview(file)
//       setPreview(res.data)
//       setImportStep(1)
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Preview failed', 'error')
//     }
//   }

//   async function onCommit() {
//     if (!importFile) return
//     setImporting(true)
//     try {
//       const res = await importCommit(importFile)
//       setPreview((p) => ({ ...p, commitResult: res.data, rowErrors: res.data.rowErrors }))
//       setImportStep(2)
//       showToast(`Import done: ${res.data.created} new, ${res.data.updated} updated`, 'success')
//       reload()
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Import failed', 'error')
//     } finally {
//       setImporting(false)
//     }
//   }

//   const columns = [
//     { id: 'admissionNumber', label: 'Admission', render: (r) => r.admissionNumber },
//     { id: 'studentName', label: 'Name', render: (r) => r.studentName },
//     { id: 'parentName', label: 'Parent', render: (r) => r.parentName },
//     {
//       id: 'houseColor',
//       label: 'House',
//       render: (r) => <Chip size="small" label={r.houseColor} sx={{ bgcolor: '#eef2ff', color: 'primary.dark' }} />,
//     },
//     { id: 'city', label: 'City', render: (r) => r.city },
//     { id: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
//     { id: 'kitStatus', label: 'Kit', render: (r) => <StatusBadge status={r.kitStatus} /> },
//     { id: 'lastLoginAt', label: 'Last login', render: (r) => formatDateTime(r.lastLoginAt) },
//     {
//       id: 'isActive',
//       label: 'Active',
//       render: (r) => (
//         <Switch
//           size="small"
//           checked={r.isActive}
//           onClick={(e) => e.stopPropagation()}
//           onChange={async (e) => {
//             await updateStudentControls(r.id, { isActive: e.target.checked })
//             reload()
//           }}
//         />
//       ),
//     },
//     {
//       id: 'actions',
//       label: '',
//       align: 'right',
//       render: (r) => (
//         <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
//           <Button size="small" onClick={() => navigate(`/admin/students/${r.id}`)}>View</Button>
//           <Button
//             size="small"
//             onClick={() => {
//               setEditing(r)
//               setForm({
//                 admissionNumber: r.admissionNumber,
//                 studentName: r.studentName,
//                 parentName: r.parentName,
//                 address1: r.address1,
//                 address2: r.address2 || '',
//                 city: r.city,
//                 state: r.state,
//                 zipcode: r.zipcode,
//                 houseColor: r.houseColor,
//                 phone: r.phone || '',
//                 isActive: r.isActive,
//               })
//               setFormOpen(true)
//             }}
//           >
//             Edit
//           </Button>
//           <Button size="small" color="error" onClick={() => setDeleteId(r.id)}>Delete</Button>
//         </Stack>
//       ),
//     },
//   ]

//   return (
//     <>
//       <PageHeader
//         title="Students"
//         subtitle="Import Excel, manage kit access and catalog overrides."
//         actions={
//           <>
//             <Button startIcon={<DownloadOutlinedIcon />} href="/api/admin/students/template">Template</Button>
//             <Button startIcon={<DownloadOutlinedIcon />} href="/api/admin/students/export">Export CSV</Button>
//             <Button
//               variant="outlined"
//               startIcon={<UploadFileOutlinedIcon />}
//               onClick={() => {
//                 setImportOpen(true)
//                 setImportStep(0)
//                 setImportFile(null)
//                 setPreview(null)
//               }}
//             >
//               Import Excel
//             </Button>
//             <Button
//               variant="contained"
//               startIcon={<AddOutlinedIcon />}
//               onClick={() => {
//                 setEditing(null)
//                 setForm(emptyForm)
//                 setFormOpen(true)
//               }}
//             >
//               Add student
//             </Button>
//           </>
//         }
//       />

//       <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
//         <TextField
//           size="small"
//           placeholder="Search admission / name / parent"
//           value={filters.search}
//           onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
//           sx={{ flex: 1 }}
//         />
//         <TextField select size="small" label="House" value={filters.houseColor} onChange={(e) => setFilters((f) => ({ ...f, houseColor: e.target.value }))} sx={{ minWidth: 140 }}>
//           <MenuItem value="">All</MenuItem>
//           {['Red', 'Yellow', 'Green', 'Blue'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
//         </TextField>
//         <TextField select size="small" label="Kit" value={filters.kitStatus} onChange={(e) => setFilters((f) => ({ ...f, kitStatus: e.target.value }))} sx={{ minWidth: 140 }}>
//           <MenuItem value="">All</MenuItem>
//           <MenuItem value="pending">Pending</MenuItem>
//           <MenuItem value="ordered">Ordered</MenuItem>
//         </TextField>
//         <TextField select size="small" label="Active" value={filters.isActive} onChange={(e) => setFilters((f) => ({ ...f, isActive: e.target.value }))} sx={{ minWidth: 120 }}>
//           <MenuItem value="">All</MenuItem>
//           <MenuItem value="true">Active</MenuItem>
//           <MenuItem value="false">Inactive</MenuItem>
//         </TextField>
//       </Stack>

//       <DataTable
//         columns={columns}
//         rows={items}
//         loading={loading}
//         error={error}
//         page={page}
//         pageSize={pageSize}
//         total={pagination.total || 0}
//         onPageChange={setPage}
//         onPageSizeChange={(n) => { setPageSize(n); setPage(0) }}
//         onRowClick={(r) => navigate(`/admin/students/${r.id}`)}
//       />

//       <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
//         <DialogTitle>{editing ? 'Edit student' : 'Add student'}</DialogTitle>
//         <Box component="form" onSubmit={saveStudent}>
//           <DialogContent>
//             <Stack spacing={2}>
//               {[
//                 ['admissionNumber', 'Admission number'],
//                 ['studentName', 'Student name'],
//                 ['parentName', 'Parent name'],
//                 ['address1', 'Address 1'],
//                 ['address2', 'Address 2'],
//                 ['city', 'City'],
//                 ['state', 'State'],
//                 ['zipcode', 'Zipcode'],
//                 ['phone', 'Phone'],
//               ].map(([key, label]) => (
//                 <TextField
//                   key={key}
//                   label={label}
//                   required={key !== 'address2' && key !== 'phone'}
//                   value={form[key]}
//                   onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
//                   fullWidth
//                 />
//               ))}
//               <TextField
//                 select
//                 label="House color"
//                 required
//                 fullWidth
//                 value={form.houseColor}
//                 onChange={(e) => setForm((f) => ({ ...f, houseColor: e.target.value }))}
//               >
//                 {['Red', 'Yellow', 'Green', 'Blue'].map((c) => (
//                   <MenuItem key={c} value={c}>{c}</MenuItem>
//                 ))}
//               </TextField>
//               <FormControlLabel
//                 control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />}
//                 label="Active"
//               />
//             </Stack>
//           </DialogContent>
//           <DialogActions>
//             <Button onClick={() => setFormOpen(false)}>Cancel</Button>
//             <Button type="submit" variant="contained">Save</Button>
//           </DialogActions>
//         </Box>
//       </Dialog>

//       <ConfirmDialog
//         open={Boolean(deleteId)}
//         title="Delete student?"
//         message="This cannot be undone if the student has no orders."
//         onClose={() => setDeleteId(null)}
//         onConfirm={async () => {
//           try {
//             await deleteStudent(deleteId)
//             showToast('Deleted', 'success')
//             setDeleteId(null)
//             reload()
//           } catch (err) {
//             showToast(err.response?.data?.message || 'Delete failed', 'error')
//           }
//         }}
//       />

//       <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="md" fullWidth>
//         <DialogTitle>Import students</DialogTitle>
//         <DialogContent>
//           <Stepper activeStep={importStep} sx={{ mb: 3 }}>
//             <Step><StepLabel>Upload</StepLabel></Step>
//             <Step><StepLabel>Preview</StepLabel></Step>
//             <Step><StepLabel>Done</StepLabel></Step>
//           </Stepper>
//           {importStep === 0 && (
//             <Button variant="outlined" component="label">
//               Choose .xlsx / .xls / .csv
//               <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onPreview(e.target.files[0])} />
//             </Button>
//           )}
//           {importStep >= 1 && preview && (
//             <Box>
//               <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
//                 {[
//                   ['New', preview.counts.new],
//                   ['Will update', preview.counts.willUpdate],
//                   ['Invalid', preview.counts.invalid],
//                   ['Dupes', preview.counts.duplicateInFile],
//                 ].map(([label, value]) => (
//                   <Box key={label} sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
//                     <Typography variant="caption" color="text.secondary">{label}</Typography>
//                     <Typography variant="h6">{value}</Typography>
//                   </Box>
//                 ))}
//               </Stack>
//               <Typography variant="subtitle2" sx={{ mb: 1 }}>First 20 rows</Typography>
//               <DataTable
//                 columns={[
//                   { id: 'rowNumber', label: '#', render: (r) => r.rowNumber },
//                   { id: 'admissionNumber', label: 'Admission', render: (r) => r.admissionNumber },
//                   { id: 'studentName', label: 'Name', render: (r) => r.studentName },
//                   { id: 'houseColor', label: 'House', render: (r) => r.houseColor },
//                 ]}
//                 rows={preview.previewRows || []}
//                 loading={false}
//               />
//               {preview.rowErrors?.length > 0 && (
//                 <Box sx={{ mt: 2 }}>
//                   <Typography color="error" fontWeight={600}>Row errors</Typography>
//                   {preview.rowErrors.slice(0, 20).map((e) => (
//                     <Typography key={e.row} variant="body2" color="error">
//                       Row {e.row}: {(e.messages || []).join('; ')}
//                     </Typography>
//                   ))}
//                 </Box>
//               )}
//             </Box>
//           )}
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setImportOpen(false)}>Close</Button>
//           {importStep === 1 && (
//             <Button variant="contained" disabled={importing} onClick={onCommit}>
//               {importing ? 'Importing…' : 'Confirm import'}
//             </Button>
//           )}
//         </DialogActions>
//       </Dialog>
//     </>
//   )
// }
