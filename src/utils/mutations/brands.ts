import { apiCall } from "../customApiCall";
import { API_ENDPOINTS, API_DOMAIN } from "../../../apiConfig";
import axios from "axios";

export const reorderBrands = async (
  token: string,
  orders: { id: number; sort_order: number }[]
) => {
  const url = `${API_DOMAIN}/brands/reorder`;
  const response = await axios.post(
    url,
    { orders },
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

const appendCategoryIds = (formData: FormData, categoryIds: Array<string | number>) => {
  categoryIds.forEach((id) => {
    formData.append("category_ids[]", String(id));
  });
};

const buildBrandFormData = (payload: {
  title: string;
  category_ids: Array<string | number>;
}) => {
  const formData = new FormData();
  formData.append("title", payload.title);
  appendCategoryIds(formData, payload.category_ids);
  if (payload.category_ids[0] != null) {
    formData.append("category_id", String(payload.category_ids[0]));
  }
  return formData;
};

export const addBrand = async (
  payload: { title: string; category_ids: Array<string | number> },
  token: string
): Promise<unknown> => {
  const formData = buildBrandFormData(payload);
  return await apiCall(API_ENDPOINTS.ADMIN.AddBrand, "POST", formData, token);
};

export const updateBrand = async (
  id: number | string,
  payload: { title: string; category_ids: Array<string | number> },
  token: string
): Promise<unknown> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.UpdateBrand(id),
    "PUT",
    {
      title: payload.title,
      category_ids: payload.category_ids.map(String),
      category_id: payload.category_ids[0] ?? null,
    },
    token
  );
};

export const deleteBrand = async (
  id: number | string,
  token: string
): Promise<unknown> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.DeleteBrand(id),
    "DELETE",
    undefined,
    token
  );
};
