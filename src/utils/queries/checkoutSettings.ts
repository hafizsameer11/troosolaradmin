import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";

export type CheckoutSettingsChannel = "buy_now" | "shop";

export const getCheckoutSettings = async (
  token: string,
  channel: CheckoutSettingsChannel = "buy_now"
): Promise<any> => {
  const url = `${API_ENDPOINTS.ADMIN.CheckoutSettingsGet}?channel=${encodeURIComponent(channel)}`;
  return await apiCall(url, "GET", undefined, token);
};
