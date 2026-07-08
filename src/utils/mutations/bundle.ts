import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";

export type CustomAppliancePayload = {
  name: string;
  wattage: number;
  quantity?: number;
  estimated_daily_hours_usage?: number;
};

type BundleItemDetail = {
  product_id: number;
  quantity?: number;
  rate_override?: number | null;
};

type BundleMaterialDetail = {
  material_id: number;
  quantity?: number;
  rate_override?: number | null;
};

type BundleProductPayload = {
  title?: string;
  bundle_type?: string;
  is_available?: boolean;
  top_deal?: boolean;
  is_most_popular?: boolean;
  brand_id?: number | null;
  total_price?: number;
  discount_price?: number;
  discount_end_date?: string;
  featured_image?: File;
  items?: number[];
  items_detail?: BundleItemDetail[];
  materials_detail?: BundleMaterialDetail[];
  custom_services?: {
    title: string;
    service_amount: number;
    flow_type?: "buy_now" | "bnpl";
    quantity?: number;
    unit?: string;
    quantity_applies?: boolean;
  }[];
  product_model?: string;
  system_capacity_display?: string;
  detailed_description?: string;
  what_is_inside_bundle_text?: string;
  what_bundle_powers_text?: string;
  backup_time_description?: string;
  inver_rating?: string;
  total_output?: string;
  total_load?: string | null;
  custom_appliances?: CustomAppliancePayload[];
  specifications?: Record<string, string>;
};

// Add Bundle (mutation)
export const addBundle = async (
  data: BundleProductPayload,
  token: string
): Promise<unknown> => {
  const formData = new FormData();

  if (data.title) formData.append("title", data.title);
  if (data.bundle_type) formData.append("bundle_type", data.bundle_type);
  if (data.is_available !== undefined) {
    formData.append("is_available", data.is_available ? "1" : "0");
  }
  if (data.top_deal !== undefined) {
    formData.append("top_deal", data.top_deal ? "1" : "0");
  }
  if (data.is_most_popular !== undefined) {
    formData.append("is_most_popular", data.is_most_popular ? "1" : "0");
  }
  if (data.brand_id != null) {
    formData.append("brand_id", String(data.brand_id));
  } else {
    formData.append("brand_id", "");
  }
  if (data.total_price !== undefined) {
    formData.append("total_price", data.total_price.toString());
  }
  if (data.discount_price !== undefined) {
    formData.append("discount_price", data.discount_price.toString());
  }
  if (data.discount_end_date) {
    formData.append("discount_end_date", data.discount_end_date);
  }
  if (data.featured_image) {
    formData.append("featured_image", data.featured_image);
  }

  if (data.items_detail && data.items_detail.length > 0) {
    data.items_detail.forEach((item, i) => {
      formData.append(`items_detail[${i}][product_id]`, String(item.product_id));
      formData.append(`items_detail[${i}][quantity]`, String(item.quantity ?? 1));
      if (item.rate_override != null) {
        formData.append(`items_detail[${i}][rate_override]`, String(item.rate_override));
      }
    });
  } else if (data.items && data.items.length > 0) {
    data.items.forEach((itemId, index) => {
      formData.append(`items[${index}]`, itemId.toString());
    });
  }

  if (data.materials_detail && data.materials_detail.length > 0) {
    data.materials_detail.forEach((mat, i) => {
      formData.append(`materials_detail[${i}][material_id]`, String(mat.material_id));
      formData.append(`materials_detail[${i}][quantity]`, String(mat.quantity ?? 1));
      if (mat.rate_override != null) {
        formData.append(`materials_detail[${i}][rate_override]`, String(mat.rate_override));
      }
    });
  }

  if (data.custom_services !== undefined) {
    formData.append("custom_services", JSON.stringify(data.custom_services));
  }

  if (data.product_model) formData.append("product_model", data.product_model);
  if (data.system_capacity_display) formData.append("system_capacity_display", data.system_capacity_display);
  if (data.detailed_description) formData.append("detailed_description", data.detailed_description);
  if (data.what_is_inside_bundle_text) formData.append("what_is_inside_bundle_text", data.what_is_inside_bundle_text);
  if (data.what_bundle_powers_text) formData.append("what_bundle_powers_text", data.what_bundle_powers_text);
  if (data.backup_time_description) formData.append("backup_time_description", data.backup_time_description);
  if (data.inver_rating) formData.append("inver_rating", data.inver_rating);
  if (data.total_output) formData.append("total_output", data.total_output);
  if (data.total_load != null && data.total_load !== "") formData.append("total_load", String(data.total_load));

  if (data.custom_appliances && data.custom_appliances.length > 0) {
    formData.append("custom_appliances", JSON.stringify(data.custom_appliances));
  }

  if (data.specifications && Object.keys(data.specifications).length > 0) {
    formData.append("specifications", JSON.stringify(data.specifications));
  }

  return await apiCall(
    API_ENDPOINTS.ADMIN.BundleCreate,
    "POST",
    formData,
    token
  );
};

