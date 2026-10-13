import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import TableIconActions from '../components/TableIconActions'
import { useSnackbar } from '../context/SnackbarContext'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/catalog'

const empty = { name: '', sortOrder: 0, isActive: true }

export default function Categories() {
  const { showToast } = useSnackbar()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [deleteId, setDeleteId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await listCategories()
      setItems(res.data.items || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onSave(e) {
    e.preventDefault()
    try {
      if (editing) await updateCategory(editing.id, form)
      else await createCategory(form)
      showToast(editing ? 'Category updated' : 'Category created', 'success')
      setFormOpen(false)
      setEditing(null)
      setForm(empty)
      load()
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error')
    }
  }

  return (
    <>
     
<Box
  sx={{
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    mb: 3,
  }}
>
  <Button
    variant="contained"
    startIcon={<AddIcon />}
    onClick={() => {
      setEditing(null)
      setForm({ ...empty })
      setFormOpen(true)
    }}
    sx={{
      ml: 'auto',
      borderRadius: 2,
      textTransform: 'none',
      px: 3,
      py: 1.2,
      fontWeight: 600,
    }}
  >
    Add Category
  </Button>
</Box>


      <DataTable
        columns={[
          { id: 'name', label: 'Name', render: (r) => r.name },
          { id: 'slug', label: 'Slug', render: (r) => r.slug },
          { id: 'sortOrder', label: 'Sort', render: (r) => r.sortOrder },
          {
            id: 'isActive',
            label: 'Status',
            render: (r) => <StatusBadge status={r.isActive ? 'active' : 'archived'} />,
          },
          {
            id: 'actions',
            label: 'Actions',
            align: 'right',
            width: 100,
            render: (r) => (
              <Box onClick={(e) => e.stopPropagation()}>
                <TableIconActions
                  editLabel="Edit Category"
                  deleteLabel="Delete Category"
                  onEdit={() => {
                    setEditing(r)
                    setForm({ name: r.name, sortOrder: r.sortOrder, isActive: r.isActive })
                    setFormOpen(true)
                  }}
                  onDelete={() => setDeleteId(r.id)}
                />
              </Box>
            ),
          },
        ]}
        rows={items}
        loading={loading}
        error={error}
        emptyTitle="No categories yet"
        emptyDescription="Create a category to group products."
      />

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
        <Box component="form" onSubmit={onSave}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Name"
                required
                fullWidth
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <TextField
                label="Sort order"
                type="number"
                fullWidth
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete category?"
        message="Categories with products cannot be deleted — deactivate them instead."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          try {
            await deleteCategory(deleteId)
            showToast('Deleted', 'success')
            setDeleteId(null)
            load()
          } catch (err) {
            showToast(err.response?.data?.message || 'Delete failed', 'error')
          }
        }}
      />
    </>
  )
}
