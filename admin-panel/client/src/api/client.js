import axios from 'axios'

const api = axios.create({
  // baseURL: '/api',
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers?.setContentType) {
      config.headers.setContentType(undefined)
    } else if (config.headers) {
      delete config.headers['Content-Type']
    }
  }


  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      const path = window.location.pathname
      if (path !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

export default api
