import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";

export type CheckoutSettingsPayload = {
  delivery_fee?: number;
  category_delivery_fees?: Record<string, number>;
  delivery_min_working_days?: number;
  delivery_max_working_days?: number;
  /** @deprecated legacy flat NGN */
  insurance_fee?: number;
  vat_percentage?: number;
  insurance_fee_percentage?: number;
  installation_flat_addon?: number;
  installation_schedule_working_days?: number;
  installation_description?: string;
};

export const updateCheckoutSettings = async (
  payload: CheckoutSettingsPayload,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.CheckoutSettingsUpdate,
    "PUT",
    payload,
    token
  );
};
