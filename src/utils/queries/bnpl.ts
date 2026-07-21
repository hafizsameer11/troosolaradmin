import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";

// GET /api/admin/bnpl/applications
export const getBNPLApplications = async (
  token: string,
  params?: {
    status?: string;
    customer_type?: string;
    search?: string;
    user_id?: number | string;
    per_page?: number;
    page?: number;
  }
): Promise<any> => {
  let url = API_ENDPOINTS.ADMIN.BNPLApplicationsList;
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append("status", params.status);
    if (params.customer_type) queryParams.append("customer_type", params.customer_type);
    if (params.search) queryParams.append("search", params.search);
    if (params.user_id != null && params.user_id !== "") {
      queryParams.append("user_id", String(params.user_id));
    }
    if (params.per_page) queryParams.append("per_page", params.per_page.toString());
    if (params.page) queryParams.append("page", params.page.toString());
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return await apiCall(url, "GET", undefined, token);
};

// GET /api/admin/bnpl/applications/{id}
export const getBNPLApplication = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLApplicationShow(id),
    "GET",
    undefined,
    token
  );
};

// GET /api/admin/bnpl/settings
export const getBNPLSettings = async (token: string): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLSettingsGet,
    "GET",
    undefined,
    token
  );
};

export type SiteBannerSlot = { url?: string | null; path?: string | null };

// GET /api/admin/site/banner — home + sidebar slots (legacy url/path = home)
export const getSiteBanner = async (
  token: string
): Promise<{
  status: string;
  data?: {
    home?: SiteBannerSlot;
    sidebar?: SiteBannerSlot;
    url?: string | null;
    path?: string | null;
  };
  message: string;
}> => {
  return await apiCall(API_ENDPOINTS.ADMIN.SiteBannerGet, "GET", undefined, token);
};

// GET /api/admin/bnpl/guarantors
export const getBNPLGuarantors = async (
  token: string,
  params?: {
    status?: string;
    per_page?: number;
    page?: number;
  }
): Promise<any> => {
  let url = API_ENDPOINTS.ADMIN.BNPLGuarantorsList;
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append("status", params.status);
    if (params.per_page) queryParams.append("per_page", params.per_page.toString());
    if (params.page) queryParams.append("page", params.page.toString());
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return await apiCall(url, "GET", undefined, token);
};

// GET /api/admin/orders/buy-now
export const getBuyNowOrders = async (
  token: string,
  params?: {
    status?: string;
    search?: string;
    per_page?: number;
    page?: number;
  }
): Promise<any> => {
  let url = API_ENDPOINTS.ADMIN.BuyNowOrdersList;
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append("status", params.status);
    if (params.search) queryParams.append("search", params.search);
    if (params.per_page) queryParams.append("per_page", params.per_page.toString());
    if (params.page) queryParams.append("page", params.page.toString());
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return await apiCall(url, "GET", undefined, token);
};

// GET /api/admin/orders/buy-now/{id}
export const getBuyNowOrder = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BuyNowOrderShow(id),
    "GET",
    undefined,
    token
  );
};

// GET /api/admin/orders/bnpl
export const getBNPLOrders = async (
  token: string,
  params?: {
    status?: string;
    search?: string;
    user_id?: number | string;
    per_page?: number;
    page?: number;
  }
): Promise<any> => {
  let url = API_ENDPOINTS.ADMIN.BNPLOrdersList;
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append("status", params.status);
    if (params.search) queryParams.append("search", params.search);
    if (params.user_id != null && params.user_id !== "") {
      queryParams.append("user_id", String(params.user_id));
    }
    if (params.per_page) queryParams.append("per_page", params.per_page.toString());
    if (params.page) queryParams.append("page", params.page.toString());
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return await apiCall(url, "GET", undefined, token);
};

// GET /api/admin/orders/bnpl/{id}
export const getBNPLOrder = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.BNPLOrderShow(id),
    "GET",
    undefined,
    token
  );
};

// GET /api/orders/{id}/summary
export const getOrderSummary = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.OrderSummary(id),
    "GET",
    undefined,
    token
  );
};

// GET /api/orders/{id}/invoice-details
export const getOrderInvoiceDetails = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.OrderInvoiceDetails(id),
    "GET",
    undefined,
    token
  );
};

// GET /api/admin/cart/products
export const getCartProducts = async (
  token: string,
  params?: {
    category_id?: number;
    brand_id?: number;
    type?: "all" | "products" | "bundles";
  }
): Promise<any> => {
  let url = API_ENDPOINTS.ADMIN.GetCartProducts;
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.category_id) queryParams.append("category_id", params.category_id.toString());
    if (params.brand_id) queryParams.append("brand_id", params.brand_id.toString());
    if (params.type) queryParams.append("type", params.type);
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return await apiCall(url, "GET", undefined, token);
};

