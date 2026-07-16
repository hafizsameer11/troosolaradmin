const API_DOMAIN = "https://api.troosolar.com/api";
export const API_ORIGIN = API_DOMAIN.replace(/\/api\/?$/, "");


// const API_DOMAIN = "http://localhost:8000/api";



const API_ENDPOINTS = {
  ADMIN: {
    // --- Auth ---
    Login: API_DOMAIN + "/admin-login", // POST
    Logout: API_DOMAIN + "/logout", // POST

    // --- Dashboard ---
    Dashboard: API_DOMAIN + "/admin/dashboard", // GET

    // --- Users (admin view) ---
    UsersList: API_DOMAIN + "/all-users", // GET
    AdminsList: API_DOMAIN + "/admin/admins", // GET
    CurrentAdmin: API_DOMAIN + "/admin/me", // GET
    UserUpdate: (id: number | string) => `${API_DOMAIN}/update-user/${id}`, // POST
    UserShow: (id: number | string) => `${API_DOMAIN}/single-user/${id}`, // GET

    //Update User
    UpdateUser: API_DOMAIN + "/update-user", // POST

    // --- Loans (admin tools) ---
    AllLoanStatus: API_DOMAIN + "/all-loan-status", // GET
    FullLoanDetail: (loanId: number | string) =>
      `${API_DOMAIN}/full-loan-detail/${loanId}`, // GET
    SingleLoanDetail: (id: number | string) =>
      `${API_DOMAIN}/single-loan-detail/${id}`, // GET
    AllLoanDistributed: API_DOMAIN + "/all-loan-distributed", // GET
    LoanDistribute: (calcId: number | string) =>
      `${API_DOMAIN}/loan-distributed/${calcId}`, // POST

    // --- KYC / Partner handoff ---
    SingleDocument: (id: number | string) =>
      `${API_DOMAIN}/single-document/${id}`, // GET
    SingleBeneficiary: (id: number | string) =>
      `${API_DOMAIN}/single-beneficiary/${id}`, // GET
    SendToPartner: (loanId: number | string) =>
      `${API_DOMAIN}/send-to-partner/${loanId}`, // POST
    LinkAccounts: (userId: number | string) =>
      `${API_DOMAIN}/link-accounts/${userId}`, // GET

    // --- Orders (admin/shop) ---
    OrdersList: API_DOMAIN + "/orders", // GET
    OrderShow: (id: number | string) => `${API_DOMAIN}/orders/${id}`, // GET

    OrderShowUser: (id: number | string) => `${API_DOMAIN}/orders/user/${id}`, // GET

    // --- Products (admin/shop) ---
    ProductsList: API_DOMAIN + "/products", // GET
    ProductCreate: API_DOMAIN + "/products", // POST
    ProductShow: (id: number | string) => `${API_DOMAIN}/products/${id}`, // GET
    ProductUpdate: (id: number | string) => `${API_DOMAIN}/products/${id}/update`, // POST
    ProductDelete: (id: number | string) => `${API_DOMAIN}/products/${id}`, // DELETE
    ProductReviewsAdminList: (productId?: number | string) =>
      `${API_DOMAIN}/admin/product-reviews${productId ? `?product_id=${productId}` : ""}`, // GET
    ProductReviewAdminUpdate: (id: number | string) =>
      `${API_DOMAIN}/admin/product-reviews/${id}`, // PUT
    ProductReviewAdminReply: (id: number | string) =>
      `${API_DOMAIN}/admin/product-reviews/${id}/reply`, // PUT
    ProductReviewAdminDelete: (id: number | string) =>
      `${API_DOMAIN}/admin/product-reviews/${id}`, // DELETE

    // --- Bundles (admin/shop) ---
    BundleCreate: API_DOMAIN + "/bundles", // POST
    BundleList: API_DOMAIN + "/bundles", // GET
    BundleShow: (id: number | string) => `${API_DOMAIN}/bundles/${id}`, // GET
    BundleUpdate: (id: number | string) => `${API_DOMAIN}/bundles/${id}/update`, // POST
    DeleteBundle: (id: number | string) => `${API_DOMAIN}/bundles/${id}`, // DELETE

    // --- Bundle Materials ---
    BundleMaterialsList: (bundleId: number | string) =>
      `${API_DOMAIN}/bundles/${bundleId}/materials`, // GET
    BundleMaterialAdd: (bundleId: number | string) =>
      `${API_DOMAIN}/bundles/${bundleId}/materials`, // POST
    BundleMaterialUpdate: (bundleId: number | string, materialId: number | string) =>
      `${API_DOMAIN}/bundles/${bundleId}/materials/${materialId}`, // PUT
    BundleMaterialDelete: (bundleId: number | string, materialId: number | string) =>
      `${API_DOMAIN}/bundles/${bundleId}/materials/${materialId}`, // DELETE
    BundleMaterialsBulkAdd: (bundleId: number | string) =>
      `${API_DOMAIN}/bundles/${bundleId}/materials/bulk`, // POST

    // --- Transactions (admin) ---
    TransactionsList: API_DOMAIN + "/transactions", // GET
    TransactionShow: (id: number | string) =>
      `${API_DOMAIN}/transactions/user/${id}`, // GET

    AllTransaction: API_DOMAIN + "/admin/users", // GET

    // --- Balances (admin) ---
    AllBalances: API_DOMAIN + "/all-balances", // GET

    // --- Tickets ---
    AllTickets: API_DOMAIN + "/admin/tickets", // GET
    TicketShow: (id: number | string) => `${API_DOMAIN}/admin/tickets/${id}`, // GET
    ReplyTicket: (id: number | string) =>
      `${API_DOMAIN}/admin/tickets/${id}/reply`, // POST

    // --- Admin notifications ---
    AdminNotificationsCreate: API_DOMAIN + "/admin/notifications", // POST

    // === Notifications
    NotificationsList: API_DOMAIN + "/admin/notifications", // GET
    AddNotification: API_DOMAIN + "/admin/notifications", // POST
    DeleteNotification: (id: number | string) =>
      `${API_DOMAIN}/admin/notifications/${id}`, // DELETE
    UpdateNotification: (id: number | string) =>
      `${API_DOMAIN}/admin/notifications/${id}`, // POST

    // === Banner
    BannersList: API_DOMAIN + "/admin/banners", // GET
    AddBanner: API_DOMAIN + "/admin/banners", // POST
    DeleteBanner: (id: number | string) => `${API_DOMAIN}/admin/banners/${id}`, // DELETE
    UpdateBanner: (id: number | string) => `${API_DOMAIN}/admin/banners/${id}`, // POST

    // === Financing Partners
    FinancingPartnersList: API_DOMAIN + "/admin/all-partners", // GET
    AddFinancingPartner: API_DOMAIN + "/admin/add-partner", // POST
    DeleteFinancingPartner: (id: number | string) =>
      `${API_DOMAIN}/admin/delete_partner/${id}`, // DELETE
    UpdateFinancingPartner: (id: number | string) =>
      `${API_DOMAIN}/admin/update-partner/${id}`, // POST

    // === Settings -- Categoriesq
    CategoriesList: API_DOMAIN + "/categories", // GET
    AddCategory: API_DOMAIN + "/categories", // POST
    DeleteCategory: (id: number | string) => `${API_DOMAIN}/categories/${id}`, // DELETE
    UpdateCategory: (id: number | string) => `${API_DOMAIN}/categories/${id}/update`, // POST

    // === Settings -- Brands
    BrandsList: API_DOMAIN + "/brands", // GET
    AddBrand: API_DOMAIN + "/brands", // POST
    DeleteBrand: (id: number | string) => `${API_DOMAIN}/brands/${id}`, // DELETE
    UpdateBrand: (id: number | string) => `${API_DOMAIN}/brands/${id}`, // POST
    BrandById: (id: number | string) => `${API_DOMAIN}/brands/${id}`, // GET
    BrandByCategory: (category: string) =>
      `${API_DOMAIN}/categories/${category}/brands`, // GET
    GetSingleBrandByCategory: (category: string, brandId: number | string) =>
      `${API_DOMAIN}/categories/${category}/brands/${brandId}`, // GET

    //Add User
    AddUser: API_DOMAIN + "/add-user", // POST

    //Kyc-Detail
    Get_User_Kyc_Detail: (id: number | string) =>
      `${API_DOMAIN}/loan-kyc-details/${id}`, // GET

    //Ticket Status Update
    TicketStatusUpdate: (id: number | string) =>
      `${API_DOMAIN}/admin/tickets/${id}/status`, // POST
    //Edit User
    EditUser: (id: number | string) =>
      `${API_DOMAIN}/admin/user/edit-user/${id}`, // POST

    //Post Send the Partner Detail
    SendToPartnerDetail: (id: number | string) =>
      `${API_DOMAIN}/admin/send-to-partner/${id}`, // POST

    //Mono - Loan - Calculation
    MonoLoanCalculation: API_DOMAIN + "/mono-loan-calculations", // GET
    MonoLoanCalculationApproval: (id: number | string) =>
      `${API_DOMAIN}/mono-loan/${id}`, // POST

    //Loan Grant
    LoanGrant: (id: number | string) =>
      `${API_DOMAIN}/loan-application-grant/${id}`, // POST

    //Repayment History
    RepaymentHistory: (id: number | string) =>
      `${API_DOMAIN}/admin/installments/with-history/${id}`, // GET

    UpdateOrderStatus: (id: number | string) =>
      `${API_DOMAIN}/admin/order-update-status/${id}`, // POST

    // --- BNPL Admin Endpoints ---
    BNPLApplicationsList: API_DOMAIN + "/admin/bnpl/applications", // GET
    BNPLApplicationShow: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/applications/${id}`, // GET
    BNPLApplicationUpdate: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/applications/${id}`, // PUT - assign beneficiary email etc
    BNPLApplicationUpdateOffer: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/applications/${id}/offer`, // PUT - change loan amount, down payment, tenor
    BNPLApplicationUpdateStatus: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/applications/${id}/status`, // PUT
    BNPLGuarantorsList: API_DOMAIN + "/admin/bnpl/guarantors", // GET
    BNPLGuarantorUpdateStatus: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/guarantors/${id}/status`, // PUT
    BNPLGuarantorFormUpload: API_DOMAIN + "/admin/bnpl/guarantor-form", // POST (multipart: guarantor_form)
    BNPLApplicationSetGuarantor: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/applications/${id}/guarantor`, // POST - admin sets guarantor for application
    BNPLApplicationInstallationDateAccept: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/applications/${id}/installation-date/accept`, // PUT
    BNPLApplicationInstallationDateReject: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/applications/${id}/installation-date/reject`, // PUT
    BNPLSettingsGet: API_DOMAIN + "/admin/bnpl/settings", // GET
    BNPLSettingsUpdate: API_DOMAIN + "/admin/bnpl/settings", // PUT
    MonoLinkedAccounts: API_DOMAIN + "/admin/bnpl/mono/linked-accounts", // GET
    MonoCreditSessions: API_DOMAIN + "/admin/bnpl/mono/credit-sessions", // GET
    MonoCreditSessionShow: (id: number | string) =>
      `${API_DOMAIN}/admin/bnpl/mono/credit-sessions/${id}`, // GET
    MonoWebhookEvents: API_DOMAIN + "/admin/bnpl/mono/webhook-events", // GET
    MonoStatus: API_DOMAIN + "/admin/bnpl/mono/status", // GET
    MonoUserSetBvn: (userId: number | string) =>
      `${API_DOMAIN}/admin/bnpl/mono/users/${userId}/bvn`, // POST
    MonoUserCreditCheck: (userId: number | string) =>
      `${API_DOMAIN}/admin/bnpl/mono/users/${userId}/credit-check`, // POST
    MonoUserDocuments: (userId: number | string) =>
      `${API_DOMAIN}/admin/bnpl/mono/users/${userId}/documents`, // GET
    MonoUserStatementPdf: (userId: number | string) =>
      `${API_DOMAIN}/admin/bnpl/mono/users/${userId}/statement-pdf`, // POST

    // --- Site Banner (dashboard home promo) ---
    SiteBannerGet: API_DOMAIN + "/admin/site/banner", // GET
    SiteBannerUpload: API_DOMAIN + "/admin/site/banner", // POST multipart: banner
    SiteBannerDelete: API_DOMAIN + "/admin/site/banner", // DELETE

    SiteFaqsList: API_DOMAIN + "/admin/site/faqs", // GET
    SiteFaqReorder: API_DOMAIN + "/admin/site/faqs/reorder", // POST
    SiteFaqCreate: API_DOMAIN + "/admin/site/faqs", // POST
    SiteFaqUpdate: (id: number | string) => `${API_DOMAIN}/admin/site/faqs/${id}`, // PUT
    SiteFaqDelete: (id: number | string) => `${API_DOMAIN}/admin/site/faqs/${id}`, // DELETE

    TicketSubjectsList: API_DOMAIN + "/admin/site/ticket-subjects", // GET
    TicketSubjectCreate: API_DOMAIN + "/admin/site/ticket-subjects", // POST
    TicketSubjectUpdate: (id: number | string) => `${API_DOMAIN}/admin/site/ticket-subjects/${id}`, // PUT
    TicketSubjectDelete: (id: number | string) => `${API_DOMAIN}/admin/site/ticket-subjects/${id}`, // DELETE

    // --- Calculator Settings ---
    CalculatorSettingsGet: API_DOMAIN + "/admin/calculator-settings", // GET
    CalculatorSettingsUpdate: API_DOMAIN + "/admin/calculator-settings", // PUT

    // --- Shop checkout (delivery fee, estimates, installation copy) ---
    CheckoutSettingsGet: API_DOMAIN + "/admin/checkout-settings", // GET
    CheckoutSettingsUpdate: API_DOMAIN + "/admin/checkout-settings", // PUT

    // --- Buy Now Admin Endpoints ---
    BuyNowOrdersList: API_DOMAIN + "/admin/orders/buy-now", // GET
    BuyNowOrderShow: (id: number | string) =>
      `${API_DOMAIN}/admin/orders/buy-now/${id}`, // GET
    BuyNowOrderUpdateStatus: (id: number | string) =>
      `${API_DOMAIN}/admin/orders/buy-now/${id}/status`, // PUT
    BNPLOrdersList: API_DOMAIN + "/admin/orders/bnpl", // GET
    BNPLOrderShow: (id: number | string) =>
      `${API_DOMAIN}/admin/orders/bnpl/${id}`, // GET

    // --- Order Details Endpoints ---
    OrderSummary: (id: number | string) =>
      `${API_DOMAIN}/orders/${id}/summary`, // GET
    OrderInvoiceDetails: (id: number | string) =>
      `${API_DOMAIN}/orders/${id}/invoice-details`, // GET

    // --- Configuration Endpoints ---
    LoanConfiguration: API_DOMAIN + "/config/loan-configuration", // GET
    AddOns: API_DOMAIN + "/config/add-ons", // GET
    DeliveryLocations: (stateId?: number | string) =>
      stateId
        ? `${API_DOMAIN}/config/delivery-locations?state_id=${stateId}`
        : `${API_DOMAIN}/config/delivery-locations`, // GET

    // --- Audit Request Admin Endpoints ---
    AuditRequestsList: API_DOMAIN + "/admin/audit/requests", // GET
    AuditRequestShow: (id: number | string) =>
      `${API_DOMAIN}/admin/audit/requests/${id}`, // GET
    AuditRequestUpdateStatus: (id: number | string) =>
      `${API_DOMAIN}/admin/audit/requests/${id}/status`, // PUT
    AuditRequestPaymentReceipt: (id: number | string) =>
      `${API_DOMAIN}/admin/audit/requests/${id}/payment-receipt`, // POST
    AuditUsersWithRequests: API_DOMAIN + "/admin/audit/users-with-requests", // GET

    // --- Custom Order Admin Endpoints ---
    CreateCustomOrder: API_DOMAIN + "/admin/cart/create-custom-order", // POST
    GetCartProducts: API_DOMAIN + "/admin/cart/products", // GET
    GetUserCart: (userId: number | string) =>
      `${API_DOMAIN}/admin/cart/user/${userId}`, // GET
    RemoveCartItem: (userId: number | string, itemId: number | string) =>
      `${API_DOMAIN}/admin/cart/user/${userId}/item/${itemId}`, // DELETE
    ClearUserCart: (userId: number | string) =>
      `${API_DOMAIN}/admin/cart/user/${userId}/clear`, // DELETE
    ResendCartEmail: (userId: number | string) =>
      `${API_DOMAIN}/admin/cart/resend-email/${userId}`, // POST

    // --- Analytics Admin Endpoints ---
    Analytics: API_DOMAIN + "/admin/analytics", // GET

    // --- Referral Management Admin Endpoints ---
    ReferralSettings: API_DOMAIN + "/admin/referral/settings", // GET, PUT
    ReferralList: API_DOMAIN + "/admin/referral/list", // GET
    ReferralReferredSignups: API_DOMAIN + "/admin/referral/referred-signups", // GET
    ReferralUserDetails: (userId: number | string) =>
      `${API_DOMAIN}/admin/referral/user/${userId}`, // GET

    // --- Material Management Endpoints ---
    // Seeder Routes
    SeedAll: API_DOMAIN + "/seed/all", // GET
    SeedRun: API_DOMAIN + "/seed/run", // POST

    // Material Category Routes
    MaterialCategoriesList: API_DOMAIN + "/material-categories", // GET
    MaterialCategoryShow: (id: number | string) =>
      `${API_DOMAIN}/material-categories/${id}`, // GET
    MaterialCategoryCreate: API_DOMAIN + "/material-categories", // POST
    MaterialCategoryUpdate: (id: number | string) =>
      `${API_DOMAIN}/material-categories/${id}`, // PUT
    MaterialCategoryDelete: (id: number | string) =>
      `${API_DOMAIN}/material-categories/${id}`, // DELETE

    // Material Routes
    MaterialsList: API_DOMAIN + "/materials", // GET
    MaterialsByCategory: (categoryId: number | string) =>
      `${API_DOMAIN}/materials/category/${categoryId}`, // GET
    MaterialShow: (id: number | string) =>
      `${API_DOMAIN}/materials/${id}`, // GET
    MaterialCreate: API_DOMAIN + "/materials", // POST
    MaterialUpdate: (id: number | string) =>
      `${API_DOMAIN}/materials/${id}`, // PUT
    MaterialDelete: (id: number | string) =>
      `${API_DOMAIN}/materials/${id}`, // DELETE
  },
};

export { API_DOMAIN, API_ENDPOINTS };
