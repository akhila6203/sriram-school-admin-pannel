import api from './client'

export const listKits = async () =>
  (await api.get('/admin/kit/kits')).data

export const getKitById = async (id) =>
  (await api.get(`/admin/kit/kits/${id}`)).data

export const listKitProducts = async () =>
  (await api.get('/admin/kit/products')).data

export const createKit = async (body) =>
  (await api.post('/admin/kit/kits', body)).data

export const updateKit = async (id, body) =>
  (await api.put(`/admin/kit/kits/${id}`, body)).data

export const setKitActive = async (id, isActive) =>
  (
    await api.patch(`/admin/kit/kits/${id}/active`, {
      isActive,
    })
  ).data

export const deleteKit = async (id) =>
  (await api.delete(`/admin/kit/kits/${id}`)).data

export async function uploadKitImage(id, file) {
  if (!id) {
    throw new Error("Kit ID is missing");
  }

  if (!file) {
    throw new Error("Please select an image");
  }

  const form = new FormData();
  form.append("image", file, file.name);

  const { data } = await api.post(
    `/admin/kit/kits/${id}/image`,
    form,
    {
      headers: {
        "Content-Type": undefined,
      },
    }
  );

  return data;
}