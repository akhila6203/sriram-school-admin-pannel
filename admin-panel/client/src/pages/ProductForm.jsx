import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import FormSectionCard from '../components/FormSectionCard'
import { useRegisterPageHeader } from '../context/PageHeaderContext'
import ProductImageGallery from '../components/ProductImageGallery'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { useSnackbar } from '../context/SnackbarContext'
import {
  activeVariants,
  priceRangeFromVariants,
  totalStockFromVariants,
} from '../utils/productDisplay'
import { formatINR } from '../utils/format'
import {
  createProduct,
  deleteProductImage,
  getProduct,
  listCategories,
  reorderProductImages,
  updateProduct,
  uploadProductImages,
} from '../api/catalog'

import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

const GST_RATES = [0, 5, 12, 18, 28]

const CLASS_OPTIONS = [
  "Nursery", "LKG", "UKG",
  "1", "2", "3", "4", "5",
  "6", "7", "8", "9", "10",
];

const GENDER_OPTIONS = [
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
  { value: "both", label: "Both Boys and Girls" },
  { value: "unisex", label: "Unisex" },
];

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function variantKey(v) {
  return `${v.option1Value || ''}|${v.option2Value || ''}`
}

export default function ProductForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { showToast } = useSnackbar()
  const [categories, setCategories] = useState([])
  const [images, setImages] = useState([])
  const [pendingImages, setPendingImages] = useState([])
  const [opt1Values, setOpt1Values] = useState('S,M,L,XL')
  const [showSecondOption, setShowSecondOption] = useState(false)
  const [opt2Name, setOpt2Name] = useState('Color')
  const [opt2Values, setOpt2Values] = useState('')
  const lastBasePriceRef = useRef(0)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    categoryId: '',
    brand: '',
    status: 'draft',
    basePrice: 0,
    compareAtPrice: '',
    hsnCode: '',
    gstRate: 5,
    priceIncludesGst: true,
    taxPercent: 5,
    visibleIndividually: true,
    includeInKit: true,
    classes: [],
gender: "both",
    variants: [],
  })
  const [saving, setSaving] = useState(false)

  const [selectedClass, setSelectedClass] = useState("");
const [customClass, setCustomClass] = useState("");

  const [loading, setLoading] = useState(!isNew)

  // useRegisterPageHeader(
  //   {
  //     title: isNew ? 'Add Product' : 'Edit Product',
  //     subtitle: isNew
  //       ? 'Create a product with shared images and size-based stock.'
  //       : 'Update details, pricing, images, and size variants.',
  //     backTo: '/admin/products',
  //   },
  //   [isNew]
  // )
