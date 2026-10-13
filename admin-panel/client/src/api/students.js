import api from './client'

export async function listStudents(params) {
  const { data } = await api.get('/admin/students', { params })
  return data
}

export async function getStudent(id) {
  const { data } = await api.get(`/admin/students/${id}`)
  return data
}

export async function createStudent(payload) {
  const { data } = await api.post('/admin/students', payload)
  return data
}

export async function updateStudent(id, payload) {
  const { data } = await api.patch(`/admin/students/${id}`, payload)
  return data
}

export async function updateStudentControls(id, payload) {
  const { data } = await api.patch(`/admin/students/${id}/controls`, payload)
  return data
}

export async function deleteStudent(id) {
  const { data } = await api.delete(`/admin/students/${id}`)
  return data
}

export async function bulkActive(ids, isActive) {
  const { data } = await api.post('/admin/students/bulk-active', { ids, isActive })
  return data
}

export async function importPreview(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/admin/students/import/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function importCommit(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/admin/students/import/commit', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export function templateUrl() {
  return '/api/admin/students/template'
}

export function exportUrl() {
  return '/api/admin/students/export'
}


export async function listStudentClasses() {
  const { data } = await api.get('/admin/students/classes');
  return data;
}