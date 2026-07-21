import axios from "axios";
import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";

// PUT /api/admin/bnpl/applications/{id} - assign beneficiary email, name, phone
export const updateBNPLApplication = async (
  id: number | string,
  payload: {
    beneficiary_email?: string;
    beneficiary_name?: string;
    beneficiary_phone?: string;
    beneficiary_relationship?: string;
  },
  token: string
): Promise<{ status: string; data: unknown; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLApplicationUpdate(id),
    "PUT",
    payload,
    token
  );
};

// PUT /api/admin/bnpl/applications/{id}/offer - change loan amount, down payment, tenor, interest & fees
export const updateBNPLLoanOffer = async (
  id: number | string,
  payload: {
    loan_amount?: number;
    down_payment?: number;
    repayment_duration?: number;
    interest_rate?: number;
    management_fee_percentage?: number;
    legal_fee_percentage?: number;
    insurance_fee_percentage?: number;
  },
  token: string
): Promise<{ status: string; data: unknown; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLApplicationUpdateOffer(id),
    "PUT",
    payload,
    token
  );
};

// PUT /api/admin/bnpl/applications/{id}/status
export const updateBNPLApplicationStatus = async (
  id: number | string,
  payload: {
    status: string;
    admin_notes?: string;
    counter_offer_min_deposit?: number;
    counter_offer_min_tenor?: number;
  },
  token: string
): Promise<{ status: string; data: unknown; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLApplicationUpdateStatus(id),
    "PUT",
    payload,
    token
  );
};

// PUT /api/admin/bnpl/guarantors/{id}/status
export const updateBNPLGuarantorStatus = async (
  id: number | string,
  payload: {
    status: string;
    admin_notes?: string;
  },
  token: string
): Promise<{ status: string; data: unknown; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLGuarantorUpdateStatus(id),
    "PUT",
    payload,
    token
  );
};

// POST /api/admin/bnpl/applications/{id}/guarantor - admin set guarantor for application
export const setBNPLApplicationGuarantor = async (
  applicationId: number | string,
  payload: {
    full_name: string;
    phone: string;
    email?: string;
    relationship?: string;
  },
  token: string
): Promise<{ status: string; data?: any; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLApplicationSetGuarantor(applicationId),
    "POST",
    payload,
    token
  );
};

// PUT /api/admin/bnpl/applications/{id}/installation-date/accept
export const acceptBNPLInstallationDate = async (
  applicationId: number | string,
  token: string
): Promise<{ status: string; data?: any; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLApplicationInstallationDateAccept(applicationId),
    "PUT",
    undefined,
    token
  );
};

// PUT /api/admin/bnpl/applications/{id}/installation-date/reject
export const rejectBNPLInstallationDate = async (
  applicationId: number | string,
  token: string
): Promise<{ status: string; data?: any; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLApplicationInstallationDateReject(applicationId),
    "PUT",
    undefined,
    token
  );
};

// PUT /api/admin/bnpl/settings
export const updateBNPLSettings = async (
  payload: {
    interest_rate_percentage?: number;
    min_down_percentage?: number;
    down_payment_options?: number[];
    management_fee_percentage?: number;
    legal_fee_percentage?: number;
    insurance_fee_percentage?: number;
    minimum_loan_amount?: number;
    credit_check_fee?: number;
    loan_durations?: number[];
  },
  token: string
): Promise<{ status: string; data?: any; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLSettingsUpdate,
    "PUT",
    payload,
    token
  );
};

