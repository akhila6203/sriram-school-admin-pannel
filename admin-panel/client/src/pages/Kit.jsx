
import { useEffect, useMemo, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip,
  CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, IconButton,
  MenuItem, Stack, Switch, TextField, Typography,
  Autocomplete
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";

import { useSnackbar } from "../context/SnackbarContext";
import { formatINR } from "../utils/format";

import {
  listKits,
  getKitById,
  listKitProducts,
  createKit,
  updateKit,
  setKitActive,
  deleteKit,
  uploadKitImage,
} from "../api/kits";

const GENDERS = ["Boys", "Girls", "Unisex"];

const emptyForm = () => ({
  name: "",
  className: "",
  gender: "Boys",
  price: "",
  description: "",
  isActive: true,
  imageUrl: "",
  items: [],
});

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
  },
};

// Backend returns /uploads/filename.
// Keep this relative URL for the existing Vite proxy.
function imageSrc(value) {
  if (!value) return "";

  const path = String(value).trim().replace(/\\/g, "/");

  if (/^(https?:\/\/|blob:|data:)/i.test(path)) {
    return path;
  }

  return `/${path.replace(/^\/+/, "")}`;
}

function errorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function KitImage({ src, name, height = 190 }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <Box
      sx={{
        height,
        width: "100%",
        bgcolor: "#f3f5fb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {src && !failed ? (
        <Box
          component="img"
          src={imageSrc(src)}
          alt={name || "Kit"}
          onError={() => setFailed(true)}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <Typography
          color="text.disabled"
          sx={{ fontSize: 38 }}
        >
          ▧
        </Typography>
      )}
    </Box>
  );
}

