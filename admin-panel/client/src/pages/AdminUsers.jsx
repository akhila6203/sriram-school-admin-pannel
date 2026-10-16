import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

import api from "../api/client";

import {
  PERMISSIONS,
} from "../utils/adminPermissions";

const blankForm = {
  name: "",
  email: "",
  password: "",
  permissions: [],
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/users");

      setUsers(response.data.data.users || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load admin users"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase().trim();

    return users.filter((user) =>
      `${user.name} ${user.email}`
        .toLowerCase()
        .includes(query)
    );
  }, [users, search]);

  function openCreate() {
    setEditingUser(null);
    setForm({
      ...blankForm,
      permissions: [],
    });
    setError("");
    setOpen(true);
  }

  function openEdit(user) {
    setEditingUser(user);

    setForm({
      name: user.name,
      email: user.email,
      password: "",
      permissions: [...(user.permissions || [])],
    });

    setError("");
    setOpen(true);
  }

  function togglePermission(permission) {
    setForm((previous) => ({
      ...previous,
      permissions: previous.permissions.includes(permission)
        ? previous.permissions.filter(
            (item) => item !== permission
          )
        : [...previous.permissions, permission],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.permissions.length === 0) {
      setError("Select at least one sidebar page");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const payload = {
        ...form,
      };

      if (editingUser && !payload.password) {
        delete payload.password;
      }

      if (editingUser) {
        await api.patch(
          `/admin/users/${editingUser.id}`,
          payload
        );
      } else {
        await api.post(
          "/admin/users",
          payload
        );
      }

      setOpen(false);
      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save admin user"
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(user) {
    const confirmed = window.confirm(
      `Delete admin user "${user.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await api.delete(
        `/admin/users/${user.id}`
      );

      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete user"
      );
    }
  }

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* PAGE HEADER */}

      {/* SEARCH LEFT - ADD USER RIGHT */}

<Box
  sx={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    mb: 2,
    width: "100%",
    minWidth: 0,
  }}
>
  {/* LEFT SIDE SEARCH */}

  <TextField
    size="small"
    placeholder="Search name or email"
    value={search}
    onChange={(event) => setSearch(event.target.value)}
    sx={{
      width: {
        xs: "65%",
        sm: 330,
      },
      maxWidth: "100%",
      minWidth: 0,
      "& .MuiOutlinedInput-root": {
        backgroundColor: "#fff",
        borderRadius: 2,
      },
    }}
  />

  {/* RIGHT SIDE ADD USER */}

  <Button
    variant="contained"
    startIcon={<AddIcon />}
    onClick={openCreate}
    sx={{
      flexShrink: 0,
      textTransform: "none",
      fontWeight: 600,
      borderRadius: 2,
      px: {
        xs: 1.5,
        sm: 3,
      },
      py: 1.1,
      whiteSpace: "nowrap",
    }}
  >
    Add user
  </Button>
</Box>
      {error && !open && (
        <Typography
          color="error"
          sx={{ mb: 2 }}
        >
          {error}
        </Typography>
      )}

      {/* USERS TABLE */}

      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <TableContainer
          sx={{
            width: "100%",
            overflowX: "auto",
          }}
        >
          <Table sx={{ minWidth: 690 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Assigned Pages</TableCell>
                <TableCell>Registered</TableCell>
                <TableCell align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                  >
                    <CircularProgress size={25} />
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    hover
                  >
                    <TableCell>
                      #{user.id}
                    </TableCell>

                    <TableCell>
                      <Typography fontWeight={600}>
                        {user.name}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        {user.email}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        color={
                          user.role === "super_admin"
                            ? "primary"
                            : "default"
                        }
                        label={
                          user.role === "super_admin"
                            ? "Super Admin"
                            : "Admin User"
                        }
                      />
                    </TableCell>

                    <TableCell>
                      {user.role === "super_admin"
                        ? "All pages"
                        : (user.permissions || [])
                            .map(
                              (key) =>
                                PERMISSIONS.find(
                                  (item) =>
                                    item[0] === key
                                )?.[1] || key
                            )
                            .join(", ")}
                    </TableCell>

                    <TableCell>
                      {new Date(
                        user.created_at
                      ).toLocaleDateString("en-IN")}
                    </TableCell>

                    <TableCell align="right">
                      {user.role !== "super_admin" && (
                        <>
                          <IconButton
                            aria-label="Edit user"
                            onClick={() =>
                              openEdit(user)
                            }
                          >
                            <EditOutlinedIcon />
                          </IconButton>

                          <IconButton
  color="error"
  aria-label="Delete user"
  onClick={() => deleteUser(user)}
><DeleteOutlinedIcon />
</IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}

              {!loading &&
                filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      align="center"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* CENTER POPUP */}

      <Dialog
        open={open}
        onClose={
          busy
            ? undefined
            : () => setOpen(false)
        }
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            mx: 2,
            maxHeight: "90vh",
            borderRadius: 3,
          },
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
        >
          <DialogTitle
            sx={{
              fontWeight: 700,
            }}
          >
            {editingUser
              ? "Edit admin user"
              : "Add admin user"}
          </DialogTitle>

          <DialogContent dividers>
            <Stack
              spacing={2.5}
              sx={{ pt: 1 }}
            >
              <TextField
                required
                fullWidth
                label="Username / Login"
                value={form.name}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
              />

              <TextField
                required
                fullWidth
                type="email"
                label="Email"
                value={form.email}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
              />

              <TextField
                required={!editingUser}
                fullWidth
                type="password"
                label={
                  editingUser
                    ? "New password (optional)"
                    : "Password"
                }
                value={form.password}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    password: event.target.value,
                  }))
                }
              />

              <Typography fontWeight={700}>
                Sidebar Access
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Select the pages this admin
                can access.
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "1fr 1fr",
                  },
                  gap: 0.5,
                }}
              >
                {PERMISSIONS.map(
                  ([key, label]) => (
                    <FormControlLabel
                      key={key}
                      label={label}
                      control={
                        <Checkbox
                          checked={form.permissions.includes(
                            key
                          )}
                          onChange={() =>
                            togglePermission(key)
                          }
                        />
                      }
                    />
                  )
                )}
              </Box>

              {error && (
                <Typography color="error">
                  {error}
                </Typography>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={() =>
                setOpen(false)
              }
              disabled={busy}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={busy}
            >
              {busy
                ? "Saving..."
                : editingUser
                  ? "Save Changes"
                  : "Create User"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}