// POST /api/admin/bnpl/guarantor-form - upload PDF (FormData: guarantor_form)
export const uploadBNPLGuarantorForm = async (
  file: File,
  token: string
): Promise<{ status: string; data?: any; message: string }> => {
  const formData = new FormData();
  formData.append("guarantor_form", file);
  const res = await axios.post(
    API_ENDPOINTS.ADMIN.BNPLGuarantorFormUpload,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
};

// POST /api/admin/site/banner — FormData: banner, placement home|sidebar
export const uploadSiteBanner = async (
  file: File,
  token: string,
  placement: "home" | "sidebar" = "home"
): Promise<{
  status: string;
  data?: { url?: string; path?: string; placement?: string };
  message: string;
}> => {
  const formData = new FormData();
  formData.append("banner", file);
  formData.append("placement", placement);
  const res = await axios.post(API_ENDPOINTS.ADMIN.SiteBannerUpload, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// DELETE /api/admin/site/banner?placement=home|sidebar
export const deleteSiteBanner = async (
  token: string,
  placement: "home" | "sidebar" = "home"
): Promise<{ status: string; message: string }> => {
  const url = `${API_ENDPOINTS.ADMIN.SiteBannerDelete}?placement=${encodeURIComponent(placement)}`;
  return await apiCall(url, "DELETE", undefined, token);
};

// PUT /api/admin/orders/buy-now/{id}/status
export const updateBuyNowOrderStatus = async (
  id: number | string,
  payload: {
    order_status: string;
    admin_notes?: string;
  },
  token: string
): Promise<{ status: string; data: unknown; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BuyNowOrderUpdateStatus(id),
    "PUT",
    payload,
    token
  );
};

// POST /api/admin/cart/create-custom-order
export const createCustomOrder = async (
  payload: {
    user_id: number;
    order_type: "buy_now" | "bnpl";
    items: Array<{
      type: "product" | "bundle";
      id: number;
      quantity?: number;
    }>;
    custom_items?: Array<{
      name: string;
      description?: string;
      price: number;
      quantity?: number;
    }>;
    send_email?: boolean;
    email_message?: string;
  },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.CreateCustomOrder,
    "POST",
    payload,
    token
  );
};

// DELETE /api/admin/cart/user/{userId}/item/{itemId}
export const removeCartItem = async (
  userId: number | string,
  itemId: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.RemoveCartItem(userId, itemId),
    "DELETE",
    undefined,
    token
  );
};

// DELETE /api/admin/cart/user/{userId}/clear
export const clearUserCart = async (
  userId: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.ClearUserCart(userId),
    "DELETE",
    undefined,
    token
  );
};

// POST /api/admin/cart/resend-email/{userId}
export const resendCartEmail = async (
  userId: number | string,
  payload: {
    order_type: "buy_now" | "bnpl";
    email_message?: string;
  },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.ResendCartEmail(userId),
    "POST",
    payload,
    token
  );
};

// POST /api/admin/cart/custom-orders/{id}/resend
export const resendCustomOrderEmail = async (
  id: number | string,
  payload: {
    order_type?: "buy_now" | "bnpl";
    email_message?: string;
  },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.CustomOrderResend(id),
    "POST",
    payload,
    token
  );
};

// PUT /api/admin/audit/requests/{id}/status
export const updateAuditRequestStatus = async (
  id: number | string,
  payload: {
    status: "approved" | "rejected" | "completed";
    admin_notes?: string;
    approval_payment_date?: string;
    approval_payment_time?: string;
    approval_payment_amount?: number;
    approval_payment_account_details?: string;
    customer_has_paid?: boolean;
    customer_payment_date?: string;
    customer_payment_time?: string;
    force_payment_confirmation_email?: boolean;
    property_state?: string;
    property_address?: string;
    contact_name?: string;
    contact_phone?: string;
  },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.AuditRequestUpdateStatus(id),
    "PUT",
    payload,
    token
  );
};

// POST /api/admin/audit/requests/{id}/payment-receipt
export const uploadAuditPaymentReceipt = async (
  id: number | string,
  file: File,
  token: string
): Promise<{ status: string; data?: any; message: string }> => {
  const formData = new FormData();
  formData.append("payment_receipt", file);
  const res = await axios.post(
    API_ENDPOINTS.ADMIN.AuditRequestPaymentReceipt(id),
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
};

export const setMonoUserBvn = async (
  userId: number | string,
  payload: { bvn: string },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.MonoUserSetBvn(userId),
    "POST",
    payload,
    token
  );
};

export const runMonoUserCreditCheck = async (
  userId: number | string,
  payload: { bvn?: string; loan_amount?: number; repayment_duration?: number },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.MonoUserCreditCheck(userId),
    "POST",
    payload,
    token
  );
};

export const fetchMonoUserStatementPdf = async (
  userId: number | string,
  payload: { period?: string },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.MonoUserStatementPdf(userId),
    "POST",
    payload,
    token
  );
};