useRegisterPageHeader(
  {
    title: isNew ? 'Add Product' : 'Edit Product',
    subtitle: '',
    backTo: null,
  },
  [isNew]
)

  useEffect(() => {
    listCategories().then((r) => {
      setCategories(r.data.items || [])
      if (isNew && r.data.items?.[0]) {
        setForm((f) => ({ ...f, categoryId: String(r.data.items[0].id) }))
      }
    })
  }, [isNew])

  useEffect(() => {
    if (isNew) return
    getProduct(id)
      .then((res) => {
        const p = res.data.product
        const variants = res.data.variants || []
        const hasColor = variants.some((v) => v.option2Value)
        setShowSecondOption(hasColor)
        if (hasColor && variants[0]?.option2Name) setOpt2Name(variants[0].option2Name)
        if (hasColor) {
          const vals = [...new Set(variants.map((v) => v.option2Value).filter(Boolean))]
          setOpt2Values(vals.join(','))
        }
        const sizes = [...new Set(variants.map((v) => v.option1Value).filter(Boolean))]
        if (sizes.length) setOpt1Values(sizes.join(','))

        setForm({
          name: p.name,
          slug: p.slug,
          description: p.description || '',
          categoryId: String(p.categoryId),
          brand: p.brand || '',
          status: p.status,
          basePrice: p.basePrice,
          compareAtPrice: p.compareAtPrice ?? '',
          hsnCode: p.hsnCode || '',
          gstRate: Number(p.gstRate ?? p.taxPercent ?? 5),
          priceIncludesGst: p.priceIncludesGst !== false,
          taxPercent: Number(p.gstRate ?? p.taxPercent ?? 5),
          visibleIndividually: p.visibleIndividually,
          includeInKit: p.includeInKit !== false,
          classes: res.data.eligibility?.classes || [],
gender: res.data.eligibility?.gender || "both",
          variants,
        })
        lastBasePriceRef.current = Number(p.basePrice)
        setImages(res.data.images || [])
      })
      .catch((err) => showToast(err.response?.data?.message || 'Failed to load', 'error'))
      .finally(() => setLoading(false))
  }, [id, isNew, showToast])

  const matrixPreview = useMemo(() => {
    const v1 = opt1Values.split(',').map((x) => x.trim()).filter(Boolean)
    const v2 = showSecondOption ? opt2Values.split(',').map((x) => x.trim()).filter(Boolean) : []
    const rows = []
    for (const a of v1) {
      if (!v2.length) {
        rows.push({ option1Name: 'Size', option1Value: a, option2Name: null, option2Value: null })
      } else {
        for (const b of v2) {
          rows.push({
            option1Name: 'Size',
            option1Value: a,
            option2Name: opt2Name,
            option2Value: b,
          })
        }
      }
    }
    return rows
  }, [opt1Values, opt2Name, opt2Values, showSecondOption])

  const totals = useMemo(() => {
    const stock = totalStockFromVariants(form.variants)
    const { min, max } = priceRangeFromVariants(form.variants, form.basePrice)
    const active = activeVariants(form.variants).length
    return { stock, min, max, active }
  }, [form.variants, form.basePrice])

  function generateVariants() {
    const base = slugify(form.name || 'SKU').toUpperCase().replace(/-/g, '').slice(0, 12)
    const byKey = new Map(form.variants.map((v) => [variantKey(v), v]))
    const previewKeys = new Set(matrixPreview.map((row) => variantKey(row)))

    const next = matrixPreview.map((row) => {
      const key = variantKey(row)
      const prev = byKey.get(key)
      if (prev) {
        return {
          ...prev,
          option1Name: row.option1Name,
          option1Value: row.option1Value,
          option2Name: row.option2Name,
          option2Value: row.option2Value,
        }
      }
      return {
        sku: [base, row.option1Value, row.option2Value ? String(row.option2Value).toUpperCase().slice(0, 3) : null]
          .filter(Boolean)
          .join('-'),
        ...row,
        priceOverride: null,
        stockQty: 0,
        lowStockThreshold: 5,
        barcode: '',
        imageUrl: '',
        isActive: true,
      }
    })

    if (!isNew) {
      for (const v of form.variants) {
        if (v.id && !previewKeys.has(variantKey(v))) {
          next.push(v)
        }
      }
    }

    setForm((f) => ({ ...f, variants: next }))
    showToast(`Generated ${matrixPreview.length} size variant(s)`, 'success')
  }

  function patchVariant(idx, patch) {
    const variants = [...form.variants]
    variants[idx] = { ...variants[idx], ...patch }
    setForm((f) => ({ ...f, variants }))
  }

  function handleSalePriceChange(value) {
    const num = value === '' ? 0 : Number(value)
    const prevDefault = lastBasePriceRef.current
    setForm((f) => ({
      ...f,
      basePrice: value,
      variants: f.variants.map((v) => {
        if (v.priceOverride == null || v.priceOverride === '') return v
        if (Number(v.priceOverride) === prevDefault) {
          return { ...v, priceOverride: null }
        }
        return v
      }),
    }))
    lastBasePriceRef.current = num
  }

  async function onSave(e) {
    e?.preventDefault?.()
    if (!form.name.trim()) {
      showToast('Product name is required', 'error')
      return
    }
    if (!form.categoryId) {
      showToast('Please select a category', 'error')
      return
    }
    if (!form.classes.length) {
  showToast("Please select at least one class", "error");
  return;
}
    const mrp = form.compareAtPrice === '' ? null : Number(form.compareAtPrice)
    const sale = Number(form.basePrice)
    if (mrp != null && mrp > 0 && sale > mrp) {
      showToast('Sale price cannot be higher than MRP', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        compareAtPrice: form.compareAtPrice === '' ? null : Number(form.compareAtPrice),
        basePrice: Number(form.basePrice),
        gstRate: Number(form.gstRate),
        taxPercent: Number(form.gstRate),
        hsnCode: form.hsnCode || null,
        variants: form.variants,
      }

      if (isNew) {
        const res = await createProduct(payload)
        const productId = res.data.product.id
        if (pendingImages.length) {
          await uploadProductImages(productId, pendingImages)
        }
        showToast('Product saved', 'success')
        navigate('/admin/products')
      } else {
        await updateProduct(id, payload)
        showToast('Product saved', 'success')
        navigate('/admin/products')
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingSkeleton rows={8} />
  }

  return (
    <>
      <Stack
        spacing={3}
        id="product-form"
        component="form"
        onSubmit={onSave}
        sx={{ pb: 4, maxWidth: 960 }}
      >
  


        
<Box
  sx={{
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 1.5,
    mb: 2,
  }}
>
  <Button
    variant="outlined"
    onClick={() => navigate('/admin/products')}
    sx={{
      ml: 'auto',
      borderRadius: 2,
      textTransform: 'none',
      px: 3,
      py: 1.2,
    }}
  >
    Cancel
  </Button>

  <Button
    variant="contained"
    type="submit"
    disabled={saving}
    sx={{
      borderRadius: 2,
      textTransform: 'none',
      px: 3,
      py: 1.2,
      fontWeight: 600,
    }}
  >
    {saving ? 'Saving…' : 'Save Product'}
  </Button>
</Box>


        <FormSectionCard title="Product Information">
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Product Name"
                required
                fullWidth
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: isNew ? slugify(e.target.value) : f.slug,
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Brand"
                fullWidth
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="GST"
                fullWidth
                value={form.gstRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gstRate: Number(e.target.value), taxPercent: Number(e.target.value) }))
                }
              >
                {GST_RATES.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}%
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Description"
                fullWidth
                multiline
                minRows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="Category"
                required
                fullWidth
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="Status"
                fullWidth
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Slug"
                fullWidth
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              />
            </Grid>

            {/* CLASS + GENDER - SIDE BY SIDE */}
