import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { useSnackbar } from '../context/SnackbarContext'
import {
  landingPage,
} from "../utils/adminPermissions";

export default function Login() {
  // const { login, isAuthenticated, loading } = useAuth()
  const {
  login,
  admin,
  isAuthenticated,
  loading,
} = useAuth();
  const { showToast } = useSnackbar()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: 'admin@scholarstore.local',
      password: '',
    },
  })

  // if (!loading && isAuthenticated) {
  //   return <Navigate to="/admin/dashboard" replace />
  // }
  if (!loading && isAuthenticated) {
  return (
    <Navigate
      to={landingPage(admin)}
      replace
    />
  );
}

  async function onSubmit(values) {
    setSubmitting(true)
    try {
      const response = await login(
  values.email,
  values.password
);

showToast("Welcome back", "success");

navigate(
  landingPage(response.data.admin),
  { replace: true }
);
      // await login(values.email, values.password)
      // showToast('Welcome back', 'success')
      // navigate(location.state?.from?.pathname || '/admin/dashboard', { replace: true })
    } catch (err) {
      showToast(err.response?.data?.message || 'Login failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 45%, #f8fafc 100%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'primary.main' }}
          >
            BrassLeaf Store
          </Typography>
          <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
            Admin login
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Sign in to manage kits, inventory, and orders.
          </Typography>

          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3 }}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                autoComplete="username"
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                {...register('email', { required: 'Email is required' })}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                autoComplete="current-password"
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                {...register('password', { required: 'Password is required' })}
              />
              <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