export default function Kit() {
  const { showToast } = useSnackbar();

  const [kits, setKits] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [productDialog, setProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);

    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  async function loadData() {
    try {
      const [kitsResult, productsResult] = await Promise.all([
        listKits(),
        listKitProducts(),
      ]);

      setKits(kitsResult?.data?.items || []);
      setProducts(productsResult?.data?.items || []);
    } catch (error) {
      showToast(
        errorMessage(error, "Failed to load kits"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const change = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setImageFile(null);
    setSelectedProduct(null);
    setOpen(true);
  }

  async function startEdit(id) {
    setBusyId(id);

    try {
      const response = await getKitById(id);
      const kit = response?.data?.kit;
      const items = response?.data?.items || [];

      if (!kit) {
        throw new Error("Kit details not found");
      }

      setEditingId(id);

      setForm({
        ...emptyForm(),
        ...kit,
        className: kit.className || "",
        gender: kit.gender || "Boys",
        price: kit.price ?? "",
        imageUrl: kit.imageUrl || "",
        isActive: Boolean(kit.isActive),
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity || 1,
          studentPicksSize: Boolean(item.studentPicksSize),
          autoMatchHouseColor: Boolean(
            item.autoMatchHouseColor
          ),
        })),
      });

      // Existing image stays visible until replaced.
      setImageFile(null);
      setOpen(true);
    } catch (error) {
      showToast(
        errorMessage(error, "Failed to open kit"),
        "error"
      );
    } finally {
      setBusyId(null);
    }
  }

  function closePopup() {
    if (saving) return;

    setOpen(false);
    setImageFile(null);
    setSelectedProduct(null);
  }

  function selectImage(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Select a valid image", "error");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Maximum image size is 5 MB", "error");
      event.target.value = "";
      return;
    }

    setImageFile(file);
    event.target.value = "";
  }

  function addProduct() {
    if (!selectedProduct) return;

    const exists = form.items.some(
      (item) =>
        String(item.productId) ===
        String(selectedProduct.id)
    );

    if (exists) {
      showToast("Product already added", "error");
      return;
    }

    setForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity: 1,
          studentPicksSize: true,
          autoMatchHouseColor: false,
        },
      ],
    }));

    setSelectedProduct(null);
    setProductDialog(false);
  }

  function updateItem(productId, key, value) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        String(item.productId) === String(productId)
          ? { ...item, [key]: value }
          : item
      ),
    }));
  }

  function removeItem(productId) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.filter(
        (item) =>
          String(item.productId) !== String(productId)
      ),
    }));
  }

  async function saveKit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      showToast("Kit name required", "error");
      return;
    }

    if (!form.className.trim()) {
      showToast("Class required", "error");
      return;
    }

    if (
      form.price === "" ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      showToast("Enter valid bundle amount", "error");
      return;
    }

    if (!form.items.length) {
      showToast("Add at least one product", "error");
      return;
    }

    if (
      form.items.some(
        (item) =>
          item.quantity === "" ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1
      )
    ) {
      showToast("Enter valid product quantity", "error");
      return;
    }

    setSaving(true);

    let savedId = editingId;
    let kitSaved = false;

    try {
      const payload = {
        name: form.name.trim(),
        className: form.className.trim(),
        gender: form.gender,
        description: form.description || "",
        price: Number(form.price),
        isActive: Boolean(form.isActive),
        items: form.items.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          studentPicksSize: Boolean(item.studentPicksSize),
          autoMatchHouseColor: Boolean(
            item.autoMatchHouseColor
          ),
        })),
      };

      const response = editingId
        ? await updateKit(editingId, payload)
        : await createKit(payload);

      savedId =
        editingId ||
        response?.data?.id ||
        response?.data?.kit?.id;

      kitSaved = true;

      if (imageFile) {
        if (!savedId) {
          throw new Error(
            "Kit saved but image upload cannot start: missing kit ID"
          );
        }

        // Upload to the newly created or edited kit.
        await uploadKitImage(savedId, imageFile);
      }

      setOpen(false);
      setImageFile(null);

      await loadData();

      showToast(
        editingId
          ? "Kit updated successfully"
          : "Kit created successfully",
        "success"
      );
    } catch (error) {
      const message = errorMessage(
        error,
        "Unable to save kit"
      );

      if (kitSaved) {
        showToast(
          `Kit details saved, but image upload failed: ${message}`,
          "error"
        );

        // Keep popup open to retry image upload.
        // Switch to edit mode so another Save updates,
        // rather than creating a duplicate kit.
        if (savedId) {
          setEditingId(savedId);
        }

        await loadData();
      } else {
        showToast(message, "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function changeVisibility(kit, value) {
    setBusyId(kit.id);

    try {
      await setKitActive(kit.id, value);

      setKits((previous) =>
        previous.map((item) =>
          String(item.id) === String(kit.id)
            ? { ...item, isActive: value }
            : item
        )
      );

      showToast("Visibility updated", "success");
    } catch (error) {
      showToast(
        errorMessage(error, "Visibility update failed"),
        "error"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setBusyId(deleteTarget.id);

    try {
      await deleteKit(deleteTarget.id);

      setKits((previous) =>
        previous.filter(
          (kit) =>
            String(kit.id) !== String(deleteTarget.id)
        )
      );

      setDeleteTarget(null);
      showToast("Kit deleted successfully", "success");
    } catch (error) {
      showToast(
        errorMessage(error, "Unable to delete kit"),
        "error"
      );
    } finally {
      setBusyId(null);
    }
  }

  const classOptions = useMemo(
    () =>
      [...new Set(kits.map((kit) => kit.className).filter(Boolean))]
        .sort((a, b) =>
          String(a).localeCompare(String(b), undefined, {
            numeric: true,
          })
        ),
    [kits]
  );

  const filteredKits = useMemo(
    () =>
      kits.filter((kit) => {
        const text = [
          kit.name,
          kit.className,
          kit.gender,
        ]
          .join(" ")
          .toLowerCase();

        return (
          text.includes(search.trim().toLowerCase()) &&
          (!classFilter || kit.className === classFilter) &&
          (!genderFilter || kit.gender === genderFilter)
        );
      }),
    [kits, search, classFilter, genderFilter]
  );

  const availableProducts = products.filter(
    (product) =>
      !form.items.some(
        (item) =>
          String(item.productId) === String(product.id)
      )
  );

  return (
    <Box sx={{ width: "100%", pb: 5 }}>
      {/* FILTERS LEFT, ADD KIT RIGHT */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: { xs: "wrap", md: "nowrap" },
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0,1fr))",
              sm: "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)",
            },
            gap: 1.5,
            flex: 1,
            minWidth: 0,
          }}
        >
          <TextField
            size="small"
            placeholder="Search kits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              ...fieldSx,
              gridColumn: { xs: "1 / -1", sm: "auto" },
            }}
          />

          <TextField
            select
            size="small"
            label="Class"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">All Classes</MenuItem>
            {classOptions.map((value) => (
              <MenuItem key={value} value={value}>
                Class {value}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Gender"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">All Genders</MenuItem>
            {GENDERS.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Button
          variant="contained"
          onClick={startAdd}
          sx={{
            ml: "auto",
            px: 3,
            height: 42,
            borderRadius: 2,
            textTransform: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          + Add Kit
        </Button>
      </Box>

      {/* KIT CARDS */}
      {loading ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      ) : filteredKits.length === 0 ? (
        <Alert severity="info">No kits found.</Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2,minmax(0,1fr))",
              xl: "repeat(3,minmax(0,1fr))",
            },
            gap: 2.5,
          }}
        >
          {filteredKits.map((kit) => (
            <Card
              key={kit.id}
              variant="outlined"
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <KitImage
                src={kit.imageUrl}
                name={kit.name}
              />

              <CardContent
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  flexGrow: 1,
                  p: 2.3,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Typography
                    fontWeight={700}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {kit.name}
                  </Typography>

                  <Chip
                    label={kit.isActive ? "Active" : "Inactive"}
                    color={kit.isActive ? "success" : "default"}
                    size="small"
                  />
                </Stack>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  Class {kit.className || "N/A"} ·{" "}
                  {kit.gender || "N/A"} ·{" "}
                  {kit.itemCount || 0} items
                </Typography>

                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ mt: 1 }}
                >
                  {formatINR(kit.price)}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    mb: 2,
                    minHeight: 42,
                    overflowWrap: "anywhere",
                  }}
                >
                  {kit.description || "No description"}
                </Typography>

                <Box sx={{ flexGrow: 1 }} />
                <Divider sx={{ mb: 1.5 }} />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <FormControlLabel
                    sx={{ m: 0 }}
                    label={
                      <Typography variant="body2">
                        Visible
                      </Typography>
                    }
                    control={
                      <Switch
                        size="small"
                        checked={Boolean(kit.isActive)}
                        disabled={busyId === kit.id}
                        onChange={(e) =>
                          changeVisibility(
                            kit,
                            e.target.checked
                          )
                        }
                      />
                    }
                  />

                  <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
  <IconButton
    title="Edit Kit"
    aria-label="Edit Kit"
    disabled={busyId === kit.id}
    onClick={() => startEdit(kit.id)}
    sx={{ color: "#64748b" }}
  >
    <EditOutlinedIcon sx={{ fontSize: 22 }} />
  </IconButton>

  <IconButton
    title="Delete Kit"
    aria-label="Delete Kit"
    disabled={busyId === kit.id}
    onClick={() => setDeleteTarget(kit)}
    sx={{ color: "#ef4444" }}
  >
    <DeleteOutlineOutlinedIcon sx={{ fontSize: 22 }} />
  </IconButton>
</Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* ADD / EDIT KIT - CENTER POPUP */}
      <Dialog
        open={open}
        onClose={closePopup}
        fullWidth
        maxWidth="md"
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: "92dvh",
            m: { xs: 1, sm: 2 },
            width: {
              xs: "calc(100% - 16px)",
              sm: "calc(100% - 32px)",
            },
          },
        }}
      >
        <Box
          component="form"
          onSubmit={saveKit}
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <DialogTitle
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {editingId ? "Edit Kit" : "Add Kit"}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Kit details and included products
                </Typography>
              </Box>

              <IconButton
                aria-label="Close"
                disabled={saving}
                onClick={closePopup}
                sx={{ ml: "auto" }}
              >
                ×
              </IconButton>
            </Stack>
          </DialogTitle>

          <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2.5}>
              {/* NAME + CLASS */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2,minmax(0,1fr))",
                  },
                  gap: 2,
                }}
              >
                <TextField
                  required
                  fullWidth
                  size="small"
                  label="Kit Name"
                  value={form.name}
                  onChange={(e) =>
                    change("name", e.target.value)
                  }
                  sx={fieldSx}
                />

                <TextField
                  required
                  fullWidth
                  size="small"
                  label="Class"
                  value={form.className}
                  onChange={(e) =>
                    change("className", e.target.value)
                  }
                  sx={fieldSx}
                />
              </Box>

              {/* GENDER + AMOUNT */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2,minmax(0,1fr))",
                  },
                  gap: 2,
                }}
              >
                <TextField
                  select
                  required
                  size="small"
                  fullWidth
                  label="Gender"
                  value={form.gender}
                  onChange={(e) =>
                    change("gender", e.target.value)
                  }
                  sx={fieldSx}
                >
                  {GENDERS.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  required
                  type="number"
                  fullWidth
                  size="small"
                  label="Bundle Amount (₹)"
                  value={form.price}
                  onChange={(e) =>
                    change("price", e.target.value)
                  }
                  inputProps={{ min: 0, step: "0.01" }}
                  sx={fieldSx}
                />
              </Box>

              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Description"
                value={form.description}
                onChange={(e) =>
                  change("description", e.target.value)
                }
                sx={fieldSx}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.isActive)}
                    onChange={(e) =>
                      change("isActive", e.target.checked)
                    }
                  />
                }
                label="Active — visible to eligible students"
              />

              {/* IMAGE */}
              <Box>
                <Typography fontWeight={600} sx={{ mb: 1 }}>
                  Kit Image
                </Typography>

                <Stack
                  direction="row"
                  alignItems="center"
                  flexWrap="wrap"
                  gap={2}
                >
                  <Box
                    sx={{
                      width: 110,
                      height: 110,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <KitImage
                      src={imagePreview || form.imageUrl}
                      name={form.name}
                      height={110}
                    />
                  </Box>

                  <Stack spacing={1}>
                    <Button
                      component="label"
                      variant="outlined"
                      sx={{ textTransform: "none" }}
                    >
                      {imageFile
                        ? "Change Image"
                        : "Choose Image"}
                      <input
                        hidden
                        type="file"
                        accept="image/*"
                        onChange={selectImage}
                      />
                    </Button>

                    {imageFile && (
                      <Typography variant="caption">
                        {imageFile.name}
                      </Typography>
                    )}

                    {imageFile && (
                      <Button
                        color="error"
                        size="small"
                        onClick={() => setImageFile(null)}
                      >
                        Cancel new image
                      </Button>
                    )}
                  </Stack>
                </Stack>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 1 }}
                >
                  Image is optional. Maximum 5 MB.
                  Existing image remains until a new
                  image is uploaded.
                </Typography>
              </Box>

              <Divider />

              {/* KIT ITEMS */}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
              >
                <Typography fontWeight={700}>
                  Kit Items ({form.items.length})
                </Typography>

                <Button
                  variant="outlined"
                  onClick={() => setProductDialog(true)}
                  sx={{
                    ml: "auto",
                    textTransform: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  + Add Product
                </Button>
              </Stack>

              {form.items.length === 0 && (
                <Alert severity="info">
                  Add products to this kit.
                </Alert>
              )}

              {form.items.map((item) => (
                <Box
                  key={item.productId}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography fontWeight={600}>
                      {item.productName ||
                        products.find(
                          (p) =>
                            String(p.id) ===
                            String(item.productId)
                        )?.name ||
                        `Product ${item.productId}`}
                    </Typography>

                    <IconButton
                      color="error"
                      onClick={() =>
                        removeItem(item.productId)
                      }
                    >
                      ×
                    </IconButton>
                  </Stack>

                  <TextField
                    size="small"
                    type="number"
                    label="Quantity"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(
                        item.productId,
                        "quantity",
                        e.target.value
                      )
                    }
                    inputProps={{ min: 1, step: 1 }}
                    sx={{ ...fieldSx, mt: 1, width: 130 }}
                  />

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={{ xs: 0, sm: 2 }}
                    sx={{ mt: 1 }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={Boolean(
                            item.studentPicksSize
                          )}
                          onChange={(e) =>
                            updateItem(
                              item.productId,
                              "studentPicksSize",
                              e.target.checked
                            )
                          }
                        />
                      }
                      label="Student picks size"
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={Boolean(
                            item.autoMatchHouseColor
                          )}
                          onChange={(e) =>
                            updateItem(
                              item.productId,
                              "autoMatchHouseColor",
                              e.target.checked
                            )
                          }
                        />
                      }
                      label="Auto-match house color"
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </DialogContent>

          <DialogActions
            sx={{
              px: 3,
              py: 2,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Button
              variant="outlined"
              disabled={saving}
              onClick={closePopup}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              sx={{ px: 3 }}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Kit"
                  : "Save Kit"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ADD PRODUCT POPUP */}
      <Dialog
        open={productDialog}
        onClose={() => setProductDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add Product</DialogTitle>

        <DialogContent sx={{ pt: "12px !important" }}>
          <Autocomplete
            options={availableProducts}
            value={selectedProduct}
            onChange={(_, value) =>
              setSelectedProduct(value)
            }
            getOptionLabel={(option) =>
              option?.name || ""
            }
            isOptionEqualToValue={(a, b) =>
              String(a.id) === String(b.id)
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Product"
                placeholder="Search products..."
                size="small"
                sx={fieldSx}
              />
            )}
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setProductDialog(false);
              setSelectedProduct(null);
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            disabled={!selectedProduct}
            onClick={addProduct}
          >
            Add Product
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete Kit?</DialogTitle>

        <DialogContent>
          <Typography>
            Delete <strong>{deleteTarget?.name}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
            disabled={busyId !== null}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>

          <Button
            color="error"
            variant="contained"
            disabled={busyId !== null}
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}




// import { useEffect, useState } from 'react'
// import {
//   Alert,
//   Box,
//   Button,
//   Card,
//   CardContent,
//   FormControlLabel,
//   IconButton,
//   MenuItem,
//   Stack,
//   Switch,
//   TextField,
//   Typography,
// } from '@mui/material'
// import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
// import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
// import PageHeader from '../components/PageHeader'
// import LoadingSkeleton from '../components/LoadingSkeleton'
// import EmptyState from '../components/EmptyState'
// import { useSnackbar } from '../context/SnackbarContext'
// import { formatINR } from '../utils/format'
// import { getKit, saveKit } from '../api/admin'
// import { listProducts } from '../api/catalog'
// import api from '../api/client'

// export default function Kit() {
//   const { showToast } = useSnackbar()
//   const [kit, setKit] = useState({ name: 'School Kit', description: '', price: 2499, isActive: true, imageUrl: null })
//   const [items, setItems] = useState([])
//   const [warnings, setWarnings] = useState([])
//   const [products, setProducts] = useState([])
//   const [loading, setLoading] = useState(true)
//   const [saving, setSaving] = useState(false)

//   async function load() {
//     setLoading(true)
//     try {
//       const [kitRes, prodRes] = await Promise.all([
//         getKit(),
//         listProducts({ page: 1, pageSize: 100, status: 'active' }),
//       ])
//       if (kitRes.data.kit) setKit(kitRes.data.kit)
//       setItems(kitRes.data.items || [])
//       setWarnings(kitRes.data.warnings || [])
//       setProducts(prodRes.data.items || [])
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Failed to load kit', 'error')
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     load()
//   }, [])

//   async function onSave(e) {
//     e.preventDefault()
//     setSaving(true)
//     try {
//       await saveKit({
//         name: kit.name,
//         description: kit.description || '',
//         price: Number(kit.price),
//         isActive: kit.isActive,
//         items: items.map((i) => ({
//           productId: i.productId,
//           quantity: Number(i.quantity),
//           studentPicksSize: Boolean(i.studentPicksSize),
//           autoMatchHouseColor: Boolean(i.autoMatchHouseColor),
//         })),
//       })
//       showToast('Kit saved', 'success')
//       load()
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Save failed', 'error')
//     } finally {
//       setSaving(false)
//     }
//   }

//   async function onUploadImage(file) {
//     if (!file) return
//     const form = new FormData()
//     form.append('image', file)
//     try {
//       const { data } = await api.post('/admin/kit/image', form, {
//         headers: { 'Content-Type': 'multipart/form-data' },
//       })
//       setKit((k) => ({ ...k, imageUrl: data.data.imageUrl }))
//       showToast('Image uploaded', 'success')
//     } catch (err) {
//       showToast(err.response?.data?.message || 'Upload failed', 'error')
//     }
//   }

//   if (loading) {
//     return (
//       <>
//         <PageHeader title="School Kit" subtitle="Bundle products offered as a kit to students." />
//         <LoadingSkeleton rows={8} />
//       </>
//     )
//   }

//   return (
//     <>
//       <PageHeader
//         title="School Kit"
//         subtitle="Bundle products, set price, and size/house-color rules."
//         actions={
//           <Button variant="contained" disabled={saving} onClick={onSave}>
//             {saving ? 'Saving…' : 'Save kit'}
//           </Button>
//         }
//       />

//       {warnings.length > 0 && (
//         <Alert severity="warning" sx={{ mb: 2 }}>
//           Out-of-stock variants in kit: {warnings.map((w) => w.productName).join(', ')}
//         </Alert>
//       )}

//       <Box component="form" onSubmit={onSave}>
//         <Stack spacing={2}>
//           <Card variant="outlined">
//             <CardContent>
//               <Typography fontWeight={600} sx={{ mb: 2 }}>Kit details</Typography>
//               <Stack spacing={2}>
//                 <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
//                   <TextField
//                     label="Name"
//                     fullWidth
//                     required
//                     value={kit.name}
//                     onChange={(e) => setKit((k) => ({ ...k, name: e.target.value }))}
//                   />
//                   <TextField
//                     label="Bundle price (₹)"
//                     type="number"
//                     fullWidth
//                     required
//                     value={kit.price}
//                     onChange={(e) => setKit((k) => ({ ...k, price: e.target.value }))}
//                     helperText={formatINR(kit.price)}
//                   />
//                 </Stack>
//                 <TextField
//                   label="Description"
//                   fullWidth
//                   multiline
//                   minRows={2}
//                   value={kit.description || ''}
//                   onChange={(e) => setKit((k) => ({ ...k, description: e.target.value }))}
//                 />
//                 <FormControlLabel
//                   control={
//                     <Switch
//                       checked={kit.isActive}
//                       onChange={(e) => setKit((k) => ({ ...k, isActive: e.target.checked }))}
//                     />
//                   }
//                   label="Active"
//                 />
//                 <Stack direction="row" spacing={2} alignItems="center">
//                   {kit.imageUrl && (
//                     <Box
//                       component="img"
//                       src={kit.imageUrl}
//                       alt="Kit"
//                       sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
//                     />
//                   )}
//                   <Button variant="outlined" component="label">
//                     Upload image
//                     <input hidden type="file" accept="image/*" onChange={(e) => onUploadImage(e.target.files?.[0])} />
//                   </Button>
//                 </Stack>
//               </Stack>
//             </CardContent>
//           </Card>

//           <Card variant="outlined">
//             <CardContent>
//               <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
//                 <Typography fontWeight={600}>Kit items</Typography>
//                 <Button
//                   startIcon={<AddOutlinedIcon />}
//                   size="small"
//                   disabled={!products.length}
//                   onClick={() => {
//                     if (!products[0]) return
//                     setItems((list) => [
//                       ...list,
//                       {
//                         productId: products[0].id,
//                         productName: products[0].name,
//                         quantity: 1,
//                         studentPicksSize: true,
//                         autoMatchHouseColor: false,
//                       },
//                     ])
//                   }}
//                 >
//                   Add product
//                 </Button>
//               </Stack>

//               {!items.length && (
//                 <EmptyState title="No kit items" description="Add products that belong in the school kit." />
//               )}

//               <Stack spacing={1.5}>
//                 {items.map((item, idx) => (
//                   <Stack
//                     key={idx}
//                     direction={{ xs: 'column', md: 'row' }}
//                     spacing={1.5}
//                     alignItems={{ md: 'center' }}
//                     sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
//                   >
//                     <TextField
//                       select
//                       size="small"
//                       label="Product"
//                       value={item.productId}
//                       sx={{ flex: 2, minWidth: 180 }}
//                       onChange={(e) => {
//                         const p = products.find((x) => String(x.id) === e.target.value)
//                         const next = [...items]
//                         next[idx] = { ...item, productId: Number(e.target.value), productName: p?.name }
//                         setItems(next)
//                       }}
//                     >
//                       {products.map((p) => (
//                         <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
//                       ))}
//                     </TextField>
//                     <TextField
//                       size="small"
//                       type="number"
//                       label="Qty"
//                       value={item.quantity}
//                       sx={{ width: 100 }}
//                       inputProps={{ min: 1 }}
//                       onChange={(e) => {
//                         const next = [...items]
//                         next[idx] = { ...item, quantity: Number(e.target.value) }
//                         setItems(next)
//                       }}
//                     />
//                     <FormControlLabel
//                       control={
//                         <Switch
//                           size="small"
//                           checked={item.studentPicksSize}
//                           onChange={(e) => {
//                             const next = [...items]
//                             next[idx] = { ...item, studentPicksSize: e.target.checked }
//                             setItems(next)
//                           }}
//                         />
//                       }
//                       label="Student picks size"
//                     />
//                     <FormControlLabel
//                       control={
//                         <Switch
//                           size="small"
//                           checked={item.autoMatchHouseColor}
//                           onChange={(e) => {
//                             const next = [...items]
//                             next[idx] = { ...item, autoMatchHouseColor: e.target.checked }
//                             setItems(next)
//                           }}
//                         />
//                       }
//                       label="Auto-match house color"
//                     />
//                     <IconButton
//                       color="error"
//                       onClick={() => setItems((list) => list.filter((_, i) => i !== idx))}
//                       aria-label="Remove item"
//                     >
//                       <DeleteOutlinedIcon />
//                     </IconButton>
//                   </Stack>
//                 ))}
//               </Stack>
//             </CardContent>
//           </Card>
//         </Stack>
//       </Box>
//     </>
//   )
// }
