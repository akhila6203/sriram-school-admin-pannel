import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { getImageUrl } from '../utils/imageUrl'
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import TableIconActions from '../components/TableIconActions'
import usePaginatedList from '../hooks/usePaginatedList'
import { useSnackbar } from '../context/SnackbarContext'
import { useRegisterPageHeader } from '../context/PageHeaderContext'
import { formatDate, formatINR } from '../utils/format'
import {
  bulkProductStatus,
  deleteProduct,
  listCategories,
  listProducts,
  updateProduct,
} from '../api/catalog'

function stockStatus(p) {
  if (Number(p.totalStock) <= 0) return 'out'
  if (p.stockStatus === 'low' || Number(p.totalStock) <= 5) return 'low'
  return 'in stock'
}

export default function Products() {
  const { showToast } = useSnackbar()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ search: '', categoryId: '', status: '', stockFilter: '' })
  const [categories, setCategories] = useState([])
  const [selected, setSelected] = useState([])
  const [deleteId, setDeleteId] = useState(null)

 useRegisterPageHeader(
  {
    title: 'Products',
    subtitle: '',
    backTo: null,
  },
  []
)

  const fetcher = useMemo(() => (params) => listProducts(params), [])
  const { items, pagination, loading, error, page, pageSize, setPage, setPageSize, reload } =
    usePaginatedList(fetcher, filters)

  useEffect(() => {
    listCategories()
      .then((r) => setCategories(r.data.items || []))
      .catch(() => {})
  }, [])

  const allChecked = items.length > 0 && selected.length === items.length

  return (
    <>
      {/* <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button
          component={RouterLink}
          to="/admin/products/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          Add Product
        </Button>
      </Stack> */}
      
<Box
  sx={{
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-end',
    mb: 3,
  }}
>
  <Button
    component={RouterLink}
    to="/admin/products/new"
    variant="contained"
    startIcon={<AddIcon />}
    sx={{
      ml: 'auto',
      minWidth: 155,
      borderRadius: 2,
      textTransform: 'none',
      px: 3,
      py: 1.2,
      fontWeight: 600,
    }}
  >
    Add Product
  </Button>
</Box>


      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField
          placeholder="Search name / SKU"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          sx={{ minWidth: 220, flex: 1 }}
        />
        <TextField
          select
          label="Category"
          value={filters.categoryId}
          onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Status"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          sx={{ minWidth: 130 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="archived">Archived</MenuItem>
        </TextField>
        <TextField
          select
          label="Stock"
          value={filters.stockFilter}
          onChange={(e) => setFilters((f) => ({ ...f, stockFilter: e.target.value }))}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="in">In stock</MenuItem>
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="out">Out</MenuItem>
        </TextField>
      </Stack>

      {selected.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {['active', 'draft', 'archived'].map((s) => (
            <Button
              key={s}
              size="small"
              variant="outlined"
              onClick={async () => {
                await bulkProductStatus(selected, s)
                showToast(`Set ${selected.length} to ${s}`, 'success')
                setSelected([])
                reload()
              }}
            >
              Set {s}
            </Button>
          ))}
        </Stack>
      )}

      <DataTable
        columns={[
          {
            id: 'select',
            label: (
              <Checkbox
                size="small"
                checked={allChecked}
                onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])}
                onClick={(e) => e.stopPropagation()}
              />
            ),
            width: 48,
            render: (r) => (
              <Checkbox
                size="small"
                checked={selected.includes(r.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() =>
                  setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))
                }
              />
            ),
          },
          { id: 'id', label: 'ID', width: 56, render: (r) => r.id },
          {
            id: 'image',
            label: 'Image',
            width: 64,
            render: (r) => (
              // <Avatar variant="rounded" src={r.primaryImage || undefined} alt="" sx={{ width: 40, height: 40 }}>
              //   —
              // </Avatar>
              <Avatar
  variant="rounded"
  src={getImageUrl(r.primaryImage) || undefined}
  alt=""
  sx={{ width: 40, height: 40 }}
>
  —
</Avatar>
            ),
          },
          { id: 'name', label: 'Name', render: (r) => r.name },
          { id: 'sku', label: 'SKU', render: (r) => r.sku || '—' },
          {
  id: 'classes',
  label: 'Class',
  width: 110,
  render: (r) => {
    const classes = r.classes ?? r.eligibility?.classes;

    return Array.isArray(classes)
      ? classes.length
        ? classes.join(', ')
        : '—'
      : classes || '—';
  },
},

{
  id: 'gender',
  label: 'Gender',
  width: 130,
  render: (r) => {
    const gender = r.gender ?? r.eligibility?.gender;

    return {
      boys: 'Boys',
      girls: 'Girls',
      both: 'Both Boys and Girls',
      unisex: 'Unisex',
    }[String(gender || '').toLowerCase()] || gender || '—';
  },
},
          { id: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { id: 'categories', label: 'Categories', render: (r) => r.categoryName },
          {
            id: 'price',
            label: 'Price range',
            render: (r) =>
              r.minPrice === r.maxPrice
                ? formatINR(r.minPrice ?? r.basePrice)
                : `${formatINR(r.minPrice)} – ${formatINR(r.maxPrice)}`,
          },
          { id: 'stock', label: 'Total stock', render: (r) => r.totalStock },
          {
            id: 'stockStatus',
            label: 'Stock',
            render: (r) => <StatusBadge status={stockStatus(r)} />,
          },
          {
            id: 'visible',
            label: 'Visible individually',
            render: (r) => (
              <Switch
                size="small"
                checked={Boolean(r.visibleIndividually)}
                onClick={(e) => e.stopPropagation()}
                onChange={async (e) => {
                  await updateProduct(r.id, { visibleIndividually: e.target.checked })
                  reload()
                }}
              />
            ),
          },
          { id: 'gst', label: 'GST', render: (r) => `${Number(r.gstRate ?? r.taxPercent ?? 0)}%` },
          { id: 'created', label: 'Created', render: (r) => formatDate(r.createdAt) },
          {
            id: 'actions',
            label: 'Actions',
            align: 'right',
            width: 120,
            render: (r) => (
              <Box onClick={(e) => e.stopPropagation()}>
                <TableIconActions
                  viewLabel="View Product"
                  editLabel="Edit Product"
                  deleteLabel="Delete Product"
                  onView={() => navigate(`/admin/products/${r.id}`)}
                  onEdit={() => navigate(`/admin/products/${r.id}/edit`)}
                  onDelete={() => setDeleteId(r.id)}
                />
              </Box>
            ),
          },
        ]}
        rows={items}
        loading={loading}
        error={error}
        page={page}
        pageSize={pageSize}
        total={pagination.total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onRowClick={(r) => navigate(`/admin/products/${r.id}`)}
        emptyTitle="No products"
        emptyDescription="Add a product with variants to start selling."
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete product?"
        message="Products that appear on orders cannot be deleted — archive them instead."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          try {
            await deleteProduct(deleteId)
            showToast('Deleted', 'success')
            setDeleteId(null)
            reload()
          } catch (err) {
            showToast(err.response?.data?.message || 'Delete failed', 'error')
          }
        }}
      />
    </>
  )
}
