import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined'
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import CheckroomOutlinedIcon from '@mui/icons-material/CheckroomOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined'
import BackpackOutlinedIcon from '@mui/icons-material/BackpackOutlined'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { useAuth } from '../context/AuthContext'
import { useSnackbar } from '../context/SnackbarContext'
import api from '../api/client'

import PeopleOutlineIcon from "@mui/icons-material/PeopleOutlineOutlined";

import {
  canAccess,
} from "../utils/adminPermissions";

const DRAWER_WIDTH = 260

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: DashboardOutlinedIcon, end: true },
  { to: '/admin/students', label: 'Students', icon: SchoolOutlinedIcon },
  { to: '/admin/products', label: 'Products', icon: CheckroomOutlinedIcon },
  { to: '/admin/categories', label: 'Categories', icon: CategoryOutlinedIcon },
  { to: '/admin/inventory', label: 'Inventory', icon: WarehouseOutlinedIcon },
  { to: '/admin/kit', label: 'Kit', icon: BackpackOutlinedIcon },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCartOutlinedIcon, badgeKey: 'newOrders' },
  { to: '/admin/reports', label: 'Reports', icon: AssessmentOutlinedIcon },
  { to: '/admin/gst', label: 'GST', icon: ReceiptLongOutlinedIcon },
  {
  to: "/admin/users",
  label: "Users / Admins",
  icon: PeopleOutlineIcon,
  permission: "users_admins",
},
  { to: '/admin/settings', label: 'Settings', icon: SettingsOutlinedIcon },
]

function pathTitle(pathname) {
  const item = navItems.find((n) =>
    n.end ? pathname === n.to || pathname === '/admin' : pathname.startsWith(n.to)
  )
  return item?.label || 'Admin'
}

function AdminLayoutInner() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [badges, setBadges] = useState({})
  const { admin, logout } = useAuth()
  const { showToast } = useSnackbar()
  const navigate = useNavigate()
  const location = useLocation()
  const { config: pageHeader } = usePageHeader()
  const fallbackTitle = useMemo(() => pathTitle(location.pathname), [location.pathname])
  const title = pageHeader?.title || fallbackTitle

  // useEffect(() => {
  //   api
  //     .get('/admin/orders/counts')
  //     .then((r) => setBadges({ newOrders: r.data.data.counts?.placed || 0 }))
  //     .catch(() => {})
  // }, [location.pathname])
  useEffect(() => {
  if (!canAccess(admin, "orders")) {
    return;
  }

  api
    .get("/admin/orders/counts")
    .then((response) => {
      setBadges({
        newOrders:
          response.data.data.counts?.placed || 0,
      });
    })
    .catch(() => {});
}, [location.pathname, admin]);

  async function handleLogout() {
    await logout()
    showToast('Logged out', 'success')
    navigate('/login')
  }

  function isActive(item) {
    if (item.to === '/admin/dashboard') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard'
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  }

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'primary.main',
          }}
        >
          BrassLeaf Store
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          Admin Panel
        </Typography>
      </Box>
      <Divider />
      {/* <List sx={{ px: 1.5, py: 1.5, flex: 1 }}> */}
      <List
  sx={{
    px: 1.5,
    py: 1.5,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
  }}
>
        {/* {navItems.map((item) => { */}
        {navItems
  .filter((item) =>
    canAccess(
      admin,
      item.permission || item.to.split("/").pop()
    )
  )
  .map((item) => {
          const Icon = item.icon
          const selected = isActive(item)
          const badge = item.badgeKey ? badges[item.badgeKey] : 0
          return (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={selected}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemIcon sx={{ minWidth: 40, color: selected ? 'inherit' : 'text.secondary' }}>
                {badge ? (
                  <Badge badgeContent={badge} color="error" max={99}>
                    <Icon fontSize="small" />
                  </Badge>
                ) : (
                  <Icon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 600 : 500 }}
              />
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" sx={{ width: { lg: DRAWER_WIDTH }, flexShrink: { lg: 0 } }}>
        {isDesktop ? (
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` }, minWidth: 0 }}>
        <AppBar position="sticky" color="inherit" elevation={0}>
          <Toolbar sx={{ gap: 1, flexWrap: 'wrap', py: pageHeader?.subtitle ? 1 : 0 }}>
            {!isDesktop && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <MenuOutlinedIcon />
              </IconButton>
            )}
            {pageHeader?.backTo && (
              <IconButton
                edge="start"
                aria-label="Back"
                onClick={() => navigate(pageHeader.backTo)}
                sx={{ mr: 0.5 }}
              >
                <ArrowBackOutlinedIcon />
              </IconButton>
            )}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                {title}
              </Typography>
              {pageHeader?.subtitle && (
                <Typography variant="caption" color="text.secondary" display="block" noWrap>
                  {pageHeader.subtitle}
                </Typography>
              )}
            </Box>
            {pageHeader?.actions && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 1 }}>
                {pageHeader.actions}
              </Stack>
            )}
            <Box sx={{ textAlign: 'right', mr: 0.5 }}>
              <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                {admin?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                {(admin?.role || '').replace(/_/g, ' ')}
              </Typography>
            </Box>
            <IconButton onClick={handleLogout} aria-label="Logout" color="inherit">
              <LogoutOutlinedIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default function AdminLayout() {
  return (
    <PageHeaderProvider>
      <AdminLayoutInner />
    </PageHeaderProvider>
  )
}