// GET /api/admin/cart/user/{userId}
export const getUserCart = async (
  userId: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.GetUserCart(userId),
    "GET",
    undefined,
    token
  );
};

// GET /api/admin/cart/custom-orders
export const getCustomOrders = async (
  token: string,
  params?: {
    search?: string;
    order_type?: string;
    per_page?: number;
    page?: number;
  }
): Promise<any> => {
  let url = API_ENDPOINTS.ADMIN.CustomOrdersList;
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.order_type) queryParams.append("order_type", params.order_type);
    if (params.per_page) queryParams.append("per_page", params.per_page.toString());
    if (params.page) queryParams.append("page", params.page.toString());
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return await apiCall(url, "GET", undefined, token);
};

// GET /api/admin/cart/custom-orders/{id}
export const getCustomOrder = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.CustomOrderShow(id),
    "GET",
    undefined,
    token
  );
};

// GET /api/admin/audit/requests
export const getAuditRequests = async (
  token: string,
  params?: {
    status?: string;
    audit_type?: string;
    search?: string;
    per_page?: number;
    page?: number;
  }
): Promise<any> => {
  let url = API_ENDPOINTS.ADMIN.AuditRequestsList;
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append("status", params.status);
    if (params.audit_type) queryParams.append("audit_type", params.audit_type);
    if (params.search) queryParams.append("search", params.search);
    if (params.per_page) queryParams.append("per_page", params.per_page.toString());
    if (params.page) queryParams.append("page", params.page.toString());
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return await apiCall(url, "GET", undefined, token);
};

// GET /api/admin/audit/requests/{id}
export const getAuditRequest = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.AuditRequestShow(id),
    "GET",
    undefined,
    token
  );
};

// GET /api/admin/audit/users-with-requests
export const getUsersWithAuditRequests = async (
  token: string,
  params?: {
    search?: string;
    audit_type?: string;
    has_pending?: boolean;
    sort_by?: string;
    sort_order?: string;
    per_page?: number;
    page?: number;
  }
): Promise<any> => {
  let url = API_ENDPOINTS.ADMIN.AuditUsersWithRequests;
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.audit_type) queryParams.append("audit_type", params.audit_type);
    if (params.has_pending !== undefined) queryParams.append("has_pending", params.has_pending.toString());
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);
    if (params.per_page) queryParams.append("per_page", params.per_page.toString());
    if (params.page) queryParams.append("page", params.page.toString());
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return await apiCall(url, "GET", undefined, token);
};

const appendQuery = (base: string, params?: Record<string, string | number | boolean | undefined>) => {
  if (!params) return base;
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, String(value));
    }
  });
  const queryString = queryParams.toString();
  return queryString ? `${base}?${queryString}` : base;
};

export const getMonoStatus = async (token: string): Promise<any> => {
  return await apiCall(API_ENDPOINTS.ADMIN.MonoStatus, "GET", undefined, token);
};

export const getMonoLinkedAccounts = async (
  token: string,
  params?: { status?: string; search?: string; per_page?: number; page?: number }
): Promise<any> => {
  return await apiCall(
    appendQuery(API_ENDPOINTS.ADMIN.MonoLinkedAccounts, params),
    "GET",
    undefined,
    token
  );
};

export const getMonoCreditSessions = async (
  token: string,
  params?: {
    status?: string;
    can_afford?: boolean;
    user_id?: number;
    search?: string;
    per_page?: number;
    page?: number;
  }
): Promise<any> => {
  return await apiCall(
    appendQuery(API_ENDPOINTS.ADMIN.MonoCreditSessions, params),
    "GET",
    undefined,
    token
  );
};

export const getMonoCreditSession = async (
  id: number | string,
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.MonoCreditSessionShow(id),
    "GET",
    undefined,
    token
  );
};

export const getMonoWebhookEvents = async (
  token: string,
  params?: { event?: string; mono_account_id?: string; search?: string; per_page?: number; page?: number }
): Promise<any> => {
  return await apiCall(
    appendQuery(API_ENDPOINTS.ADMIN.MonoWebhookEvents, params),
    "GET",
    undefined,
    token
  );
};

export const getMonoUserDocuments = async (
  userId: number | string,
  token: string,
  period = "last6months"
): Promise<any> => {
  return await apiCall(
    `${API_ENDPOINTS.ADMIN.MonoUserDocuments(userId)}?period=${encodeURIComponent(period)}`,
    "GET",
    undefined,
    token
  );
};

