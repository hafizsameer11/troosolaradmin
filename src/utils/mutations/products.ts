import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";

//Add Product (mutation)
export const addProduct = async (
  data: {
    title: string;
    category_id: number;
    price: number;
    brand_id?: number | null;
    discount_price?: number;
    discount_end_date?: string;
    stock?: string;
    installation_price?: number;
    top_deal?: boolean;
    is_most_popular?: boolean;
    installation_compulsory?: boolean;
    is_available?: boolean;
    description?: string;
    specifications?: string;
    featured_image?: File;
    images?: File[];
    product_details?: string[];
  },
  token: string
): Promise<unknown> => {
  const formData = new FormData();

  // Required fields
  formData.append("title", data.title);
  formData.append("category_id", data.category_id.toString());
  formData.append("price", data.price.toString());

  // Optional fields (brand_id nullable)
  if (data.brand_id !== undefined && data.brand_id !== null)
    formData.append("brand_id", data.brand_id.toString());
  else if (data.brand_id === null)
    formData.append("brand_id", "");
  if (data.discount_price !== undefined)
    formData.append("discount_price", data.discount_price.toString());
  if (data.discount_end_date)
    formData.append("discount_end_date", data.discount_end_date);
  if (data.stock) formData.append("stock", data.stock);
  if (data.installation_price !== undefined)
    formData.append("installation_price", data.installation_price.toString());
  if (data.top_deal !== undefined)
    formData.append("top_deal", data.top_deal ? "1" : "0");
  if (data.is_most_popular !== undefined)
    formData.append("is_most_popular", data.is_most_popular ? "1" : "0");
  if (data.installation_compulsory !== undefined)
    formData.append(
      "installation_compulsory",
      data.installation_compulsory ? "1" : "0"
    );
  if (data.is_available !== undefined) {
    formData.append("is_available", data.is_available ? "1" : "0");
  }
  if (data.description !== undefined) {
    formData.append("description", data.description);
  }
  if (data.specifications !== undefined) {
    formData.append("specifications", data.specifications);
  }

  if (data.featured_image) {
    formData.append("featured_image", data.featured_image);
  }

  if (data.images && data.images.length > 0) {
    data.images.forEach((image, index) => {
      formData.append(`images[${index}]`, image);
    });
  }

  if (data.product_details && data.product_details.length > 0) {
    data.product_details.forEach((detail, index) => {
      formData.append(`product_details[${index}]`, detail);
    });
  }

  return await apiCall(
    API_ENDPOINTS.ADMIN.ProductCreate,
    "POST",
    formData,
    token
  );
};
// Update Product (mutation)
export const updateProduct = async (
  id: number | string,
  payload: FormData,
  token: string
): Promise<unknown> => {
  // payload is now always FormData
  return await apiCall(
    API_ENDPOINTS.ADMIN.ProductUpdate(id),
    "POST",
    payload,
    token
  );
};

//Delete Product (mutation)
export const deleteProduct = async (
  id: number | string,
  token: string
): Promise<unknown> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.ProductDelete(id),
    "DELETE",
    undefined,
    token
  );
};

export const deleteProductFeaturedImage = async (
  id: number | string,
  token: string
): Promise<unknown> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.ProductDeleteFeaturedImage(id),
    "DELETE",
    undefined,
    token
  );
};

export const deleteProductGalleryImage = async (
  productId: number | string,
  imageId: number | string,
  token: string
): Promise<unknown> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.ProductDeleteGalleryImage(productId, imageId),
    "DELETE",
    undefined,
    token
  );
};
 

