import axios from "axios";
import { API_DOMAIN, API_ENDPOINTS } from "../../../apiConfig";

export const reorderCategories = async (
  token: string,
  orders: { id: number; sort_order: number }[]
) => {
  const url = `${API_DOMAIN}/categories/reorder`;
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

import { apiCall } from "../customApiCall";

// Helper to create FormData from payload
const buildCategoryFormData = (payload: {
  title: string;
  icon?: File | Blob | null;
  status?: string;
  show_on_store?: boolean;
}) => {
  const formData = new FormData();
  formData.append("title", payload.title);
  if (payload.icon) {
    formData.append("icon", payload.icon);
  }
  if (payload.status) {
    formData.append("status", payload.status);
  }
  if (payload.show_on_store !== undefined) {
    formData.append("show_on_store", payload.show_on_store ? "1" : "0");
  }
  return formData;
};

// POST / New Category
export const addCategory = async (
  payload: { title: string; icon: File | Blob; status?: string },
  token: string
): Promise<any> => {
  const formData = buildCategoryFormData(payload);
  return await apiCall(
    API_ENDPOINTS.ADMIN.AddCategory,
    "POST",
    formData,
    token
  );
};

// POST /update_category/{id}
export const updateCategory = async (
  id: number | string,
  payload: { title: string; icon?: File | Blob | null; status?: string },
  token: string
): Promise<any> => {
  const formData = buildCategoryFormData(payload);
  console.log("🚀 updateCategory FormData:", [...formData.entries()]);

  return await apiCall(
    API_ENDPOINTS.ADMIN.UpdateCategory(id),
    "POST",
    formData,
    token
  );
};

// DELETE category via admin API (existing behavior)
export const deleteCategory = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.DeleteCategory(id),
    "DELETE",
    undefined,
    token
  );
};
