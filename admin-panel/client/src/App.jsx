import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import StudentDetail from './pages/StudentDetail'
import Categories from './pages/Categories'
import Kit from './pages/Kit'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import ProductDetail from './pages/ProductDetail'
import Inventory from './pages/Inventory'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Gst from './pages/Gst'
import { Box } from "@mui/material";

import { useAuth } from "./context/AuthContext";

import {
  landingPage,
} from "./utils/adminPermissions";

import PermissionRoute from "./components/PermissionRoute";

import AdminUsers from "./pages/AdminUsers";

function HomeRedirect() {
  const { admin } = useAuth();

  return (
    <Navigate
      to={landingPage(admin)}
      replace
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route
  path="/admin"
  element={<AdminLayout />}
>
  <Route
    index
    element={<HomeRedirect />}
  />

  <Route
    path="dashboard"
    element={
      <PermissionRoute permission="dashboard">
        <Dashboard />
      </PermissionRoute>
    }
  />

  <Route
    path="students"
    element={
      <PermissionRoute permission="students">
        <Students />
      </PermissionRoute>
    }
  />

  <Route
    path="students/:id"
    element={
      <PermissionRoute permission="students">
        <StudentDetail />
      </PermissionRoute>
    }
  />

  <Route
    path="products"
    element={
      <PermissionRoute permission="products">
        <Products />
      </PermissionRoute>
    }
  />

  <Route
    path="products/new"
    element={
      <PermissionRoute permission="products">
        <ProductForm />
      </PermissionRoute>
    }
  />

  <Route
    path="products/:id/edit"
    element={
      <PermissionRoute permission="products">
        <ProductForm />
      </PermissionRoute>
    }
  />

  <Route
    path="products/:id"
    element={
      <PermissionRoute permission="products">
        <ProductDetail />
      </PermissionRoute>
    }
  />

  <Route
    path="categories"
    element={
      <PermissionRoute permission="categories">
        <Categories />
      </PermissionRoute>
    }
  />

  <Route
    path="inventory"
    element={
      <PermissionRoute permission="inventory">
        <Inventory />
      </PermissionRoute>
    }
  />

  <Route
    path="kit"
    element={
      <PermissionRoute permission="kit">
        <Kit />
      </PermissionRoute>
    }
  />

  <Route
    path="orders"
    element={
      <PermissionRoute permission="orders">
        <Orders />
      </PermissionRoute>
    }
  />

  <Route
    path="orders/:id"
    element={
      <PermissionRoute permission="orders">
        <OrderDetail />
      </PermissionRoute>
    }
  />

  <Route
    path="reports"
    element={
      <PermissionRoute permission="reports">
        <Gst mode="reports" />
      </PermissionRoute>
    }
  />

  <Route
    path="gst"
    element={
      <PermissionRoute permission="gst">
        <Gst mode="gst" />
      </PermissionRoute>
    }
  />

  <Route
    path="settings"
    element={
      <PermissionRoute permission="settings">
        <Settings />
      </PermissionRoute>
    }
  />

  <Route
    path="users"
    element={
      <PermissionRoute permission="users_admins">
        <AdminUsers />
      </PermissionRoute>
    }
  />

  <Route
    path="no-access"
    element={
      <Box sx={{ p: 3 }}>
        No pages assigned. Contact Super Admin.
      </Box>
    }
  />
</Route>
        </Route>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}





// import { Navigate, Route, Routes } from 'react-router-dom'
// import { AuthProvider } from './context/AuthContext'
// import ProtectedRoute from './components/ProtectedRoute'
// import AdminLayout from './layouts/AdminLayout'
// import Login from './pages/Login'
// import Settings from './pages/Settings'
// import Dashboard from './pages/Dashboard'
// import Students from './pages/Students'
// import StudentDetail from './pages/StudentDetail'
// import Categories from './pages/Categories'
// import Kit from './pages/Kit'
// import Products from './pages/Products'
// import ProductForm from './pages/ProductForm'
// import ProductDetail from './pages/ProductDetail'
// import Inventory from './pages/Inventory'
// import Orders from './pages/Orders'
// import OrderDetail from './pages/OrderDetail'
// import Gst from './pages/Gst'

// export default function App() {
//   return (
//     <AuthProvider>
//       <Routes>
//         <Route path="/login" element={<Login />} />
//         <Route element={<ProtectedRoute />}>
//           <Route path="/admin" element={<AdminLayout />}>
//             <Route index element={<Navigate to="dashboard" replace />} />
//             <Route path="dashboard" element={<Dashboard />} />
//             <Route path="students" element={<Students />} />
//             <Route path="students/:id" element={<StudentDetail />} />
//             <Route path="products" element={<Products />} />
//             <Route path="products/new" element={<ProductForm />} />
//             <Route path="products/:id/edit" element={<ProductForm />} />
//             <Route path="products/:id" element={<ProductDetail />} />
//             <Route path="categories" element={<Categories />} />
//             <Route path="inventory" element={<Inventory />} />
//             <Route path="kit" element={<Kit />} />
//             <Route path="orders" element={<Orders />} />
//             <Route path="orders/:id" element={<OrderDetail />} />
            
//             {/* <Route path="gst" element={<Gst />} /> */}
//             <Route path="reports" element={<Gst mode="reports" />} />
//             <Route path="gst" element={<Gst mode="gst" />} />
//             <Route path="settings" element={<Settings />} />
//           </Route>
//         </Route>
//         <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
//         <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
//       </Routes>
//     </AuthProvider>
//   )
// }