<Grid size={{ xs: 12, md: 6 }}>
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
    <TextField
  select
  fullWidth
  label="Applicable Class"
  value={selectedClass}
  onChange={(e) => {
    const value = e.target.value;

    if (value === "other") {
      setSelectedClass("other");
      return;
    }

    if (value) {
      setForm((f) => ({
        ...f,
        classes: [...new Set([...f.classes, value])],
      }));
    }

    setSelectedClass("");
  }}
  SelectProps={{
    MenuProps: {
      disableAutoFocusItem: true,
      MenuListProps: {
        autoFocusItem: false,
      },
      PaperProps: {
        sx: {
          maxHeight: 300,
          overflowY: "auto",
        },
      },
    },
  }}
>
  <MenuItem value="">Select Class</MenuItem>

  {CLASS_OPTIONS.map((value) => (
    <MenuItem key={value} value={value}>
      {["Nursery", "LKG", "UKG"].includes(value)
        ? value
        : `Class ${value}`}
    </MenuItem>
  ))}

  <MenuItem value="other">
    Other (Enter Manually)
  </MenuItem>
</TextField>
    {/* <TextField
      select
      fullWidth
      label="Applicable Class"
      value={selectedClass}
      onChange={(e) => {
        const value = e.target.value;
        setSelectedClass(value);

        if (value !== "other" && value) {
          setForm((f) => ({
            ...f,
            classes: [...new Set([...f.classes, value])],
          }));
          setSelectedClass("");
        }
      }}
    >
      <MenuItem value="">Select Class</MenuItem>

      {CLASS_OPTIONS.map((value) => (
        <MenuItem key={value} value={value}>
          {["Nursery", "LKG", "UKG"].includes(value)
            ? value
            : `Class ${value}`}
        </MenuItem>
      ))}

      <MenuItem value="other">Other (Enter Manually)</MenuItem>
    </TextField> */}

    {selectedClass === "other" && (
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          label="Enter Other Class"
          value={customClass}
          onChange={(e) => setCustomClass(e.target.value)}
        />

        <Button
          variant="contained"
          onClick={() => {
            const value = customClass.trim();
            if (!value) return;

            setForm((f) => ({
              ...f,
              classes: [...new Set([...f.classes, value])],
            }));

            setCustomClass("");
            setSelectedClass("");
          }}
        >
          Add
        </Button>
      </Box>
    )}

    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      {form.classes.map((value) => (
        <Button
          key={value}
          size="small"
          variant="outlined"
          onClick={() =>
            setForm((f) => ({
              ...f,
              classes: f.classes.filter((c) => c !== value),
            }))
          }
        >
          {value} ×
        </Button>
      ))}
    </Box>
  </Box>
