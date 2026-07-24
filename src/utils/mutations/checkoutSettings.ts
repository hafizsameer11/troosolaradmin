import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";
import type { CheckoutSettingsChannel } from "../queries/checkoutSettings";

export type CheckoutSettingsPayload = {
  channel?: CheckoutSettingsChannel;
  delivery_fee?: number;
  category_delivery_fees?: Record<string, number>;
  category_installation_fees?: Record<string, number>;
  category_materials_fees?: Record<string, number>;
  category_inspection_fees?: Record<string, number>;
  delivery_min_working_days?: number;
  delivery_max_working_days?: number;
  /** @deprecated legacy flat NGN */
  insurance_fee?: number;
  vat_percentage?: number;
  insurance_fee_percentage?: number;
  installation_flat_addon?: number;
  installation_materials_cost?: number;
  installation_schedule_working_days?: number;
  installation_description?: string;
};

export const updateCheckoutSettings = async (
  payload: CheckoutSettingsPayload,
  token: string,
  channel: CheckoutSettingsChannel = "buy_now"
): Promise<any> => {
  const url = `${API_ENDPOINTS.ADMIN.CheckoutSettingsUpdate}?channel=${encodeURIComponent(channel)}`;
  return await apiCall(url, "PUT", { ...payload, channel }, token);
};
