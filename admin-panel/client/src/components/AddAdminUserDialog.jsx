import { useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { ADMIN_PERMISSIONS } from "../utils/adminPermissions";

const initialForm = {
  name: "",
  email: "",
  password: "",
  permissions: [],
};

export default function AddAdminUserDialog({
  open,
  onClose,
  onCreate,
}) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const togglePermission = (key) => {
    setForm((previous) => ({
      ...previous,
      permissions: previous.permissions.includes(key)
        ? previous.permissions.filter((p) => p !== key)
        : [...previous.permissions, key],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      setError("Please fill all required fields.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.permissions.length === 0) {
      setError("Select at least one sidebar permission.");
      return;
    }

    try {
      setSaving(true);

      await onCreate({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        permissions: form.permissions,
      });

      setForm(initialForm);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to create user."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          mx: { xs: 2, sm: 3 },
          maxHeight: "90vh",
        },
      }}
    >
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Add Admin User
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              required
              label="Username / Login"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                }))
              }
            />

            <TextField
              fullWidth
              required
              type="email"
              label="Email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  email: e.target.value,
                }))
              }
            />

            <TextField
              fullWidth
              required
              type="password"
              label="Password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  password: e.target.value,
                }))
              }
            />

            <Typography fontWeight={700}>
              Sidebar Access Permissions
            </Typography>

            <FormGroup>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1,
                }}
              >
                {ADMIN_PERMISSIONS.map((item) => (
                  <FormControlLabel
                    key={item.key}
                    control={
                      <Checkbox
                        checked={form.permissions.includes(
                          item.key
                        )}
                        onChange={() =>
                          togglePermission(item.key)
                        }
                      />
                    }
                    label={item.label}
                  />
                ))}
              </Box>
            </FormGroup>

            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={onClose}
            disabled={saving}
            variant="outlined"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={saving}
          >
            {saving ? "Creating..." : "Create User"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}