</Grid>

<Grid size={{ xs: 12, md: 6 }}>
  <TextField
    select
    fullWidth
    label="Applicable Gender"
    value={form.gender}
    onChange={(e) =>
      setForm((f) => ({
        ...f,
        gender: e.target.value,
      }))
    }
  >
    {GENDER_OPTIONS.map((option) => (
      <MenuItem key={option.value} value={option.value}>
        {option.label}
      </MenuItem>
    ))}
  </TextField>
</Grid>
          </Grid>
        </FormSectionCard>

        <FormSectionCard title="Product Images" description="Images apply to all size variants.">
          <ProductImageGallery
            images={isNew ? [] : images}
            pendingFiles={pendingImages}
            onAddPending={(files, err) => {
              if (err) {
                showToast(err, 'error')
                return
              }
              if (isNew) {
                setPendingImages((p) => [...p, ...files])
                return
              }
              uploadProductImages(id, files)
                .then((res) => {
                  setImages((imgs) => [...imgs, ...res.data.images])
                  showToast('Images uploaded', 'success')
                })
                .catch((e) => showToast(e.response?.data?.message || 'Upload failed', 'error'))
            }}
            onRemovePending={(idx) => setPendingImages((p) => p.filter((_, i) => i !== idx))}
            {...(!isNew && {
              onMakePrimary: async (img) => {
                const next = images.map((im) => ({
                  id: im.id,
                  sortOrder: im.sortOrder,
                  isPrimary: im.id === img.id,
                }))
                await reorderProductImages(id, next)
                setImages((imgs) => imgs.map((im) => ({ ...im, isPrimary: im.id === img.id })))
              },
              onReorder: async (from, to) => {
                const next = [...images]
                ;[next[from], next[to]] = [next[to], next[from]]
                setImages(next)
                await reorderProductImages(
                  id,
                  next.map((im, i) => ({ id: im.id, sortOrder: i, isPrimary: im.isPrimary }))
                )
              },
              onDeleteSaved: async (img) => {
                await deleteProductImage(id, img.id)
                setImages((imgs) => imgs.filter((i) => i.id !== img.id))
              },
            })}
          />
        </FormSectionCard>

        <FormSectionCard title="Price & Tax">
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                type="number"
                label="MRP / Regular Price (₹)"
                fullWidth
                value={form.compareAtPrice}
                onChange={(e) => setForm((f) => ({ ...f, compareAtPrice: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                type="number"
                label="Sale Price (₹)"
                fullWidth
                required
                value={form.basePrice}
                onChange={(e) => handleSalePriceChange(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="GST (Included)"
                fullWidth
                value={`${form.gstRate}% Included`}
                InputProps={{ readOnly: true }}
                helperText="GST applies to the whole product"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Total Stock"
                fullWidth
                value={totals.stock}
                InputProps={{ readOnly: true }}
                helperText="Sum of active variant stock"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="HSN code (optional)"
                fullWidth
                value={form.hsnCode}
                onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
                sx={{ maxWidth: 280 }}
              />
            </Grid>
          </Grid>
        </FormSectionCard>

        <FormSectionCard title="Size Variants">
          <Stack spacing={2.5}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Option Name" fullWidth value="Size" InputProps={{ readOnly: true }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <TextField
                  label="Option Values"
                  fullWidth
                  value={opt1Values}
                  onChange={(e) => setOpt1Values(e.target.value)}
                  helperText="Comma-separated, e.g. S,M,L,XL"
                />
              </Grid>
            </Grid>

            {showSecondOption && !isNew && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField label="Option 2 name" value={opt2Name} onChange={(e) => setOpt2Name(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField
                    label="Option 2 values"
                    fullWidth
                    value={opt2Values}
                    onChange={(e) => setOpt2Values(e.target.value)}
                    helperText="Existing color variants on this product"
                  />
                </Grid>
              </Grid>
            )}

            <Button variant="outlined" onClick={generateVariants} sx={{ alignSelf: 'flex-start' }}>
              Generate Matrix ({matrixPreview.length})
            </Button>

            <Stack spacing={2}>
              {form.variants.map((v, idx) => (
                <Box
                  key={v.id || `${v.sku}-${idx}`}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                    Size: {[v.option1Value, v.option2Value].filter(Boolean).join(' / ')}
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <TextField
                        label="SKU"
                        size="small"
                        fullWidth
                        value={v.sku}
                        onChange={(e) => patchVariant(idx, { sku: e.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <TextField
                        label="Barcode"
                        size="small"
                        fullWidth
                        value={v.barcode || ''}
                        onChange={(e) => patchVariant(idx, { barcode: e.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                      <TextField
                        type="number"
                        label="Price Override"
                        size="small"
                        fullWidth
                        placeholder={String(form.basePrice)}
                        value={v.priceOverride ?? ''}
                        onChange={(e) =>
                          patchVariant(idx, { priceOverride: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        helperText={
                          v.priceOverride == null || v.priceOverride === ''
                            ? formatINR(form.basePrice)
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                      <TextField
                        type="number"
                        label="Stock"
                        size="small"
                        fullWidth
                        value={v.stockQty ?? 0}
                        disabled={Boolean(v.id)}
                        helperText={v.id ? 'Use Inventory page' : ''}
                        onChange={(e) => patchVariant(idx, { stockQty: Number(e.target.value) })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                      <TextField
                        type="number"
                        label="Low Stock"
                        size="small"
                        fullWidth
                        value={v.lowStockThreshold ?? 5}
                        onChange={(e) => patchVariant(idx, { lowStockThreshold: Number(e.target.value) })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={v.isActive !== false}
                            onChange={(e) => patchVariant(idx, { isActive: e.target.checked })}
                          />
                        }
                        label="Active"
                      />
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Stack>

            {form.variants.length > 0 && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ pt: 1, color: 'text.secondary' }}
                flexWrap="wrap"
                useFlexGap
              >
                <Typography variant="body2">Total Stock: {totals.stock}</Typography>
                <Typography variant="body2">
                  Lowest Selling Price: {formatINR(totals.min)}
                  {totals.min !== totals.max ? ` (${formatINR(totals.max)} max)` : ''}
                </Typography>
                <Typography variant="body2">Active Variants: {totals.active}</Typography>
              </Stack>
            )}
          </Stack>
        </FormSectionCard>
      </Stack>
    </>
  )
}