// Update Bundle (mutation)
export const updateBundle = async (
  id: number | string,
  data: BundleProductPayload,
  token: string
): Promise<unknown> => {
  const formData = new FormData();

  if (data.title) formData.append("title", data.title);
  if (data.bundle_type) formData.append("bundle_type", data.bundle_type);
  if (data.is_available !== undefined) {
    formData.append("is_available", data.is_available ? "1" : "0");
  }
  if (data.top_deal !== undefined) {
    formData.append("top_deal", data.top_deal ? "1" : "0");
  }
  if (data.is_most_popular !== undefined) {
    formData.append("is_most_popular", data.is_most_popular ? "1" : "0");
  }
  if (data.brand_id != null) {
    formData.append("brand_id", String(data.brand_id));
  } else {
    formData.append("brand_id", "");
  }
  if (data.total_price !== undefined) {
    formData.append("total_price", data.total_price.toString());
  }
  if (data.discount_price !== undefined) {
    formData.append("discount_price", data.discount_price.toString());
  }
  if (data.discount_end_date) {
    formData.append("discount_end_date", data.discount_end_date);
  }
  if (data.featured_image) {
    formData.append("featured_image", data.featured_image);
  }

  if (data.items_detail && data.items_detail.length > 0) {
    data.items_detail.forEach((item, i) => {
      formData.append(`items_detail[${i}][product_id]`, String(item.product_id));
      formData.append(`items_detail[${i}][quantity]`, String(item.quantity ?? 1));
      if (item.rate_override != null) {
        formData.append(`items_detail[${i}][rate_override]`, String(item.rate_override));
      }
    });
  } else if (data.items && data.items.length > 0) {
    data.items.forEach((itemId, index) => {
      formData.append(`items[${index}]`, itemId.toString());
    });
  }

  if (data.materials_detail && data.materials_detail.length > 0) {
    data.materials_detail.forEach((mat, i) => {
      formData.append(`materials_detail[${i}][material_id]`, String(mat.material_id));
      formData.append(`materials_detail[${i}][quantity]`, String(mat.quantity ?? 1));
      if (mat.rate_override != null) {
        formData.append(`materials_detail[${i}][rate_override]`, String(mat.rate_override));
      }
    });
  }

  if (data.custom_services !== undefined) {
    formData.append("custom_services", JSON.stringify(data.custom_services));
  }

  if (data.product_model) formData.append("product_model", data.product_model);
  if (data.system_capacity_display) formData.append("system_capacity_display", data.system_capacity_display);
  if (data.detailed_description) formData.append("detailed_description", data.detailed_description);
  if (data.what_is_inside_bundle_text) formData.append("what_is_inside_bundle_text", data.what_is_inside_bundle_text);
  if (data.what_bundle_powers_text) formData.append("what_bundle_powers_text", data.what_bundle_powers_text);
  if (data.backup_time_description) formData.append("backup_time_description", data.backup_time_description);
  if (data.inver_rating) formData.append("inver_rating", data.inver_rating);
  if (data.total_output) formData.append("total_output", data.total_output);
  if (data.total_load != null && data.total_load !== "") formData.append("total_load", String(data.total_load));

  if (data.custom_appliances && data.custom_appliances.length > 0) {
    formData.append("custom_appliances", JSON.stringify(data.custom_appliances));
  }

  if (data.specifications && Object.keys(data.specifications).length > 0) {
    formData.append("specifications", JSON.stringify(data.specifications));
  }

  return await apiCall(
    API_ENDPOINTS.ADMIN.BundleUpdate(id),
    "POST",
    formData,
    token
  );
};

// Delete Bundle (mutation)
export const deleteBundle = async (
  id: number | string,
  token: string
): Promise<unknown> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.DeleteBundle(id),
    "DELETE",
    undefined,
    token
  );
};
