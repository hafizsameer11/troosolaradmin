import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Header from "../../component/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatsLoadingSkeleton from "../../components/common/StatsLoadingSkeleton";
import images from "../../constants/images";
import {
  getBNPLApplications,
  getBNPLGuarantors,
  getBuyNowOrders,
  getBNPLOrders,
  getBNPLApplication,
  getBuyNowOrder,
  getBNPLOrder,
  getOrderSummary,
  getOrderInvoiceDetails,
  getCartProducts,
  getUserCart,
  getAuditRequests,
  getAuditRequest,
  getUsersWithAuditRequests,
  getBNPLSettings,
  getSiteBanner,
} from "../../utils/queries/bnpl";
import {
  updateBNPLApplication,
  updateBNPLLoanOffer,
  updateBNPLApplicationStatus,
  updateBNPLGuarantorStatus,
  updateBuyNowOrderStatus,
  createCustomOrder,
  removeCartItem,
  clearUserCart,
  resendCartEmail,
  updateAuditRequestStatus,
  uploadAuditPaymentReceipt,
  uploadBNPLGuarantorForm,
  setBNPLApplicationGuarantor,
  acceptBNPLInstallationDate,
  rejectBNPLInstallationDate,
  updateBNPLSettings,
  uploadSiteBanner,
  deleteSiteBanner,
} from "../../utils/mutations/bnpl";
import { sendToPartnerDetail } from "../../utils/mutations/loans";
import { getAllFinance } from "../../utils/queries/finance";
import { API_DOMAIN } from "../../../apiConfig";
import MonoLoansSection from "./MonoLoansSection";
import MonoApplicationTools from "./MonoApplicationTools";
import UserSearchSelect from "../../components/common/UserSearchSelect";
import { getAllUsers } from "../../utils/queries/users";

// Base URL for document links (backend stores paths like "loan_applications/xxx.pdf")
const DOCUMENT_BASE_URL = API_DOMAIN.replace(/\/api\/?$/, "") || "https://app.troosolar.io";

function siteBannerSlotPreview(slot?: { url?: string | null; path?: string | null } | null): string | null {
  if (!slot) return null;
  const url = slot.url;
  const path = slot.path;
  if (url && /^https?:\/\//i.test(String(url))) return String(url);
  if (path && /^https?:\/\//i.test(String(path))) return String(path);
  if (path) {
    const base = DOCUMENT_BASE_URL.replace(/\/$/, "");
    return `${base}/${String(path).replace(/^\//, "")}`;
  }
  return url ? String(url) : null;
}

function auditPaymentReceiptUrl(item: {
  customer_payment_receipt_url?: string | null;
  customer_payment_receipt_path?: string | null;
} | null | undefined): string | null {
  if (!item) return null;
  if (item.customer_payment_receipt_url && /^https?:\/\//i.test(String(item.customer_payment_receipt_url))) {
    return String(item.customer_payment_receipt_url);
  }
  if (item.customer_payment_receipt_path) {
    const base = DOCUMENT_BASE_URL.replace(/\/$/, "");
    return `${base}/${String(item.customer_payment_receipt_path).replace(/^\//, "")}`;
  }
  return null;
}

/** Estate name/address from loan_application row, with fallbacks (snapshot / audit_request on order). */
function bnplLoanAppEstateText(
  la: Record<string, unknown> | null | undefined,
  which: "name" | "address",
  auditFallback?: Record<string, unknown> | null
): string {
  const key = which === "name" ? "estate_name" : "estate_address";
  const altKey = which === "name" ? "estateName" : "estateAddress";

  const pick = (row: Record<string, unknown> | null | undefined): string | null => {
    if (!row) return null;
    const v = row[key] ?? row[altKey];
    if (v != null && String(v).trim() !== "") return String(v).trim();
    return null;
  };

  const fromLa = pick(la ?? null);
  if (fromLa) return fromLa;

  const snap = la?.loan_plan_snapshot;
  if (snap && typeof snap === "object" && !Array.isArray(snap)) {
    const o = snap as Record<string, unknown>;
    const fromRoot = pick(o);
    if (fromRoot) return fromRoot;
    const pd = o.property_details;
    if (pd && typeof pd === "object" && !Array.isArray(pd)) {
      const nested = pick(pd as Record<string, unknown>);
      if (nested) return nested;
    }
  }

  const fromAudit = pick(auditFallback ?? null);
  if (fromAudit) return fromAudit;

  return "—";
}

/** BVN from BNPL application row first, then user profile (both filled on submit after backend fix). */
function bnplDisplayBvn(
  app: { bvn?: string | null },
  user?: { bvn?: string | null } | null
): string | null {
  if (app?.bvn != null && String(app.bvn).trim() !== "") {
    return String(app.bvn).trim();
  }
  if (user?.bvn != null && String(user.bvn).trim() !== "") {
    return String(user.bvn).trim();
  }
  return null;
}

/** Submitted personal rows merged into loan_plan_snapshot.final_application_personal (BNPL Final Application step). */
function bnplFinalApplicationPersonalFromSnapshot(snapshot: unknown): {
  full_name: string | null;
  bvn: string | null;
  phone: string | null;
  email: string | null;
  social_media: string | null;
} | null {
  if (snapshot == null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const fa = (snapshot as Record<string, unknown>).final_application_personal;
  if (fa == null || typeof fa !== "object" || Array.isArray(fa)) {
    return null;
  }
  const p = fa as Record<string, unknown>;
  const s = (v: unknown): string | null =>
    v != null && String(v).trim() !== "" ? String(v).trim() : null;
  return {
    full_name: s(p.full_name),
    bvn: s(p.bvn),
    phone: s(p.phone),
    email: s(p.email),
    social_media: s(p.social_media),
  };
}

function bnplDash(v: string | null | undefined): string {
  if (v == null || String(v).trim() === "") return "—";
  return String(v).trim();
}

/** Human labels for Buy Now / BNPL solution category (Step 2). */
function labelProductCategory(value: unknown): string {
  const v = String(value || "").toLowerCase().trim();
  if (!v) return "";
  if (v === "full-kit") return "Solar panels, inverter, and battery solution";
  if (v === "inverter-battery") return "Inverter and battery solution";
  if (v === "battery-only") return "Battery only";
  if (v === "inverter-only") return "Inverter only";
  if (v === "panels-only") return "Solar panels only";
  if (v === "audit") return "Professional energy audit";
  return String(value).replace(/-/g, " ");
}

/**
 * Gated estate: Yes only if they chose “in a gated estate”; otherwise N/A (not gated or unknown).
 * API often sends 0/1 instead of booleans.
 */
function bnplGatedEstateLabel(value: unknown): string {
  if (value === true || value === 1 || value === "1" || value === "true") return "Yes";
  return "N/A";
}

/** Skip empty scalar rows in Additional Information — do not treat false/0 as “missing” (fixes gated estate row). */
function bnplSkipAdditionalInfoScalar(key: string, value: unknown): boolean {
  if (value === null || value === "null") return true;
  if (typeof value === "object" || Array.isArray(value)) return true;
  if (key === "is_gated_estate") return false;
  if (value === false || value === 0) return false;
  if (value === undefined || value === "") return true;
  if (!value) return true;
  return false;
}

/** --- BNPL counter offer: same math as customer “Review Your Loan Plan” (bundle % + admin fees + interest) --- */
function bnplParseAmountCounter(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Same “bundle” as LoanCalculator.jsx `totalAmount`: cart grand total (principal + equity), not net of admin fees.
 * Prefer principal + baseDepositAmount from the stored snapshot (authoritative); else totalAmount − admin fees.
 */
function bnplBundlePriceFromSnapshotForCounter(snap: Record<string, unknown> | null | undefined): number {
  if (!snap || typeof snap !== "object") return 0;
  const principal = bnplParseAmountCounter(snap.principal ?? snap.totalLoanAmount);
  const baseDep = bnplParseAmountCounter(snap.baseDepositAmount);
  if (principal > 0 && baseDep >= 0) {
    return Math.max(principal + baseDep, 0);
  }
  const totalAmount = bnplParseAmountCounter(snap.totalAmount);
  let adminFees = bnplParseAmountCounter(snap.adminFeesTotal);
  if (adminFees <= 0) {
    adminFees =
      bnplParseAmountCounter(snap.insuranceFee) +
      bnplParseAmountCounter(snap.managementFee) +
      bnplParseAmountCounter(snap.legalFee);
  }
  if (totalAmount > 0) return Math.max(totalAmount - adminFees, 0);
  return 0;
}

function bnplFeePctsForCounter(snap: Record<string, unknown> | null | undefined): {
  insurance: number;
  management: number;
  legal: number;
} {
  const fp = snap?.feePercentages as Record<string, unknown> | undefined;
  if (fp && typeof fp === "object") {
    return {
      insurance: bnplParseAmountCounter(fp.insurance) || 3,
      management: bnplParseAmountCounter(fp.management) || 1,
      legal: bnplParseAmountCounter(fp.legal) || 1,
    };
  }
  return {
    insurance: bnplParseAmountCounter(snap?.insurancePct ?? snap?.insurance_fee_percentage) || 3,
    management: bnplParseAmountCounter(snap?.managementPct ?? snap?.management_fee_percentage) || 1,
    legal: bnplParseAmountCounter(snap?.legalPct ?? snap?.legal_fee_percentage) || 1,
  };
}

function bnplInterestMonthlyForCounter(snap: Record<string, unknown> | null | undefined, fallback: number): number {
  if (!snap) return fallback;
  const a = snap.interestRate ?? snap.interest_rate;
  if (a != null && a !== "" && Number.isFinite(Number(a))) return Number(a);
  return fallback;
}

type BnplCounterPlan = {
  bundlePrice: number;
  depositPercent: number;
  baseDeposit: number;
  baseLoanAmount: number;
  insuranceFee: number;
  managementFee: number;
  legalFee: number;
  adminFeesTotal: number;
  upfrontDepositTotal: number;
  totalLoanAmount: number;
  totalInterestAmount: number;
  totalRepaymentAmount: number;
  monthlyRepaymentAmount: number;
};

function bnplComputeCounterOfferPlan(
  bundlePrice: number,
  depositPercentOfBundle: number,
  tenorMonths: number,
  interestMonthlyPercent: number,
  feePcts: { insurance: number; management: number; legal: number }
): BnplCounterPlan | null {
  if (bundlePrice <= 0 || tenorMonths <= 0) return null;
  const i = feePcts.insurance / 100;
  const m = feePcts.management / 100;
  const l = feePcts.legal / 100;
  // LoanCalculator.jsx: depositAmount = (totalAmount * depositPercent) / 100; principal = totalAmount - depositAmount
  const baseDeposit = (bundlePrice * depositPercentOfBundle) / 100;
  const baseLoanAmount = Math.max(bundlePrice - baseDeposit, 0);
  const insuranceFee = Math.round(bundlePrice * i * 100) / 100;
  const managementFee = Math.round(baseLoanAmount * m * 100) / 100;
  const legalFee = Math.round(baseLoanAmount * l * 100) / 100;
  const adminFeesTotal = Math.round((insuranceFee + managementFee + legalFee) * 100) / 100;
  const upfrontDepositTotal = Math.round((baseDeposit + adminFeesTotal) * 100) / 100;
  const totalLoanAmount = baseLoanAmount;
  const totalInterestAmount =
    Math.round(totalLoanAmount * (interestMonthlyPercent / 100) * tenorMonths * 100) / 100;
  const totalRepaymentAmount = Math.round((totalLoanAmount + totalInterestAmount) * 100) / 100;
  const monthlyRepaymentAmount =
    tenorMonths > 0 ? Math.round((totalRepaymentAmount / tenorMonths) * 100) / 100 : 0;
  return {
    bundlePrice,
    depositPercent: depositPercentOfBundle,
    baseDeposit,
    baseLoanAmount,
    insuranceFee,
    managementFee,
    legalFee,
    adminFeesTotal,
    upfrontDepositTotal,
    totalLoanAmount,
    totalInterestAmount,
    totalRepaymentAmount,
    monthlyRepaymentAmount,
  };
}

function bnplPlanFromSnapshotForCounter(
  snap: Record<string, unknown> | null | undefined
): BnplCounterPlan | null {
  if (!snap || typeof snap !== "object") return null;
  const bundle = bnplBundlePriceFromSnapshotForCounter(snap);
  const depositPercent = bnplParseAmountCounter(snap.depositPercent);
  const baseDeposit = bnplParseAmountCounter(snap.baseDepositAmount);
  const totalLoanAmount = bnplParseAmountCounter(snap.totalLoanAmount ?? snap.principal);
  const insuranceFee = bnplParseAmountCounter(snap.insuranceFee);
  const managementFee = bnplParseAmountCounter(snap.managementFee);
  const legalFee = bnplParseAmountCounter(snap.legalFee);
  const adminFeesTotal = bnplParseAmountCounter(snap.adminFeesTotal);
  const upfrontDepositTotal = bnplParseAmountCounter(snap.depositAmount);
  const totalInterestAmount = bnplParseAmountCounter(snap.totalInterestAmount ?? snap.totalInterest);
  const totalRepaymentAmount = bnplParseAmountCounter(snap.totalRepaymentAmount ?? snap.totalRepayment);
  const monthlyRepaymentAmount = bnplParseAmountCounter(snap.monthlyRepaymentAmount ?? snap.monthlyRepayment);
  if (
    bundle <= 0 ||
    totalLoanAmount <= 0 ||
    totalRepaymentAmount <= 0 ||
    monthlyRepaymentAmount <= 0 ||
    upfrontDepositTotal <= 0
  ) {
    return null;
  }
  return {
    bundlePrice: bundle,
    depositPercent,
    baseDeposit,
    baseLoanAmount: totalLoanAmount,
    insuranceFee,
    managementFee,
    legalFee,
    adminFeesTotal,
    upfrontDepositTotal,
    totalLoanAmount,
    totalInterestAmount,
    totalRepaymentAmount,
    monthlyRepaymentAmount,
  };
}

function bnplDepositPercentFromUpfrontTotal(
  bundlePrice: number,
  upfrontTotal: number,
  feePcts: { insurance: number; management: number; legal: number }
): number {
  if (bundlePrice <= 0 || upfrontTotal <= 0) return 0;
  const i = feePcts.insurance / 100;
  const m = feePcts.management / 100;
  const l = feePcts.legal / 100;
  const denom = 1 - m - l;
  if (denom <= 0.0001) return 0;
  const baseDeposit = (upfrontTotal - bundlePrice * (i + m + l)) / denom;
  if (baseDeposit <= 0) return 0;
  return Math.min(100, (baseDeposit / bundlePrice) * 100);
}

/** Bundle/product lines from API ordered_items or product_category fallback. */
function bnplApplicationOrderSummary(app: Record<string, unknown> | null | undefined): string | null {
  if (!app) return null;
  const oi = app.ordered_items as
    | { display?: string; lines?: Array<{ title?: string; quantity?: number }> }
    | undefined;
  if (oi?.display && String(oi.display).trim() !== "") return String(oi.display).trim();
  if (Array.isArray(oi?.lines) && oi.lines.length > 0) {
    return oi.lines
      .map((l) => {
        const t = l.title || "Item";
        const q = l.quantity && l.quantity > 1 ? ` (×${l.quantity})` : "";
        return `${t}${q}`;
      })
      .join(", ");
  }
  const cat = app.product_category;
  if (cat != null && String(cat).trim() !== "") {
    return `Category only: ${String(cat).replace(/-/g, " ")}`;
  }
  return null;
}

const GENERIC_INVOICE_BUCKET_LABELS = new Set([
  "solar inverter",
  "solar panels",
  "battery",
  "batteries",
]);

function isGenericInvoiceBreakdownRows(
  rows: Array<{ description?: string }> | null | undefined
): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.every((row) => {
    const desc = String(row.description || "").trim().toLowerCase();
    return (
      GENERIC_INVOICE_BUCKET_LABELS.has(desc) ||
      [...GENERIC_INVOICE_BUCKET_LABELS].some((label) => desc.startsWith(`${label} `))
    );
  });
}

/** Detect legacy 40/35/25 fake bucket split from backend when bundle has no catalog lines. */
function isFakePercentBundleBreakdown(
  inv: { price?: number | string; description?: string } | null | undefined,
  pan: { price?: number | string; description?: string } | null | undefined,
  bat: { price?: number | string; description?: string } | null | undefined
): boolean {
  const pInv = Number(inv?.price ?? 0);
  const pPan = Number(pan?.price ?? 0);
  const pBat = Number(bat?.price ?? 0);
  if (pInv <= 0 || pPan <= 0 || pBat <= 0) return false;
  const total = pInv + pPan + pBat;
  if (total <= 0) return false;
  const rInv = pInv / total;
  const rPan = pPan / total;
  const rBat = pBat / total;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  const genericDesc = isGenericInvoiceBreakdownRows([
    { description: inv?.description },
    { description: pan?.description },
    { description: bat?.description },
  ]);
  return genericDesc && near(rInv, 0.4) && near(rPan, 0.35) && near(rBat, 0.25);
}

const getApiData = (response: any) => response?.data ?? response ?? null;

const BNPL_TAB_FROM_PARAM: Record<string, string> = {
  applications: "BNPL Applications",
  guarantors: "BNPL Guarantors",
  "guarantor-form": "Guarantor Form",
  settings: "Loan Settings",
  mono: "Mono Loans",
  banner: "Banner",
  "buy-now": "Buy Now Orders",
  orders: "BNPL Orders",
  audit: "Audit Requests",
  custom: "Custom Orders",
};

const BNPLBuyNow: React.FC = () => {
  const [activeTab, setActiveTab] = useState("BNPL Applications");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customOrdersUserFilter, setCustomOrdersUserFilter] = useState("All");
  const [auditTypeFilter, setAuditTypeFilter] = useState("All Types"); // For Audit Requests
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [detailModalTab, setDetailModalTab] = useState("Details");
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [orderInvoice, setOrderInvoice] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoiceNotFound, setInvoiceNotFound] = useState(false);
  const [auditPaymentReceiptFile, setAuditPaymentReceiptFile] = useState<File | null>(null);
  const [statusForm, setStatusForm] = useState({
    status: "",
    admin_notes: "",
    approval_payment_date: "",
    approval_payment_time: "",
    approval_payment_amount: "",
    approval_payment_account_details: "",
    customer_has_paid: false,
    customer_payment_date: "",
    customer_payment_time: "",
    counter_offer_min_deposit: "",
    counter_offer_min_tenor: "",
    property_state: "",
    property_address: "",
    contact_name: "",
    contact_phone: "",
  });

  const emptyStatusForm = () => ({
    status: "",
    admin_notes: "",
    approval_payment_date: "",
    approval_payment_time: "",
    approval_payment_amount: "",
    approval_payment_account_details: "",
    customer_has_paid: false,
    customer_payment_date: "",
    customer_payment_time: "",
    counter_offer_min_deposit: "",
    counter_offer_min_tenor: "",
    property_state: "",
    property_address: "",
    contact_name: "",
    contact_phone: "",
  });
  // BNPL Assign beneficiary & adjust offer (like loan flow)
  const [beneficiaryForm, setBeneficiaryForm] = useState({
    beneficiary_email: "",
    beneficiary_name: "",
    beneficiary_phone: "",
    beneficiary_relationship: "",
  });
  const [offerForm, setOfferForm] = useState({
    loan_amount: "",
    down_payment: "",
    repayment_duration: "",
    interest_rate: "",
    management_fee_percentage: "",
    legal_fee_percentage: "",
    insurance_fee_percentage: "",
  });
  const [savingBeneficiary, setSavingBeneficiary] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [guarantorForm, setGuarantorForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    relationship: "",
  });
  const [savingGuarantor, setSavingGuarantor] = useState(false);
  const [savingInstallationAccept, setSavingInstallationAccept] = useState(false);
  const [savingInstallationReject, setSavingInstallationReject] = useState(false);
  // Send to Partner (like loan flow - before approving)
  const [showSendToPartnerModal, setShowSendToPartnerModal] = useState(false);
  const [selectedPartnerIdForSend, setSelectedPartnerIdForSend] = useState<number | "">("");
  const [sendingToPartner, setSendingToPartner] = useState(false);
  
  // Custom Orders state
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showUserCartModal, setShowUserCartModal] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailResendOrderType, setDetailResendOrderType] = useState<"buy_now" | "bnpl">("buy_now");
  const [createOrderForm, setCreateOrderForm] = useState({
    user_id: "",
    order_type: "buy_now" as "buy_now" | "bnpl",
    items: [] as Array<{ type: "product" | "bundle"; id: number; quantity: number }>,
    send_email: true,
    email_message: "",
  });
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [productTypeFilter, setProductTypeFilter] = useState<"all" | "products" | "bundles">("all");
  const [createOrderCatalogSearch, setCreateOrderCatalogSearch] = useState("");
  const [customProducts, setCustomProducts] = useState<Array<{
    name: string;
    description: string;
    price: number;
    quantity: number;
  }>>([]);
  const [showAddCustomProduct, setShowAddCustomProduct] = useState(false);
  const [newCustomProduct, setNewCustomProduct] = useState({
    name: "",
    description: "",
    price: "",
    quantity: "1",
  });

  // Guarantor Form (admin upload)
  const [guarantorFormFile, setGuarantorFormFile] = useState<File | null>(null);
  const [uploadingGuarantorForm, setUploadingGuarantorForm] = useState(false);

  // Home Banner (dashboard promo)
  const [bannerFileHome, setBannerFileHome] = useState<File | null>(null);
  const [bannerFileSidebar, setBannerFileSidebar] = useState<File | null>(null);
  const [uploadingHomeBanner, setUploadingHomeBanner] = useState(false);
  const [uploadingSidebarBanner, setUploadingSidebarBanner] = useState(false);
  const [removingHomeBanner, setRemovingHomeBanner] = useState(false);
  const [removingSidebarBanner, setRemovingSidebarBanner] = useState(false);

  // Loan Settings (global BNPL config)
  const [loanSettingsForm, setLoanSettingsForm] = useState({
    interest_rate_percentage: "",
    min_down_percentage: "",
    down_payment_options: [] as number[],
    management_fee_percentage: "",
    legal_fee_percentage: "",
    insurance_fee_percentage: "",
    minimum_loan_amount: "",
    loan_durations: [] as number[],
    newDownPaymentOption: "",
    newDuration: "",
  });
  const [savingLoanSettings, setSavingLoanSettings] = useState(false);
  const [filterUserId, setFilterUserId] = useState<number | null>(null);
  const urlParamsHandled = useRef(false);

  const token = Cookies.get("token") || "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Build query params
  const buildQueryParams = () => {
    const params: any = {
      per_page: itemsPerPage,
      page: currentPage,
    };
    if (statusFilter !== "All") {
      params.status = statusFilter.toLowerCase();
    }
    if (activeTab === "Audit Requests" && auditTypeFilter !== "All Types") {
      params.audit_type = auditTypeFilter.toLowerCase();
    }
    if (searchQuery) {
      params.search = searchQuery;
    }
    if (filterUserId != null) {
      params.user_id = filterUserId;
    }
    return params;
  };

  // BNPL Applications Query
  const {
    data: bnplApplicationsData,
    isLoading: bnplApplicationsLoading,
  } = useQuery({
    queryKey: ["bnpl-applications", statusFilter, searchQuery, currentPage, filterUserId],
    queryFn: () => getBNPLApplications(token, buildQueryParams()),
    enabled: activeTab === "BNPL Applications" && !!token,
  });

  const detailUserId =
    activeTab === "BNPL Applications" && selectedItem
      ? (selectedItem.user?.id ?? selectedItem.user_id ?? null)
      : null;

  const { data: siblingApplicationsData } = useQuery({
    queryKey: ["bnpl-applications-for-user", detailUserId],
    queryFn: () =>
      getBNPLApplications(token, {
        user_id: detailUserId as number,
        per_page: 20,
        page: 1,
      }),
    enabled: !!token && !!detailUserId && showDetailModal && activeTab === "BNPL Applications",
  });

  const siblingApplications: any[] = siblingApplicationsData?.data?.data ?? [];

  // BNPL Guarantors Query
  const {
    data: bnplGuarantorsData,
    isLoading: bnplGuarantorsLoading,
  } = useQuery({
    queryKey: ["bnpl-guarantors", statusFilter, currentPage],
    queryFn: () => getBNPLGuarantors(token, buildQueryParams()),
    enabled: activeTab === "BNPL Guarantors" && !!token,
  });

  // Buy Now Orders Query
  const {
    data: buyNowOrdersData,
    isLoading: buyNowOrdersLoading,
  } = useQuery({
    queryKey: ["buy-now-orders", statusFilter, searchQuery, currentPage],
    queryFn: () => getBuyNowOrders(token, buildQueryParams()),
    enabled: activeTab === "Buy Now Orders" && !!token,
  });

  // BNPL Orders Query
  const {
    data: bnplOrdersData,
    isLoading: bnplOrdersLoading,
  } = useQuery({
    queryKey: ["bnpl-orders", statusFilter, searchQuery, currentPage, filterUserId],
    queryFn: () => getBNPLOrders(token, buildQueryParams()),
    enabled: activeTab === "BNPL Orders" && !!token,
  });

  // Audit Requests Query
  const {
    data: auditRequestsData,
    isLoading: auditRequestsLoading,
  } = useQuery({
    queryKey: ["audit-requests", statusFilter, auditTypeFilter, searchQuery, currentPage],
    queryFn: () => getAuditRequests(token, buildQueryParams()),
    enabled: activeTab === "Audit Requests" && !!token,
  });

  // Users with Audit Requests Query (for Custom Orders)
  const {
    data: auditUsersData,
    isLoading: auditUsersLoading,
  } = useQuery({
    queryKey: ["audit-users-with-requests", searchQuery, auditTypeFilter, customOrdersUserFilter, currentPage],
    queryFn: () => getUsersWithAuditRequests(token, {
      search: searchQuery || undefined,
      audit_type: auditTypeFilter !== "All Types" ? auditTypeFilter.toLowerCase().replace(" ", "-") : undefined,
      has_pending: customOrdersUserFilter === "Has Pending" ? true : undefined,
      sort_by: "last_audit_request_date",
      sort_order: "desc",
      per_page: itemsPerPage,
      page: currentPage,
    }),
    enabled: activeTab === "Custom Orders" && !!token,
  });

  // Financing partners (for Send to Partner in BNPL)
  const { data: financePartnersData, isLoading: financePartnersLoading } = useQuery({
    queryKey: ["all-finance-partners"],
    queryFn: () => getAllFinance(token),
    enabled: (showSendToPartnerModal && !!token) || !!token,
  });
  const financePartnersList = Array.isArray(financePartnersData?.data) ? financePartnersData.data : [];

  // BNPL global settings (for Loan Settings tab and for detail modal duration dropdown)
  const { data: bnplSettingsData, isLoading: bnplSettingsLoading } = useQuery({
    queryKey: ["bnpl-settings"],
    queryFn: () => getBNPLSettings(token),
    enabled: (activeTab === "Loan Settings" || !!showDetailModal) && !!token,
  });
  const bnplSettings = bnplSettingsData?.data?.data ?? bnplSettingsData?.data ?? null;
  const allowedDurations: number[] = Array.isArray(bnplSettings?.loan_durations) ? bnplSettings.loan_durations : [3, 6, 9, 12];

  useEffect(() => {
    if (activeTab === "Loan Settings" && bnplSettings) {
      setLoanSettingsForm((f) => ({
        ...f,
        interest_rate_percentage: String(bnplSettings.interest_rate_percentage ?? ""),
        min_down_percentage: String(bnplSettings.min_down_percentage ?? ""),
        down_payment_options: Array.isArray(bnplSettings.down_payment_options) && bnplSettings.down_payment_options.length
          ? [...bnplSettings.down_payment_options].map((v: number | string) => Number(v)).filter((v: number) => !Number.isNaN(v))
          : (bnplSettings.min_down_percentage != null ? [Number(bnplSettings.min_down_percentage)] : []),
        management_fee_percentage: String(bnplSettings.management_fee_percentage ?? ""),
        legal_fee_percentage: String(bnplSettings.legal_fee_percentage ?? ""),
        insurance_fee_percentage: String(bnplSettings.insurance_fee_percentage ?? ""),
        minimum_loan_amount: String(bnplSettings.minimum_loan_amount ?? ""),
        loan_durations: Array.isArray(bnplSettings.loan_durations) ? [...bnplSettings.loan_durations] : [],
      }));
    }
  }, [activeTab, bnplSettings]);

  // Site banner (home promo) - for Banner tab
  const { data: siteBannerData, isLoading: siteBannerLoading, refetch: refetchSiteBanners } = useQuery({
    queryKey: ["site-banners"],
    queryFn: () => getSiteBanner(token!),
    enabled: activeTab === "Banner" && !!token,
  });
  const bannerPayload = siteBannerData?.data;
  const homeSlot = bannerPayload?.home ?? {
    url: bannerPayload?.url,
    path: bannerPayload?.path,
  };
  const sidebarSlot = bannerPayload?.sidebar ?? {};
  const homeBannerPreview = siteBannerSlotPreview(homeSlot);
  const sidebarBannerPreview = siteBannerSlotPreview(sidebarSlot);

  // Cart Products Query
  const {
    data: cartProductsData,
    isLoading: cartProductsLoading,
  } = useQuery({
    queryKey: ["cart-products", productTypeFilter],
    queryFn: () => getCartProducts(token, { type: productTypeFilter }),
    enabled: (activeTab === "Custom Orders" && showCreateOrderModal) && !!token,
  });

  const {
    data: allUsersData,
    isLoading: allUsersLoading,
  } = useQuery({
    queryKey: ["all-users", "custom-order-picker"],
    queryFn: () => getAllUsers(token || ""),
    enabled: showCreateOrderModal && !!token,
  });

  const customOrderUsers = React.useMemo(() => {
    const rows = allUsersData?.data?.["all users data"];
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.map((u: {
      id: number;
      first_name?: string;
      sur_name?: string;
      email?: string;
      phone?: string;
      bvn?: string;
    }) => ({
      id: u.id,
      name: `${u.first_name ?? ""} ${u.sur_name ?? ""}`.trim() || `User ${u.id}`,
      email: u.email ?? "",
      phone: u.phone ?? "",
      bvn: u.bvn ?? "",
    }));
  }, [allUsersData]);

  // User Cart Query
  const {
    data: userCartResponse,
    isLoading: userCartLoading,
    refetch: refetchUserCart,
  } = useQuery({
    queryKey: ["user-cart", selectedUserId],
    queryFn: () => getUserCart(selectedUserId!, token),
    enabled: activeTab === "Custom Orders" && !!selectedUserId && !!token,
  });


  // Status Update Mutations
  const updateApplicationStatusMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await updateBNPLApplicationStatus(selectedItem.id, payload, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bnpl-applications"] });
      setShowStatusModal(false);
      setSelectedItem(null);
      setStatusForm(emptyStatusForm());
      alert("Status updated successfully.");
    },
    onError: (error: any) => {
      const msg = error?.message || error?.response?.data?.message || "Failed to update status.";
      const errors = error?.response?.data?.errors || error?.data?.errors;
      const detail = errors && typeof errors === "object" ? Object.values(errors).flat().join(" ") : "";
      alert(detail ? `${msg}\n${detail}` : msg);
    },
  });

  const updateGuarantorStatusMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await updateBNPLGuarantorStatus(selectedItem.id, payload, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bnpl-guarantors"] });
      setShowStatusModal(false);
      setSelectedItem(null);
      setStatusForm(emptyStatusForm());
    },
  });

  const updateBuyNowOrderStatusMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await updateBuyNowOrderStatus(selectedItem.id, payload, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buy-now-orders"] });
      setShowStatusModal(false);
      setSelectedItem(null);
      setStatusForm(emptyStatusForm());
    },
  });

  // Custom Orders Mutations
  const createCustomOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await createCustomOrder(payload, token);
    },
    onSuccess: (response: any) => {
      const result = getApiData(response) ?? {};
      const emailSent = result.email_sent === true;
      const cartLink = result.cart_link || "";
      const userEmail = result.user_email || "";
      const emailError = result.email_error || "";

      queryClient.invalidateQueries({ queryKey: ["user-cart"] });
      setShowCreateOrderModal(false);
      setCreateOrderForm({
        user_id: "",
        order_type: "buy_now",
        items: [],
        send_email: true,
        email_message: "",
      });
      setSelectedProducts([]);
      setCustomProducts([]);
      setShowAddCustomProduct(false);
      setCreateOrderCatalogSearch("");
      setNewCustomProduct({
        name: "",
        description: "",
        price: "",
        quantity: "1",
      });

      queryClient.invalidateQueries({ queryKey: ["audit-users-with-requests"] });

      if (result.email_sent === false) {
        alert(
          `Custom order was saved to the user's cart, but the email could not be sent${emailError ? `:\n${emailError}` : ""}.\n\nUse "Resend Cart Link" in View Details, or share this link manually:\n${cartLink}`
        );
      } else if (emailSent && userEmail) {
        alert(`Custom order created successfully. Email sent to ${userEmail}.`);
      } else {
        alert("Custom order created successfully!");
      }
    },
    onError: (error: any) => {
      alert(error?.message || "Failed to create custom order");
    },
  });

  const removeCartItemMutation = useMutation({
    mutationFn: async ({ userId, itemId }: { userId: number; itemId: number }) => {
      return await removeCartItem(userId, itemId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cart"] });
      refetchUserCart();
      // Invalidate audit users query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["audit-users-with-requests"] });
      alert("Item removed from cart successfully");
    },
  });

  const clearUserCartMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await clearUserCart(userId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cart"] });
      refetchUserCart();
      // Invalidate audit users query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["audit-users-with-requests"] });
      alert("Cart cleared successfully");
    },
  });

  const resendCartEmailMutation = useMutation({
    mutationFn: async ({ userId, payload }: { userId: number; payload: any }) => {
      return await resendCartEmail(userId, payload, token);
    },
    onSuccess: (response: any) => {
      const result = getApiData(response) ?? {};
      if (result.email_sent === false) {
        alert(
          `Failed to resend email${result.email_error ? `: ${result.email_error}` : ""}${
            result.cart_link ? `\n\nShare this link manually:\n${result.cart_link}` : ""
          }`
        );
        return;
      }
      alert(
        `Cart link email sent to ${result.email || "the user"}.${
          result.cart_link ? `\n\nLink:\n${result.cart_link}` : ""
        }`
      );
    },
    onError: (error: any) => {
      alert(error?.message || "Failed to resend cart link email");
    },
  });

  // Audit Request Status Update Mutation
  const updateAuditRequestStatusMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      status: string;
      admin_notes?: string;
      approval_payment_date?: string;
      approval_payment_time?: string;
      approval_payment_amount?: number;
      approval_payment_account_details?: string;
      customer_has_paid?: boolean;
      customer_payment_date?: string;
      customer_payment_time?: string;
      property_state?: string;
      property_address?: string;
      contact_name?: string;
      contact_phone?: string;
      payment_receipt?: File | null;
      force_payment_confirmation_email?: boolean;
    }) => {
      let uploadEmailSent = false;
      let uploadEmailError: string | null = null;

      // Upload receipt first so the confirmation email can send with receipt on file.
      if (payload.payment_receipt && payload.customer_has_paid) {
        const uploadResult = await uploadAuditPaymentReceipt(
          payload.id,
          payload.payment_receipt,
          token
        );
        uploadEmailSent = !!uploadResult?.data?.payment_confirmation_email_sent;
        uploadEmailError = uploadResult?.data?.payment_confirmation_email_error || null;
        if (uploadResult?.status === "error") {
          throw new Error(uploadResult?.message || "Failed to upload payment receipt");
        }
      }

      const statusResult = await updateAuditRequestStatus(payload.id, {
        status: payload.status as "approved" | "rejected" | "completed",
        admin_notes: payload.admin_notes,
        approval_payment_date: payload.approval_payment_date,
        approval_payment_time: payload.approval_payment_time,
        approval_payment_amount: payload.approval_payment_amount,
        approval_payment_account_details: payload.approval_payment_account_details,
        customer_has_paid: payload.customer_has_paid,
        customer_payment_date: payload.customer_payment_date,
        customer_payment_time: payload.customer_payment_time,
        force_payment_confirmation_email: payload.force_payment_confirmation_email,
        property_state: payload.property_state,
        property_address: payload.property_address,
        contact_name: payload.contact_name,
        contact_phone: payload.contact_phone,
      }, token);

      return {
        statusResult,
        uploadEmailSent,
        uploadEmailError,
      };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["audit-requests"] });
      setShowStatusModal(false);
      setStatusForm(emptyStatusForm());
      setAuditPaymentReceiptFile(null);

      const statusData = result?.statusResult?.data ?? result?.statusResult ?? {};
      const emailSent =
        !!result?.uploadEmailSent || !!statusData?.payment_confirmation_email_sent;
      const emailError =
        result?.uploadEmailError || statusData?.payment_confirmation_email_error || null;

      if (emailSent) {
        alert("Audit request updated. Payment confirmation email sent to the customer.");
      } else if (emailError) {
        alert(
          `Audit request updated, but payment confirmation email failed:\n${emailError}\n\nCheck server mail logs / MAIL_* settings.`
        );
      } else {
        alert("Audit request status updated successfully!");
      }
    },
    onError: (error: any) => {
      alert(error?.message || "Failed to update audit request status");
    },
  });

  const openApplicationDetail = useCallback(
    async (applicationId: number) => {
      if (!token) return;
      setActiveTab("BNPL Applications");
      setDetailModalTab("Details");
      setOrderSummary(null);
      setOrderInvoice(null);
      setInvoiceNotFound(false);
      try {
        const detailData = await getBNPLApplication(applicationId, token);
        const d = detailData.data;
        setSelectedItem(d);
        if (d) {
          setBeneficiaryForm({
            beneficiary_email: d.beneficiary_email || "",
            beneficiary_name: d.beneficiary_name || "",
            beneficiary_phone: d.beneficiary_phone || "",
            beneficiary_relationship: d.beneficiary_relationship || "",
          });
          const mono = d.mono;
          setOfferForm({
            loan_amount: mono?.loan_amount ?? d.loan_amount ?? "",
            down_payment: mono?.down_payment ?? "",
            repayment_duration: mono?.repayment_duration ?? d.repayment_duration ?? "",
            interest_rate: mono?.interest_rate ?? "",
            management_fee_percentage: mono?.management_fee_percentage ?? "",
            legal_fee_percentage: mono?.legal_fee_percentage ?? "",
            insurance_fee_percentage: mono?.insurance_fee_percentage ?? "",
          });
          setGuarantorForm({
            full_name: d.guarantor?.full_name || "",
            phone: d.guarantor?.phone || "",
            email: d.guarantor?.email || "",
            relationship: d.guarantor?.relationship || "",
          });
        }
        setShowDetailModal(true);
      } catch (error) {
        console.error("Failed to open application:", error);
        alert("Failed to load BNPL application.");
      }
    },
    [token]
  );

  const openOrderDetail = useCallback(
    async (orderId: number) => {
      if (!token) return;
      setActiveTab("BNPL Orders");
      setDetailModalTab("Details");
      setOrderSummary(null);
      setOrderInvoice(null);
      setInvoiceNotFound(false);
      try {
        const detailData = await getBNPLOrder(orderId, token);
        setSelectedItem(detailData.data);
        if (detailData.data?.id) {
          try {
            setLoadingSummary(true);
            const summary = await getOrderSummary(detailData.data.id, token);
            setOrderSummary(summary.data);
          } catch (err) {
            console.error("Failed to fetch order summary:", err);
          } finally {
            setLoadingSummary(false);
          }
        }
        setShowDetailModal(true);
      } catch (error) {
        console.error("Failed to open order:", error);
        alert("Failed to load BNPL order.");
      }
    },
    [token]
  );

  useEffect(() => {
    if (urlParamsHandled.current || !token) return;

    const tabParam = searchParams.get("tab");
    const applicationId = searchParams.get("applicationId");
    const orderId = searchParams.get("orderId");
    const userIdParam = searchParams.get("userId");

    if (tabParam && BNPL_TAB_FROM_PARAM[tabParam]) {
      setActiveTab(BNPL_TAB_FROM_PARAM[tabParam]);
    }

    if (userIdParam) {
      const uid = parseInt(userIdParam, 10);
      if (!Number.isNaN(uid)) {
        setFilterUserId(uid);
      }
    }

    const run = async () => {
      if (applicationId) {
        const appId = parseInt(applicationId, 10);
        if (!Number.isNaN(appId)) {
          await openApplicationDetail(appId);
        }
      } else if (orderId) {
        const oid = parseInt(orderId, 10);
        if (!Number.isNaN(oid)) {
          await openOrderDetail(oid);
        }
      }
      urlParamsHandled.current = true;
      navigate("/bnpl-buynow", { replace: true });
    };

    if (applicationId || orderId || tabParam || userIdParam) {
      run();
    } else {
      urlParamsHandled.current = true;
    }
  }, [token, searchParams, navigate, openApplicationDetail, openOrderDetail]);

  const handleViewDetails = async (item: any) => {
    setSelectedItem(item);
    setDetailModalTab("Details");
    setOrderSummary(null);
    setOrderInvoice(null);
    setInvoiceNotFound(false);
    try {
      let detailData;
      if (activeTab === "BNPL Applications") {
        detailData = await getBNPLApplication(item.id, token);
      } else if (activeTab === "Buy Now Orders") {
        detailData = await getBuyNowOrder(item.id, token);
        // Fetch order summary and invoice for orders
        if (detailData.data?.id) {
          try {
            setLoadingSummary(true);
            const summary = await getOrderSummary(detailData.data.id, token);
            setOrderSummary(summary.data);
          } catch (err) {
            console.error("Failed to fetch order summary:", err);
          } finally {
            setLoadingSummary(false);
          }
        }
      } else if (activeTab === "BNPL Orders") {
        detailData = await getBNPLOrder(item.id, token);
        // Fetch order summary and invoice for orders
        if (detailData.data?.id) {
          try {
            setLoadingSummary(true);
            const summary = await getOrderSummary(detailData.data.id, token);
            setOrderSummary(summary.data);
          } catch (err) {
            console.error("Failed to fetch order summary:", err);
          } finally {
            setLoadingSummary(false);
          }
        }
      } else if (activeTab === "Audit Requests") {
        detailData = await getAuditRequest(item.id, token);
      } else {
        detailData = { data: item };
      }
      setSelectedItem(detailData.data);
      if (activeTab === "BNPL Applications" && detailData.data) {
        const d = detailData.data;
        setBeneficiaryForm({
          beneficiary_email: d.beneficiary_email || "",
          beneficiary_name: d.beneficiary_name || "",
          beneficiary_phone: d.beneficiary_phone || "",
          beneficiary_relationship: d.beneficiary_relationship || "",
        });
        const mono = d.mono;
        setOfferForm({
          loan_amount: mono?.loan_amount ?? d.loan_amount ?? "",
          down_payment: mono?.down_payment ?? "",
          repayment_duration: mono?.repayment_duration ?? d.repayment_duration ?? "",
          interest_rate: mono?.interest_rate ?? "",
          management_fee_percentage: mono?.management_fee_percentage ?? "",
          legal_fee_percentage: mono?.legal_fee_percentage ?? "",
          insurance_fee_percentage: mono?.insurance_fee_percentage ?? "",
        });
        setGuarantorForm({
          full_name: d.guarantor?.full_name || "",
          phone: d.guarantor?.phone || "",
          email: d.guarantor?.email || "",
          relationship: d.guarantor?.relationship || "",
        });
      }
      setShowDetailModal(true);
    } catch (error) {
      console.error("Failed to fetch details:", error);
      alert("Failed to load details. Please try again.");
    }
  };

  const handleLoadInvoice = async () => {
    if (!selectedItem?.id || loadingInvoice) return;
    try {
      setLoadingInvoice(true);
      setInvoiceNotFound(false);
      const invoice = await getOrderInvoiceDetails(selectedItem.id, token);
      setOrderInvoice(invoice.data);
    } catch (error: any) {
      console.error("Failed to fetch invoice:", error);
      // Check if it's a 404 error
      if (error?.response?.status === 404 || error?.status === 404) {
        setInvoiceNotFound(true);
        setOrderInvoice(null);
      } else {
        // Only show alert for non-404 errors
        alert("Failed to load invoice details.");
      }
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleUpdateStatus = (item: any) => {
    setSelectedItem(item);
    const snap =
      item?.loan_plan_snapshot && typeof item.loan_plan_snapshot === "object"
        ? (item.loan_plan_snapshot as Record<string, unknown>)
        : null;
    const bundle = bnplBundlePriceFromSnapshotForCounter(snap ?? undefined);
    const feePcts = bnplFeePctsForCounter(snap ?? undefined);
    const existingUpfront = Number(item?.counter_offer_min_deposit ?? 0);
    let depositPercentStr = "";
    if (existingUpfront > 0 && bundle > 0) {
      const pct = bnplDepositPercentFromUpfrontTotal(bundle, existingUpfront, feePcts);
      depositPercentStr = pct > 0 ? String(Math.round(pct * 100) / 100) : "";
    } else if (snap) {
      const upfrontOrig = bnplParseAmountCounter(snap.depositAmount);
      if (upfrontOrig > 0 && bundle > 0) {
        const p = bnplDepositPercentFromUpfrontTotal(bundle, upfrontOrig, feePcts);
        if (p > 0) {
          depositPercentStr = String(Math.round(p * 100) / 100);
        } else {
          const dp = bnplParseAmountCounter(snap.depositPercent);
          if (dp > 0) depositPercentStr = String(Math.round(dp * 100) / 100);
        }
      } else {
        const dp = bnplParseAmountCounter(snap.depositPercent);
        if (dp > 0) depositPercentStr = String(Math.round(dp * 100) / 100);
      }
    }
    setStatusForm({
      status: item.status || item.order_status || "",
      admin_notes: item.admin_notes || "",
      approval_payment_date: item.approval_payment_date || "",
      approval_payment_time: item.approval_payment_time || "",
      approval_payment_amount:
        item.approval_payment_amount != null && item.approval_payment_amount !== ""
          ? String(item.approval_payment_amount)
          : "",
      approval_payment_account_details: item.approval_payment_account_details || "",
      customer_has_paid: !!item.customer_has_paid,
      customer_payment_date: item.customer_payment_date || "",
      customer_payment_time: item.customer_payment_time || "",
      counter_offer_min_deposit: depositPercentStr,
      counter_offer_min_tenor: item?.counter_offer_min_tenor ?? "",
      property_state: item?.property_state || "",
      property_address: item?.property_address || "",
      contact_name: item?.contact_name || "",
      contact_phone: item?.contact_phone || item?.user?.phone || "",
    });
    setShowStatusModal(true);
    setAuditPaymentReceiptFile(null);
  };

  const handleStatusSubmit = () => {
    if (!statusForm.status) {
      alert("Please select a status");
      return;
    }

    // BNPL: When approving, show confirmation that user can then pay down payment and order will be fulfilled
    if (activeTab === "BNPL Applications" && statusForm.status === "approved") {
      const confirmed = window.confirm(
        "You are about to complete this order. Once you approve, the user will be able to pay their down payment and the order will be fulfilled. Continue?"
      );
      if (!confirmed) return;
    }

    const payload: any = {
      status: statusForm.status,
    };

    if (statusForm.admin_notes) {
      payload.admin_notes = statusForm.admin_notes;
    }

    if (statusForm.status === "counter_offer") {
      const percent = statusForm.counter_offer_min_deposit ? Number(statusForm.counter_offer_min_deposit) : 0;
      const tenor = statusForm.counter_offer_min_tenor ? Number(statusForm.counter_offer_min_tenor) : 0;
      if (!percent || percent <= 0 || percent > 100) {
        alert("Please enter a valid Counter Offer Min Deposit percentage (e.g. 30, 40, 50).");
        return;
      }
      if (!tenor || !allowedDurations.includes(tenor)) {
        alert(`Please select a valid Counter Offer Min Tenor (${allowedDurations.join(", ")} months).`);
        return;
      }
      const snap =
        selectedItem?.loan_plan_snapshot && typeof selectedItem.loan_plan_snapshot === "object"
          ? (selectedItem.loan_plan_snapshot as Record<string, unknown>)
          : null;
      const bundle = bnplBundlePriceFromSnapshotForCounter(snap ?? undefined);
      if (bundle <= 0) {
        alert(
          "Cannot set counter offer: bundle price could not be read from the application loan plan snapshot. Open application details to refresh data, or ensure the customer applied via the current BNPL flow."
        );
        return;
      }
      const feePcts = bnplFeePctsForCounter(snap ?? undefined);
      const interestM = bnplInterestMonthlyForCounter(
        snap ?? undefined,
        Number(selectedItem?.mono?.interest_rate) || 4
      );
      const snapPlan = bnplPlanFromSnapshotForCounter(snap ?? undefined);
      const snapPct = bnplParseAmountCounter(snap?.depositPercent);
      const snapTenor = bnplParseAmountCounter(snap?.tenor);
      const shouldUseSnapshotPlan =
        !!snapPlan &&
        Math.abs(percent - snapPct) < 0.01 &&
        Math.abs(tenor - snapTenor) < 0.01;
      const plan = shouldUseSnapshotPlan
        ? snapPlan
        : bnplComputeCounterOfferPlan(bundle, percent, tenor, interestM, feePcts);
      if (!plan) {
        alert("Could not compute counter-offer amounts. Check deposit % and tenor.");
        return;
      }
      payload.counter_offer_min_deposit = plan.upfrontDepositTotal;
      payload.counter_offer_min_tenor = tenor;
    }

    if (activeTab === "BNPL Applications") {
      updateApplicationStatusMutation.mutate(payload);
    } else if (activeTab === "BNPL Guarantors") {
      updateGuarantorStatusMutation.mutate(payload);
    } else if (activeTab === "Buy Now Orders") {
      updateBuyNowOrderStatusMutation.mutate({
        order_status: statusForm.status,
        admin_notes: statusForm.admin_notes,
      });
    } else if (activeTab === "Audit Requests") {
      if (statusForm.status === "approved") {
        if (!statusForm.approval_payment_date?.trim()) {
          alert("Please select the audit date.");
          return;
        }
        if (!statusForm.approval_payment_time?.trim()) {
          alert("Please select the audit time.");
          return;
        }
        const amount = Number(statusForm.approval_payment_amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          alert("Please enter a valid payment amount greater than zero.");
          return;
        }
        if (!statusForm.approval_payment_account_details?.trim()) {
          alert("Please enter payment account details for the customer.");
          return;
        }
      }

      if (statusForm.customer_has_paid) {
        if (!statusForm.customer_payment_date?.trim()) {
          alert("Please select the payment date.");
          return;
        }
        if (!statusForm.customer_payment_time?.trim()) {
          alert("Please select the payment time.");
          return;
        }
        const hasExistingReceipt = !!auditPaymentReceiptUrl(selectedItem);
        if (!auditPaymentReceiptFile && !hasExistingReceipt) {
          alert("Please upload the payment receipt. The customer confirmation email is sent when the receipt is uploaded.");
          return;
        }
      }

      const hasExistingReceipt = !!auditPaymentReceiptUrl(selectedItem);
      const uploadingNewReceipt = !!(statusForm.customer_has_paid && auditPaymentReceiptFile);

      updateAuditRequestStatusMutation.mutate({
        id: selectedItem.id,
        status: statusForm.status,
        admin_notes: statusForm.admin_notes || undefined,
        approval_payment_date:
          statusForm.status === "approved" ? statusForm.approval_payment_date : undefined,
        approval_payment_time:
          statusForm.status === "approved" ? statusForm.approval_payment_time : undefined,
        approval_payment_amount:
          statusForm.status === "approved"
            ? Number(statusForm.approval_payment_amount)
            : undefined,
        approval_payment_account_details:
          statusForm.status === "approved"
            ? statusForm.approval_payment_account_details
            : undefined,
        customer_has_paid: !!statusForm.customer_has_paid,
        customer_payment_date: statusForm.customer_has_paid
          ? statusForm.customer_payment_date
          : undefined,
        customer_payment_time: statusForm.customer_has_paid
          ? statusForm.customer_payment_time
          : undefined,
        // Resend confirmation when using an existing receipt (no new file upload this time).
        force_payment_confirmation_email:
          !!statusForm.customer_has_paid && hasExistingReceipt && !uploadingNewReceipt,
        property_state: statusForm.property_state || undefined,
        property_address: statusForm.property_address || undefined,
        contact_name: statusForm.contact_name || undefined,
        contact_phone: statusForm.contact_phone || undefined,
        payment_receipt: statusForm.customer_has_paid ? auditPaymentReceiptFile : null,
      });
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case "BNPL Applications":
        return bnplApplicationsData?.data;
      case "BNPL Guarantors":
        return bnplGuarantorsData?.data;
      case "Buy Now Orders":
        return buyNowOrdersData?.data;
      case "BNPL Orders":
        return bnplOrdersData?.data;
      case "Audit Requests":
        return auditRequestsData?.data;
      case "Custom Orders":
        return null;
      case "Guarantor Form":
        return null;
      case "Loan Settings":
        return null;
      case "Mono Loans":
        return null;
      case "Banner":
        return null;
      default:
        return null;
    }
  };

  const isLoading = () => {
    switch (activeTab) {
      case "BNPL Applications":
        return bnplApplicationsLoading;
      case "BNPL Guarantors":
        return bnplGuarantorsLoading;
      case "Buy Now Orders":
        return buyNowOrdersLoading;
      case "BNPL Orders":
        return bnplOrdersLoading;
      case "Audit Requests":
        return auditRequestsLoading;
      case "Custom Orders":
        return auditUsersLoading;
      case "Guarantor Form":
        return false;
      case "Loan Settings":
        return bnplSettingsLoading;
      case "Mono Loans":
        return false;
      case "Banner":
        return siteBannerLoading;
      default:
        return false;
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "approved" || statusLower === "delivered" || statusLower === "completed") {
      return { backgroundColor: "#10B981", color: "white" };
    }
    if (statusLower === "pending" || statusLower === "processing") {
      return { backgroundColor: "#F59E0B", color: "white" };
    }
    if (statusLower === "rejected" || statusLower === "cancelled") {
      return { backgroundColor: "#EF4444", color: "white" };
    }
    if (statusLower === "counter_offer" || statusLower === "shipped") {
      return { backgroundColor: "#3B82F6", color: "white" };
    }
    return { backgroundColor: "#6B7280", color: "white" };
  };

  const formatCurrency = (amount: number | string) => {
    return `₦${Number(amount).toLocaleString()}`;
  };

  /** Match dashboard BNPL loan summary (2 decimal places). */
  const formatCurrencyLoanSummary = (amount: number | string | null | undefined) => {
    const n =
      typeof amount === "string"
        ? parseFloat(String(amount).replace(/,/g, ""))
        : Number(amount);
    if (!Number.isFinite(n)) return "₦0.00";
    return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatAuditPreferredTime = (time24: string | null | undefined) => {
    const raw = String(time24 || "").trim();
    if (!raw) return "—";
    const [h, m] = raw.split(":");
    const hour = Number(h);
    if (!Number.isFinite(hour)) return raw;
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m || "00"} ${suffix}`;
  };

  const auditVisitTimeOptions = [
    { value: "08:00", label: "8:00 AM" },
    { value: "09:00", label: "9:00 AM" },
    { value: "10:00", label: "10:00 AM" },
    { value: "11:00", label: "11:00 AM" },
    { value: "12:00", label: "12:00 PM" },
    { value: "13:00", label: "1:00 PM" },
    { value: "14:00", label: "2:00 PM" },
    { value: "15:00", label: "3:00 PM" },
    { value: "16:00", label: "4:00 PM" },
    { value: "17:00", label: "5:00 PM" },
  ];

  const formatAuditPreferredSchedule = (item: {
    preferred_audit_date?: string | null;
    preferred_audit_time?: string | null;
  }) => {
    const date = item?.preferred_audit_date;
    const time = item?.preferred_audit_time;
    if (!date && !time) return null;
    const dateLabel = date ? formatDate(date) : "—";
    const timeLabel = formatAuditPreferredTime(time);
    return `${dateLabel} at ${timeLabel}`;
  };

  const displayUserFullName = (
    user: { name?: string; first_name?: string; sur_name?: string } | null | undefined,
    fallback = "N/A"
  ) => {
    if (!user) return fallback;
    const fromName = String(user.name ?? "").trim();
    if (fromName) return fromName;
    const fromParts = [user.first_name, user.sur_name].filter(Boolean).join(" ").trim();
    return fromParts || fallback;
  };

  const isBnplDeliveryPlaceholder = (title: string | null | undefined) =>
    !String(title ?? "").trim() || /^bnpl\s*delivery$/i.test(String(title).trim());

  const deliverySiteContactDisplay = (
    addr: { title?: string } | null | undefined,
    user: { first_name?: string; sur_name?: string } | null | undefined
  ) => {
    const raw = String(addr?.title ?? "").trim();
    if (raw && !isBnplDeliveryPlaceholder(raw)) return raw;
    const name = `${user?.first_name || ""} ${user?.sur_name || ""}`.trim();
    return name || raw || "—";
  };

  const getOrderBundleOrProductTitle = (item: any, summary?: any): string | null => {
    if (!item && !summary) return null;

    // Bundle orders: show the bundle name, not component material lines.
    const bundleTitle =
      summary?.bundle_title ||
      item?.bundle?.title ||
      item?.bundle?.name ||
      null;
    if (bundleTitle) return String(bundleTitle);

    const firstLine = item?.items?.[0];
    const firstIsBundle =
      firstLine &&
      String(firstLine.itemable_type || firstLine.type || "")
        .toLowerCase()
        .includes("bundle");
    if (firstIsBundle) {
      const t =
        firstLine.item?.title ||
        firstLine.itemable?.title ||
        firstLine.title ||
        firstLine.name;
      if (t) return String(t);
    }

    const formatLineLabel = (row: any): string | null => {
      const label =
        row?.name ||
        row?.title ||
        row?.item?.title ||
        row?.itemable?.title ||
        null;
      if (!label) return null;
      const q = row?.quantity && Number(row.quantity) > 1 ? ` (×${row.quantity})` : "";
      return `${label}${q}`;
    };

    // Multi-product Buy Now: join every line item — don't stop at orders.product_title (first only).
    const summaryLabels = Array.isArray(summary?.items)
      ? summary.items.map(formatLineLabel).filter(Boolean)
      : [];
    if (summaryLabels.length > 0) {
      return summaryLabels.join(", ");
    }

    const orderItemLabels = Array.isArray(item?.items)
      ? item.items.map(formatLineLabel).filter(Boolean)
      : [];
    if (orderItemLabels.length > 0) {
      return orderItemLabels.join(", ");
    }

    const productTitle =
      summary?.product_title ||
      item?.product?.title ||
      item?.product?.name ||
      null;
    if (productTitle) return String(productTitle);

    return null;
  };

  const filterOrderListRowsForInstaller = (rows: any[], item: any, summary?: any) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const installer = resolveOrderInstallerChoice(item, summary);
    return rows.filter((row: any) => {
      const label = String(row?.name || row?.description || row?.title || "")
        .toLowerCase()
        .trim();
      const isMaterialLine =
        label.includes("installation material") ||
        label === "material cost" ||
        label === "installation materials cost";
      if (!isMaterialLine) return true;
      if (installer === "own") return false;
      const lineAmount = Math.max(
        Number(row?.rate ?? 0),
        Number(row?.price ?? 0),
        Number(row?.total_cost ?? 0)
      );
      return lineAmount > 0;
    });
  };

  const resolveModalOrderItems = (summary: any, item: any) => {
    let rows: any[] = [];
    if (summary?.items?.length) {
      rows = summary.items;
    } else {
      const raw = item?.items;
      if (!Array.isArray(raw) || raw.length === 0) return [];
      rows = raw.map((row: any) => ({
        name: row.item?.title || row.itemable?.title || row.name || "Item",
        description: row.item?.subtitle || row.item?.title || row.itemable?.title || "",
        quantity: row.quantity ?? 1,
        price: Number(row.unit_price ?? row.subtotal ?? 0),
      }));
    }

    return filterOrderListRowsForInstaller(rows, item, summary);
  };

  const renderOrderItemsList = (items: any[]) => {
    if (!items?.length) return null;
    return (
      <div className="space-y-3">
        {items.map((orderItem: any, idx: number) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h4 className="font-medium text-gray-900">{orderItem.name}</h4>
                {orderItem.description && orderItem.description !== orderItem.name ? (
                  <p className="text-sm text-gray-600 mt-1">{orderItem.description}</p>
                ) : null}
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold text-[#273E8E]">
                  {formatCurrency(orderItem.price)}
                </div>
                <div className="text-sm text-gray-500">Qty: {orderItem.quantity ?? 1}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getRequestedServiceDate = (item: any, summary?: any) => {
    return (
      item?.installation_requested_date ||
      item?.installation_date ||
      item?.delivery_requested_date ||
      item?.delivery_date ||
      item?.requested_date ||
      item?.preferred_date ||
      item?.delivery_address?.preferred_date ||
      summary?.installation_requested_date ||
      summary?.installation_date ||
      summary?.delivery_requested_date ||
      summary?.delivery_date ||
      summary?.requested_date ||
      summary?.preferred_date ||
      summary?.delivery_address?.preferred_date ||
      null
    );
  };

  /** troosolar → installation date; own → delivery date */
  const resolveOrderInstallerChoice = (item: any, summary?: any): "own" | "troosolar" | null => {
    const raw = String(item?.installer_choice || summary?.installer_choice || "")
      .toLowerCase()
      .trim();
    if (raw === "own" || raw === "troosolar") return raw;

    // Older Buy Now orders had no installer_choice column — infer from fee rules.
    const orderType = String(item?.order_type || summary?.order_type || "").toLowerCase();
    if (orderType === "buy_now") {
      const install = Number(
        item?.installation_price ?? item?.installation_fee ?? summary?.installation_fee ?? 0
      );
      const inspect = Number(item?.inspection_fee ?? summary?.inspection_fee ?? 0);
      if (install <= 0 && inspect <= 0) return "own";
      return "troosolar";
    }
    return null;
  };

  const getRequestedServiceDateLabel = (item: any, summary?: any) => {
    const choice = resolveOrderInstallerChoice(item, summary);
    if (choice === "own") return "Requested delivery date";
    if (choice === "troosolar") return "Requested installation date";
    return "Requested installation / delivery date";
  };

  const getSiteSectionTitle = (item: any, summary?: any) => {
    const choice = resolveOrderInstallerChoice(item, summary);
    if (choice === "own") return "Delivery site";
    if (choice === "troosolar") return "Installation site";
    return "Installation / delivery site";
  };

  const formatCustomerTypeLabel = (type: unknown): string | null => {
    if (type == null || type === "") return null;
    const t = String(type).toLowerCase().trim();
    if (t === "sme") return "For SME";
    if (t === "residential") return "For Residential";
    if (t === "commercial") return "For Commercial";
    return String(type).replace(/_/g, " ");
  };

  const resolveOrderCustomerType = (item: any, summary?: any) =>
    formatCustomerTypeLabel(
      item?.customer_type ||
        summary?.customer_type ||
        item?.loan_application?.customer_type ||
        null
    );

  const resolveOrderPropertyField = (key: string, item: any, summary?: any) => {
    const fromItem = item?.[key];
    if (fromItem !== undefined && fromItem !== null && fromItem !== "") return fromItem;
    const fromSummary = summary?.[key];
    if (fromSummary !== undefined && fromSummary !== null && fromSummary !== "") return fromSummary;
    return null;
  };

  const orderGatedEstateLabel = (value: unknown): string => {
    if (value === true || value === 1 || value === "1" || value === "true") return "Yes";
    if (value === false || value === 0 || value === "0" || value === "false") return "No";
    return "—";
  };

  const currentData = getCurrentData();
  // Support both paginated response (data.data, data.total) and direct array
  const items =
    activeTab === "Custom Orders"
      ? []
      : Array.isArray(currentData)
        ? currentData
        : (currentData?.data ?? []);
  const total =
    activeTab !== "Custom Orders"
      ? (typeof (currentData as any)?.pagination?.total === "number"
          ? (currentData as any).pagination.total
          : typeof (currentData as any)?.total === "number"
            ? (currentData as any).total
            : items.length)
      : (auditUsersData?.data?.pagination?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, auditTypeFilter, customOrdersUserFilter, searchQuery, activeTab]);

  return (
    <>
      <div className="bg-[#F5F7FF] min-h-screen">
        <Header
          adminName="Hi, Admin"
          adminImage="/assets/layout/admin.png"
          onNotificationClick={() => {}}
        />

        <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">BNPL & Buy Now Management</h1>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {["BNPL Applications", "BNPL Guarantors", "Guarantor Form", "Loan Settings", "Mono Loans", "Banner", "Buy Now Orders", "BNPL Orders", "Audit Requests", "Custom Orders"].map(
                (tab) => (
                  <button
                    key={tab}
                    className={`py-2 px-1 border-b-4 font-medium text-md cursor-pointer ${
                      activeTab === tab
                        ? "border-[#273E8E] text-black"
                        : "border-transparent text-[#00000080]"
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                )
              )}
            </nav>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {isLoading() ? (
            <StatsLoadingSkeleton count={3} />
          ) : (
            <>
              <div
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-[120px]"
                style={{
                  boxShadow: "5px 5px 10px 0px rgba(109, 108, 108, 0.25)",
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-19 h-19 bg-[#0000FF33] rounded-full flex items-center justify-center">
                    <img
                      src={images.users}
                      alt=""
                      className="w-9 h-9 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total</p>
                    <p className="text-2xl font-bold text-blue-600">{total}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Filters and Search - hidden on config-only tabs */}
        {activeTab !== "Guarantor Form" && activeTab !== "Loan Settings" && activeTab !== "Mono Loans" && activeTab !== "Banner" && (
        <div className="mb-6 bg-white rounded-lg p-4 shadow-sm">
          {filterUserId != null && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-900">
              <span>
                Showing records for user{" "}
                <Link to={`/user-activity/${filterUserId}/loans`} className="font-semibold underline">
                  #{filterUserId}
                </Link>
              </span>
              <button
                type="button"
                onClick={() => setFilterUserId(null)}
                className="text-indigo-700 hover:text-indigo-900 font-medium"
              >
                Clear user filter
              </button>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {activeTab !== "Custom Orders" && (
              <select
                className="border border-[#CDCDCD] rounded-lg px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                {activeTab === "BNPL Applications" && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="counter_offer">Counter Offer</option>
                  </>
                )}
                {activeTab === "BNPL Guarantors" && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </>
                )}
                {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </>
                )}
                {activeTab === "Audit Requests" && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="completed">Completed</option>
                  </>
                )}
              </select>
              )}
              {(activeTab === "Audit Requests" || activeTab === "Custom Orders") && (
                <select
                  className="border border-[#CDCDCD] rounded-lg px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  value={auditTypeFilter}
                  onChange={(e) => setAuditTypeFilter(e.target.value)}
                >
                  <option value="All Types">All Types</option>
                  <option value="home-office">Home/Office</option>
                  <option value="commercial">Commercial</option>
                </select>
              )}
              {activeTab === "Custom Orders" && (
                <select
                  className="border border-[#CDCDCD] rounded-lg px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  value={customOrdersUserFilter}
                  onChange={(e) => setCustomOrdersUserFilter(e.target.value)}
                >
                  <option value="All">All Users</option>
                  <option value="Has Pending">Has Pending Requests</option>
                </select>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-3.5 border border-[#00000080] rounded-lg text-[15px] w-[320px] focus:outline-none bg-white shadow-[0_2px_6px_rgba(0,0,0,0.05)] placeholder-gray-400"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Loan Settings Tab Content - Global BNPL config */}
        {activeTab === "Loan Settings" ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-3xl">
            <h2 className="text-xl font-bold text-gray-900 mb-2">BNPL Loan Settings</h2>
            <p className="text-sm text-gray-600 mb-6">
              Configure default interest rate, minimum down payment %, fees, minimum loan amount, and allowed loan durations. These apply to new applications unless overridden per application in View Detail.
            </p>
            {bnplSettingsLoading ? (
              <LoadingSpinner message="Loading settings..." />
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  setSavingLoanSettings(true);
                  try {
                    await updateBNPLSettings({
                      interest_rate_percentage: loanSettingsForm.interest_rate_percentage ? Number(loanSettingsForm.interest_rate_percentage) : undefined,
                      min_down_percentage: loanSettingsForm.down_payment_options.length
                        ? Math.min(...loanSettingsForm.down_payment_options)
                        : (loanSettingsForm.min_down_percentage ? Number(loanSettingsForm.min_down_percentage) : undefined),
                      down_payment_options: loanSettingsForm.down_payment_options.length ? loanSettingsForm.down_payment_options : undefined,
                      management_fee_percentage: loanSettingsForm.management_fee_percentage ? Number(loanSettingsForm.management_fee_percentage) : undefined,
                      legal_fee_percentage: loanSettingsForm.legal_fee_percentage ? Number(loanSettingsForm.legal_fee_percentage) : undefined,
                      insurance_fee_percentage: loanSettingsForm.insurance_fee_percentage ? Number(loanSettingsForm.insurance_fee_percentage) : undefined,
                      minimum_loan_amount: loanSettingsForm.minimum_loan_amount ? Number(loanSettingsForm.minimum_loan_amount) : undefined,
                      loan_durations: loanSettingsForm.loan_durations.length ? loanSettingsForm.loan_durations : undefined,
                    }, token);
                    queryClient.invalidateQueries({ queryKey: ["bnpl-settings"] });
                    alert("Loan settings saved successfully.");
                  } catch (err: any) {
                    alert(err?.response?.data?.message || err?.message || "Failed to save settings.");
                  } finally {
                    setSavingLoanSettings(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interest rate (%)</label>
                    <input type="number" step="0.01" min="0" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={loanSettingsForm.interest_rate_percentage} onChange={(e) => setLoanSettingsForm((f) => ({ ...f, interest_rate_percentage: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum down options (%)</label>
                    <p className="text-xs text-gray-500 mb-2">Add allowed down-payment percentages. The minimum is picked automatically from your list.</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {loanSettingsForm.down_payment_options.map((p) => (
                        <span key={p} className="inline-flex items-center px-3 py-1 rounded-full bg-[#273E8E] text-white text-sm">
                          {p}%
                          <button type="button" className="ml-2 hover:opacity-80" onClick={() => setLoanSettingsForm((f) => {
                            const next = f.down_payment_options.filter((v) => v !== p);
                            return { ...f, down_payment_options: next, min_down_percentage: next.length ? String(Math.min(...next)) : "" };
                          })}>×</button>
                        </span>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="e.g. 30"
                          className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm"
                          value={loanSettingsForm.newDownPaymentOption}
                          onChange={(e) => setLoanSettingsForm((f) => ({ ...f, newDownPaymentOption: e.target.value }))}
                        />
                        <button
                          type="button"
                          className="px-3 py-1 bg-gray-200 rounded-lg text-sm hover:bg-gray-300"
                          onClick={() => {
                            const n = Number(loanSettingsForm.newDownPaymentOption);
                            if (Number.isNaN(n) || n < 0 || n > 100) return;
                            setLoanSettingsForm((f) => {
                              if (f.down_payment_options.includes(n)) return { ...f, newDownPaymentOption: "" };
                              const next = [...f.down_payment_options, n].sort((a, b) => a - b);
                              return {
                                ...f,
                                down_payment_options: next,
                                min_down_percentage: String(Math.min(...next)),
                                newDownPaymentOption: "",
                              };
                            });
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    {loanSettingsForm.down_payment_options.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2">Minimum down (auto): {Math.min(...loanSettingsForm.down_payment_options)}%</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Management fee (%)</label>
                    <input type="number" step="0.01" min="0" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={loanSettingsForm.management_fee_percentage} onChange={(e) => setLoanSettingsForm((f) => ({ ...f, management_fee_percentage: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Legal fee (%)</label>
                    <input type="number" step="0.01" min="0" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={loanSettingsForm.legal_fee_percentage} onChange={(e) => setLoanSettingsForm((f) => ({ ...f, legal_fee_percentage: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Insurance fee (%)</label>
                    <input type="number" step="0.01" min="0" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={loanSettingsForm.insurance_fee_percentage} onChange={(e) => setLoanSettingsForm((f) => ({ ...f, insurance_fee_percentage: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum loan amount (₦)</label>
                    <input type="number" min="0" step="1000" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={loanSettingsForm.minimum_loan_amount} onChange={(e) => setLoanSettingsForm((f) => ({ ...f, minimum_loan_amount: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan durations (months)</label>
                  <p className="text-xs text-gray-500 mb-2">Add allowed tenors e.g. 3, 6, 9, 12. Admin can add more (e.g. 18, 24).</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {loanSettingsForm.loan_durations.map((m) => (
                      <span key={m} className="inline-flex items-center px-3 py-1 rounded-full bg-[#273E8E] text-white text-sm">
                        {m} months
                        <button type="button" className="ml-2 hover:opacity-80" onClick={() => setLoanSettingsForm((f) => ({ ...f, loan_durations: f.loan_durations.filter((d) => d !== m) }))}>×</button>
                      </span>
                    ))}
                    <div className="flex gap-2">
                      <input type="number" min="1" max="120" placeholder="e.g. 18" className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" value={loanSettingsForm.newDuration} onChange={(e) => setLoanSettingsForm((f) => ({ ...f, newDuration: e.target.value }))} />
                      <button type="button" className="px-3 py-1 bg-gray-200 rounded-lg text-sm hover:bg-gray-300" onClick={() => { const n = parseInt(loanSettingsForm.newDuration, 10); if (!isNaN(n) && n >= 1 && n <= 120 && !loanSettingsForm.loan_durations.includes(n)) { setLoanSettingsForm((f) => ({ ...f, loan_durations: [...f.loan_durations, n].sort((a, b) => a - b), newDuration: "" })); } }}>Add</button>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={savingLoanSettings} className="bg-[#273E8E] hover:bg-[#1e3270] disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium">
                  {savingLoanSettings ? "Saving..." : "Save Loan Settings"}
                </button>
              </form>
            )}
          </div>
        ) : activeTab === "Mono Loans" ? (
          <MonoLoansSection token={token || ""} />
        ) : activeTab === "Guarantor Form" ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-2">BNPL Guarantor Form</h2>
            <p className="text-sm text-gray-600 mb-6">
              Upload the guarantor form PDF that approved loan users will download. Use your own template with your terms, conditions, and fields. This file replaces the default form—users see only the option to download this form in their dashboard.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!guarantorFormFile || !token) return;
                setUploadingGuarantorForm(true);
                try {
                  const res = await uploadBNPLGuarantorForm(guarantorFormFile, token);
                  if (res?.status === "success") {
                    alert(res?.message || "Guarantor form updated successfully.");
                    setGuarantorFormFile(null);
                  } else {
                    alert(res?.message || "Upload failed.");
                  }
                } catch (err: any) {
                  const msg = err?.response?.data?.message || err?.message || "Failed to upload guarantor form.";
                  const errors = err?.response?.data?.errors;
                  alert(errors ? Object.values(errors).flat().join("\n") : msg);
                } finally {
                  setUploadingGuarantorForm(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select PDF file (max 10MB)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setGuarantorFormFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#273E8E] file:text-white hover:file:bg-[#1e3270]"
                />
                {guarantorFormFile && (
                  <p className="mt-2 text-sm text-gray-600">Selected: {guarantorFormFile.name}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={!guarantorFormFile || uploadingGuarantorForm}
                className="bg-[#273E8E] hover:bg-[#1e3270] disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {uploadingGuarantorForm ? "Uploading..." : "Upload Guarantor Form"}
              </button>
            </form>
          </div>
        ) : activeTab === "Banner" ? (
          <div className="flex flex-col gap-8 max-w-2xl">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard banners</h1>
              <p className="text-sm text-gray-600">
                Two placements: the large promo on the user home dashboard, and the image at the bottom of the desktop sidebar.
              </p>
            </div>
            {siteBannerLoading ? (
              <LoadingSpinner message="Loading banners..." />
            ) : (
              <>
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Home promotion banner</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Shown on the user dashboard home (main promo area). Upload to set or replace; remove to hide.
                  </p>
                  {homeBannerPreview && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-2">Current banner</p>
                      <img
                        src={homeBannerPreview}
                        alt="Home promotion banner preview"
                        className="max-w-full h-auto max-h-[243px] rounded-lg object-cover border border-gray-200"
                      />
                    </div>
                  )}
                  {!homeBannerPreview && (
                    <p className="text-sm text-gray-500 mb-6">No banner set.</p>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!bannerFileHome || !token) return;
                      setUploadingHomeBanner(true);
                      try {
                        const res = await uploadSiteBanner(bannerFileHome, token, "home");
                        if (res?.status === "success") {
                          alert(res?.message || "Home banner updated.");
                          setBannerFileHome(null);
                          queryClient.invalidateQueries({ queryKey: ["site-banners"] });
                          refetchSiteBanners();
                        } else {
                          alert(res?.message || "Upload failed.");
                        }
                      } catch (err: any) {
                        const msg = err?.response?.data?.message || err?.message || "Failed to upload banner.";
                        const errors = err?.response?.data?.errors;
                        alert(errors ? Object.values(errors).flat().join("\n") : msg);
                      } finally {
                        setUploadingHomeBanner(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select image (JPEG, PNG, GIF, WebP – max 5MB)
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={(e) => setBannerFileHome(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#273E8E] file:text-white hover:file:bg-[#1e3270]"
                      />
                      {bannerFileHome && (
                        <p className="mt-2 text-sm text-gray-600">Selected: {bannerFileHome.name}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={!bannerFileHome || uploadingHomeBanner}
                        className="bg-[#273E8E] hover:bg-[#1e3270] disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                      >
                        {uploadingHomeBanner ? "Uploading..." : "Upload / replace home banner"}
                      </button>
                      {homeBannerPreview && (
                        <button
                          type="button"
                          disabled={removingHomeBanner}
                          onClick={async () => {
                            if (!token || !confirm("Remove the home banner? It will no longer show on the dashboard.")) return;
                            setRemovingHomeBanner(true);
                            try {
                              const res = await deleteSiteBanner(token, "home");
                              if (res?.status === "success") {
                                alert(res?.message || "Banner removed.");
                                queryClient.invalidateQueries({ queryKey: ["site-banners"] });
                                refetchSiteBanners();
                              } else {
                                alert(res?.message || "Failed to remove banner.");
                              }
                            } catch (err: any) {
                              alert(err?.response?.data?.message || err?.message || "Failed to remove banner.");
                            } finally {
                              setRemovingHomeBanner(false);
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                          {removingHomeBanner ? "Removing..." : "Remove home banner"}
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Sidebar banner</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Shown at the bottom of the desktop dashboard sidebar. If unset, the default graphic is used.
                  </p>
                  {sidebarBannerPreview && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-2">Current banner</p>
                      <img
                        src={sidebarBannerPreview}
                        alt="Sidebar banner preview"
                        className="max-w-full h-auto max-h-[280px] rounded-lg object-cover border border-gray-200"
                      />
                    </div>
                  )}
                  {!sidebarBannerPreview && (
                    <p className="text-sm text-gray-500 mb-6">No custom sidebar banner — users see the default image.</p>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!bannerFileSidebar || !token) return;
                      setUploadingSidebarBanner(true);
                      try {
                        const res = await uploadSiteBanner(bannerFileSidebar, token, "sidebar");
                        if (res?.status === "success") {
                          alert(res?.message || "Sidebar banner updated.");
                          setBannerFileSidebar(null);
                          queryClient.invalidateQueries({ queryKey: ["site-banners"] });
                          refetchSiteBanners();
                        } else {
                          alert(res?.message || "Upload failed.");
                        }
                      } catch (err: any) {
                        const msg = err?.response?.data?.message || err?.message || "Failed to upload banner.";
                        const errors = err?.response?.data?.errors;
                        alert(errors ? Object.values(errors).flat().join("\n") : msg);
                      } finally {
                        setUploadingSidebarBanner(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select image (JPEG, PNG, GIF, WebP – max 5MB)
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={(e) => setBannerFileSidebar(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#273E8E] file:text-white hover:file:bg-[#1e3270]"
                      />
                      {bannerFileSidebar && (
                        <p className="mt-2 text-sm text-gray-600">Selected: {bannerFileSidebar.name}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={!bannerFileSidebar || uploadingSidebarBanner}
                        className="bg-[#273E8E] hover:bg-[#1e3270] disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                      >
                        {uploadingSidebarBanner ? "Uploading..." : "Upload / replace sidebar banner"}
                      </button>
                      {sidebarBannerPreview && (
                        <button
                          type="button"
                          disabled={removingSidebarBanner}
                          onClick={async () => {
                            if (!token || !confirm("Remove the sidebar banner? The default sidebar image will show again.")) return;
                            setRemovingSidebarBanner(true);
                            try {
                              const res = await deleteSiteBanner(token, "sidebar");
                              if (res?.status === "success") {
                                alert(res?.message || "Banner removed.");
                                queryClient.invalidateQueries({ queryKey: ["site-banners"] });
                                refetchSiteBanners();
                              } else {
                                alert(res?.message || "Failed to remove banner.");
                              }
                            } catch (err: any) {
                              alert(err?.response?.data?.message || err?.message || "Failed to remove banner.");
                            } finally {
                              setRemovingSidebarBanner(false);
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                          {removingSidebarBanner ? "Removing..." : "Remove sidebar banner"}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        ) : activeTab === "Custom Orders" ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Custom Orders Management</h2>
                <button
                  onClick={() => setShowCreateOrderModal(true)}
                  className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-6 py-3 rounded-full text-sm font-medium transition-colors cursor-pointer"
                >
                  Create Custom Order
                </button>
              </div>
            </div>

            {/* Users Table */}
            {auditUsersLoading ? (
              <LoadingSpinner message="Loading users with audit requests..." />
            ) : auditUsersData?.data?.data?.length === 0 ? (
              <div className="p-12 text-center">
                <div className="max-w-md mx-auto">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No users found</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    There are no users with audit requests at the moment. Users who request audit services will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#EBEBEB] border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-medium text-black">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-black">
                          Email
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-black">
                          Phone
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-black">
                          Audit Requests
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-black">
                          Status Summary
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-black">
                          Custom Order Cart
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-black">
                          Property Details
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-black">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {(
                        auditUsersData?.data?.data?.map((user: any, index: number) => {
                          const needsPropertyDetails = user.audit_requests?.some(
                            (req: any) =>
                              req.needs_admin_input ??
                              (req.audit_type === "commercial" && !req.has_property_details && req.status === "pending")
                          );
                          const hasPropertyDetails = user.audit_requests?.some(
                            (req: any) => req.has_property_details
                          );
                          
                          return (
                            <tr
                              key={user.id}
                              className={`${
                                index % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"
                              } transition-colors border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer`}
                              onClick={async () => {
                                setSelectedUser(user);
                                setSelectedUserId(user.id);
                                setShowUserDetailModal(true);
                                // Refetch cart data for the selected user
                                refetchUserCart();
                              }}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {user.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {user.email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {user.phone}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                <div className="flex flex-col">
                                  <span className="font-medium">{user.audit_request_count || 0} total</span>
                                  {user.pending_count > 0 && (
                                    <span className="text-xs text-orange-600">
                                      {user.pending_count} pending
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex flex-col gap-1">
                                  {user.approved_count > 0 && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                      {user.approved_count} Approved
                                    </span>
                                  )}
                                  {user.rejected_count > 0 && (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                      {user.rejected_count} Rejected
                                    </span>
                                  )}
                                  {user.completed_count > 0 && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      {user.completed_count} Completed
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {user.cart_item_count > 0 ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium text-gray-800">
                                      {user.cart_item_count} item{user.cart_item_count !== 1 ? "s" : ""} · {formatCurrency(user.total_cart_amount || 0)}
                                    </span>
                                    {user.has_cart_access_token && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded w-fit">
                                        Link sent
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No cart items</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {needsPropertyDetails ? (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                                    ⚠️ Needs Details
                                  </span>
                                ) : hasPropertyDetails ? (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                    ✓ Details Shared
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                                    No Details
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setSelectedUser(user);
                                    setSelectedUserId(user.id);
                                    setShowUserDetailModal(true);
                                    // Refetch cart data for the selected user
                                    refetchUserCart();
                                  }}
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {auditUsersData?.data?.pagination && auditUsersData.data.pagination.last_page > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">
                    <div className="flex items-center text-sm text-gray-700">
                      <span>
                        Showing {auditUsersData.data.pagination.from} to{" "}
                        {auditUsersData.data.pagination.to} of {auditUsersData.data.pagination.total} results
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-2 text-sm font-medium rounded-md border ${
                          currentPage === 1
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer"
                        }`}
                      >
                        Previous
                      </button>
                      <div className="flex items-center space-x-1">
                        {Array.from(
                          { length: auditUsersData.data.pagination.last_page },
                          (_, i) => i + 1
                        )
                          .slice(
                            Math.max(0, currentPage - 2),
                            Math.min(auditUsersData.data.pagination.last_page, currentPage + 3)
                          )
                          .map((pageNumber) => (
                            <button
                              key={pageNumber}
                              onClick={() => setCurrentPage(pageNumber)}
                              className={`px-3 py-2 text-sm font-medium rounded-md border ${
                                currentPage === pageNumber
                                  ? "bg-[#273E8E] text-white border-[#273E8E]"
                                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {pageNumber}
                            </button>
                          ))}
                      </div>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(prev + 1, auditUsersData.data.pagination.last_page)
                          )
                        }
                        disabled={currentPage === auditUsersData.data.pagination.last_page}
                        className={`px-3 py-2 text-sm font-medium rounded-md border ${
                          currentPage === auditUsersData.data.pagination.last_page
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {isLoading() ? (
              <LoadingSpinner message="Loading..." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-[#EBEBEB]">
                      {activeTab === "BNPL Applications" && (
                        <>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            ID
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Customer
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Loan Amount
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Duration
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Date
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Actions
                          </th>
                        </>
                      )}
                      {activeTab === "BNPL Guarantors" && (
                        <>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            ID
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Name
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Phone
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Email
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Date
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Actions
                          </th>
                        </>
                      )}
                      {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") && (
                        <>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            ID
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Customer
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Total Price
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Date
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Actions
                          </th>
                        </>
                      )}
                      {activeTab === "Audit Requests" && (
                        <>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            ID
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Customer
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Type
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Property Address
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Date
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-black">
                            Actions
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          No data found
                        </td>
                      </tr>
                    ) : (
                      items.map((item: any, index: number) => (
                        <tr
                          key={item.id}
                          className={`${
                            index % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"
                          } transition-colors border-b border-gray-100 last:border-b-0`}
                        >
                          {activeTab === "BNPL Applications" && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.id}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.user
                                  ? `${item.user.first_name} ${item.user.sur_name}`
                                  : "N/A"}
                                <br />
                                <span className="text-xs text-gray-500">
                                  {item.user?.email || ""}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                {formatCurrency(item.loan_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {item.repayment_duration} months
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full"
                                  style={getStatusColor(item.status)}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {item.created_at ? formatDate(item.created_at) : "—"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                  <button
                                    className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                    onClick={() => handleViewDetails(item)}
                                  >
                                    View
                                  </button>
                                  <button
                                    className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                    onClick={() => handleUpdateStatus(item)}
                                  >
                                    Update
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                          {activeTab === "BNPL Guarantors" && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.id}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.full_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {item.phone}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {item.email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full"
                                  style={getStatusColor(item.status)}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatDate(item.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                  onClick={() => handleUpdateStatus(item)}
                                >
                                  Update
                                </button>
                              </td>
                            </>
                          )}
                          {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.id}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.user
                                  ? `${item.user.first_name} ${item.user.sur_name}`
                                  : "N/A"}
                                <br />
                                <span className="text-xs text-gray-500">
                                  {item.user?.email || ""}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                {formatCurrency(item.total_price)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full"
                                  style={getStatusColor(item.order_status)}
                                >
                                  {item.order_status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatDate(item.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                  <button
                                    className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                    onClick={() => handleViewDetails(item)}
                                  >
                                    View
                                  </button>
                                  <button
                                    className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                    onClick={() => handleUpdateStatus(item)}
                                  >
                                    Update
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                          {activeTab === "Audit Requests" && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.id}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.user
                                  ? displayUserFullName(item.user)
                                  : "N/A"}
                                <br />
                                <span className="text-xs text-gray-500">
                                  {item.user?.email ?? ""}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                <span className="capitalize">
                                  {item.audit_type?.replace("-", "/") || "N/A"}
                                </span>
                                {item.audit_type === "commercial" && !item.property_address && (
                                  <span className="ml-2 text-xs text-orange-600 font-semibold">
                                    (Needs Details)
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                {item.property_address ? (
                                  <span title={item.property_address}>{item.property_address}</span>
                                ) : (
                                  <span className="text-gray-400 italic">Not provided</span>
                                )}
                                {item.property_state && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({item.property_state})
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1 items-start">
                                  <span
                                    className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full"
                                    style={getStatusColor(item.status)}
                                  >
                                    {item.status}
                                  </span>
                                  {item.customer_has_paid && (
                                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-100 text-emerald-800">
                                      Paid
                                      {item.customer_payment_date
                                        ? ` · ${formatDate(item.customer_payment_date)}`
                                        : ""}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatDate(item.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                  <button
                                    className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                    onClick={() => handleViewDetails(item)}
                                  >
                                    View
                                  </button>
                                  <button
                                    className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                                    onClick={() => handleUpdateStatus(item)}
                                  >
                                    Update
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center text-sm text-gray-700">
                    <span>
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, total)} of {total} results
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-2 text-sm font-medium rounded-md border ${
                        currentPage === 1
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      Previous
                    </button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNumber}
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`px-3 py-2 text-sm font-medium rounded-md border ${
                              currentPage === pageNumber
                                ? "bg-[#273E8E] text-white border-[#273E8E]"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-2 text-sm font-medium rounded-md border ${
                        currentPage === totalPages
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        )}
        </div>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab === "BNPL Applications" ? "BNPL Application Details" :
                 activeTab === "BNPL Guarantors" ? "Guarantor Details" :
                 activeTab === "Audit Requests" ? "Audit Request Details" :
                 "Order Details"}
              </h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedItem(null);
                  setOrderSummary(null);
                  setOrderInvoice(null);
                  setInvoiceNotFound(false);
                  setDetailModalTab("Details");
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Tabs for Orders */}
            {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") && (
              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8">
                  {["Details", "Summary", "Invoice"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setDetailModalTab(tab);
                        if (tab === "Invoice" && !orderInvoice && !invoiceNotFound) {
                          handleLoadInvoice();
                        }
                        if (tab !== "Invoice") {
                          setInvoiceNotFound(false);
                        }
                      }}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        detailModalTab === tab
                          ? "border-[#273E8E] text-[#273E8E]"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>
              </div>
            )}

            {/* Tab Content */}
            {detailModalTab === "Details" && (
              <div className="space-y-6">
                {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") ? (
                  <>
                    {/* Order Overview */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Order Overview</h3>
                        <div className="flex items-center gap-2">
                          {selectedItem.payment_status && (
                            <span
                              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full"
                              style={getStatusColor(selectedItem.payment_status)}
                            >
                              Payment: {selectedItem.payment_status}
                            </span>
                          )}
                          {selectedItem.order_status && (
                            <span
                              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full"
                              style={getStatusColor(selectedItem.order_status)}
                            >
                              {selectedItem.order_status}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Order ID</p>
                          <p className="text-sm font-semibold text-gray-900">#{selectedItem.id || "N/A"}</p>
                        </div>
                        {selectedItem.total_price && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Price</p>
                            <p className="text-sm font-semibold text-[#273E8E]">
                              {formatCurrency(selectedItem.total_price)}
                            </p>
                          </div>
                        )}
                        {selectedItem.payment_method && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Payment Method</p>
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                              {selectedItem.payment_method}
                            </p>
                          </div>
                        )}
                        {selectedItem.created_at && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Order Date</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(selectedItem.created_at)}
                            </p>
                          </div>
                        )}
                        {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") &&
                          (() => {
                            const bundleProductTitle = getOrderBundleOrProductTitle(selectedItem, orderSummary);
                            const hasBundle =
                              !!(orderSummary?.bundle_title || selectedItem?.bundle?.title);
                            if (!bundleProductTitle) return null;
                            const titleParts = hasBundle
                              ? [bundleProductTitle]
                              : bundleProductTitle.split(", ").filter(Boolean);
                            return (
                              <div className="md:col-span-2">
                                <p className="text-xs text-gray-500 mb-1">
                                  {hasBundle ? "Bundle" : "Selected items"}
                                </p>
                                {titleParts.length > 1 ? (
                                  <ul className="text-sm font-semibold text-gray-900 list-disc list-inside space-y-1">
                                    {titleParts.map((title, idx) => (
                                      <li key={`${title}-${idx}`}>{title}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm font-semibold text-gray-900">{bundleProductTitle}</p>
                                )}
                              </div>
                            );
                          })()}
                        {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") &&
                          resolveOrderCustomerType(selectedItem, orderSummary) && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Customer type</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {resolveOrderCustomerType(selectedItem, orderSummary)}
                            </p>
                          </div>
                        )}
                        {activeTab === "Buy Now Orders" &&
                          resolveOrderInstallerChoice(selectedItem, orderSummary) && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Installer</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {resolveOrderInstallerChoice(selectedItem, orderSummary) === "own"
                                ? "Use my own installer"
                                : "TrooSolar installer"}
                            </p>
                          </div>
                        )}
                        {activeTab === "BNPL Orders" && selectedItem.loan_application?.product_category && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Product Category</p>
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                              {String(selectedItem.loan_application.product_category).replace(/-/g, " ")}
                            </p>
                          </div>
                        )}
                        {activeTab === "BNPL Orders" && selectedItem.mono_calculation?.repayment_duration && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Loan Tenor</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {selectedItem.mono_calculation.repayment_duration} months
                            </p>
                          </div>
                        )}
                        {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") &&
                          getRequestedServiceDate(selectedItem, orderSummary) && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              {getRequestedServiceDateLabel(selectedItem, orderSummary)}
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(getRequestedServiceDate(selectedItem, orderSummary))}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Customer Information */}
                    {selectedItem.user && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Customer Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Full Name</p>
                            <p className="text-sm font-medium text-gray-900">
                              {displayUserFullName(selectedItem.user)}
                            </p>
                          </div>
                          {selectedItem.user.email && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Email</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.user.email}</p>
                            </div>
                          )}
                          {selectedItem.user.phone && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Phone</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.user.phone}</p>
                            </div>
                          )}
                          {selectedItem.user.id && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">User ID</p>
                              <p className="text-sm font-medium text-gray-900">#{selectedItem.user.id}</p>
                            </div>
                          )}
                          {resolveOrderCustomerType(selectedItem, orderSummary) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Customer type</p>
                              <p className="text-sm font-medium text-gray-900">
                                {resolveOrderCustomerType(selectedItem, orderSummary)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") && selectedItem.delivery_address && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {getSiteSectionTitle(selectedItem, orderSummary)}
                        </h3>
                        <p className="text-xs text-gray-500 mb-3">
                          Address and contact used for this order (may differ from account phone).
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(selectedItem.delivery_address.title || selectedItem.user) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Contact name (at site)</p>
                              <p className="text-sm font-medium text-gray-900">
                                {deliverySiteContactDisplay(selectedItem.delivery_address, selectedItem.user)}
                              </p>
                            </div>
                          )}
                          {selectedItem.delivery_address.phone_number && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Phone (at site)</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.delivery_address.phone_number}</p>
                            </div>
                          )}
                          {selectedItem.delivery_address.state && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">State</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.delivery_address.state}</p>
                            </div>
                          )}
                          <div className="md:col-span-2">
                            <p className="text-xs text-gray-500 mb-1">Full address</p>
                            <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                              {selectedItem.delivery_address.address || "—"}
                            </p>
                          </div>
                          {resolveOrderPropertyField("property_floors", selectedItem, orderSummary) != null && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">No. of floors</p>
                              <p className="text-sm font-medium text-gray-900">
                                {String(resolveOrderPropertyField("property_floors", selectedItem, orderSummary))}
                              </p>
                            </div>
                          )}
                          {resolveOrderPropertyField("property_rooms", selectedItem, orderSummary) != null && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">No. of rooms</p>
                              <p className="text-sm font-medium text-gray-900">
                                {String(resolveOrderPropertyField("property_rooms", selectedItem, orderSummary))}
                              </p>
                            </div>
                          )}
                          {resolveOrderPropertyField("is_gated_estate", selectedItem, orderSummary) !== null && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Gated estate</p>
                              <p className="text-sm font-medium text-gray-900">
                                {orderGatedEstateLabel(
                                  resolveOrderPropertyField("is_gated_estate", selectedItem, orderSummary)
                                )}
                              </p>
                            </div>
                          )}
                          {orderGatedEstateLabel(
                            resolveOrderPropertyField("is_gated_estate", selectedItem, orderSummary)
                          ) === "Yes" &&
                            resolveOrderPropertyField("estate_name", selectedItem, orderSummary) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Estate name</p>
                              <p className="text-sm font-medium text-gray-900">
                                {String(resolveOrderPropertyField("estate_name", selectedItem, orderSummary))}
                              </p>
                            </div>
                          )}
                          {orderGatedEstateLabel(
                            resolveOrderPropertyField("is_gated_estate", selectedItem, orderSummary)
                          ) === "Yes" &&
                            resolveOrderPropertyField("estate_address", selectedItem, orderSummary) && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 mb-1">Estate address</p>
                              <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                                {String(resolveOrderPropertyField("estate_address", selectedItem, orderSummary))}
                              </p>
                            </div>
                          )}
                          {getRequestedServiceDate(selectedItem, orderSummary) && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 mb-1">
                                {getRequestedServiceDateLabel(selectedItem, orderSummary)}
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {formatDate(getRequestedServiceDate(selectedItem, orderSummary))}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") &&
                      resolveModalOrderItems(orderSummary, selectedItem).length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
                        {loadingSummary ? (
                          <LoadingSpinner message="Loading items..." />
                        ) : (
                          renderOrderItemsList(resolveModalOrderItems(orderSummary, selectedItem))
                        )}
                      </div>
                    )}

                    {activeTab === "BNPL Orders" && selectedItem.loan_application && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">BNPL Application Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedItem.loan_application.credit_check_method && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Credit Check Method</p>
                              <p className="text-sm font-medium text-gray-900 capitalize">{selectedItem.loan_application.credit_check_method}</p>
                            </div>
                          )}
                          {selectedItem.loan_application.credit_check_method === 'auto' && (
                            <>
                              {selectedItem.loan_application.mono_credit_status && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Mono Credit Status</p>
                                  <p className="text-sm font-medium text-gray-900 capitalize">{selectedItem.loan_application.mono_credit_status}</p>
                                </div>
                              )}
                              {selectedItem.loan_application.mono_can_afford !== null && selectedItem.loan_application.mono_can_afford !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Can Afford Loan</p>
                                  <p className={`text-sm font-medium ${selectedItem.loan_application.mono_can_afford ? 'text-green-700' : 'text-red-700'}`}>
                                    {selectedItem.loan_application.mono_can_afford ? 'Yes' : 'No'}
                                  </p>
                                </div>
                              )}
                              {selectedItem.loan_application.mono_monthly_payment_kobo != null && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Mono Estimated Monthly Payment</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    ₦{Number(selectedItem.loan_application.mono_monthly_payment_kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              )}
                              {selectedItem.loan_application.mono_credit_report?.months_assessed && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Assessment Period</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {selectedItem.loan_application.mono_credit_report.months_assessed.start} — {selectedItem.loan_application.mono_credit_report.months_assessed.end}
                                  </p>
                                </div>
                              )}
                              {selectedItem.loan_application.mono_credit_report?.debt?.total_debt != null && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Total Outstanding Debt (Mono)</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    ₦{Number(selectedItem.loan_application.mono_credit_report.debt.total_debt / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                          {selectedItem.loan_application.social_media_handle && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Social Media Handle</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.loan_application.social_media_handle}</p>
                            </div>
                          )}
                          {selectedItem.loan_application.customer_type && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Customer Type</p>
                              <p className="text-sm font-medium text-gray-900 capitalize">{selectedItem.loan_application.customer_type}</p>
                            </div>
                          )}
                          {selectedItem.loan_application.repayment_duration && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Repayment Duration</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.loan_application.repayment_duration} months</p>
                            </div>
                          )}
                          {selectedItem.loan_application.property_state && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Property State</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.loan_application.property_state}</p>
                            </div>
                          )}
                          {selectedItem.loan_application.property_landmark && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Current power sources</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.loan_application.property_landmark}</p>
                            </div>
                          )}
                          {(selectedItem.loan_application.property_floors !== null && selectedItem.loan_application.property_floors !== undefined) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Floors</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.loan_application.property_floors}</p>
                            </div>
                          )}
                          {(selectedItem.loan_application.property_rooms !== null && selectedItem.loan_application.property_rooms !== undefined) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Rooms</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.loan_application.property_rooms}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Gated Estate</p>
                            <p className="text-sm font-medium text-gray-900">{selectedItem.loan_application.is_gated_estate ? "Yes" : "No"}</p>
                          </div>
                          {selectedItem.loan_application.is_gated_estate ? (
                            <>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Estate name</p>
                                <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                                  {bnplLoanAppEstateText(
                                    selectedItem.loan_application as Record<string, unknown>,
                                    "name",
                                    selectedItem.audit_request as Record<string, unknown> | undefined
                                  )}
                                </p>
                              </div>
                              <div className="md:col-span-2">
                                <p className="text-xs text-gray-500 mb-1">Estate address / directions</p>
                                <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                                  {bnplLoanAppEstateText(
                                    selectedItem.loan_application as Record<string, unknown>,
                                    "address",
                                    selectedItem.audit_request as Record<string, unknown> | undefined
                                  )}
                                </p>
                              </div>
                            </>
                          ) : null}
                          {selectedItem.loan_application.property_address && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 mb-1">Property Address</p>
                              <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{selectedItem.loan_application.property_address}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === "BNPL Orders" &&
                      selectedItem.loan_application &&
                      (selectedItem.user_id ?? selectedItem.user?.id) != null && (
                        <MonoApplicationTools
                          token={token || ""}
                          userId={Number(selectedItem.user_id ?? selectedItem.user?.id)}
                          userName={
                            `${selectedItem.user?.first_name || ""} ${selectedItem.user?.sur_name || ""}`.trim() ||
                            "Customer"
                          }
                          application={{
                            credit_check_method: selectedItem.loan_application.credit_check_method,
                            mono_credit_status: selectedItem.loan_application.mono_credit_status,
                            mono_can_afford: selectedItem.loan_application.mono_can_afford,
                            mono_monthly_payment_kobo:
                              selectedItem.loan_application.mono_monthly_payment_kobo,
                            mono_credit_report: selectedItem.loan_application.mono_credit_report,
                            mono_account_id: selectedItem.loan_application.mono_account_id,
                            loan_amount: selectedItem.loan_application.loan_amount,
                            repayment_duration: selectedItem.loan_application.repayment_duration,
                          }}
                          onCreditCheckStarted={() => {
                            if (selectedItem?.id) {
                              openOrderDetail(selectedItem.id);
                            }
                          }}
                        />
                      )}

                    {/* Order Details */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Order Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedItem.total_price && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Total Price</p>
                            <p className="text-lg font-bold text-[#273E8E]">
                              {formatCurrency(selectedItem.total_price)}
                            </p>
                          </div>
                        )}
                        {selectedItem.payment_method && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Payment Method</p>
                            <p className="text-lg font-bold text-gray-900 capitalize">
                              {selectedItem.payment_method}
                            </p>
                          </div>
                        )}
                        {selectedItem.payment_status && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                            <p className="text-lg font-bold text-gray-900 capitalize">
                              {selectedItem.payment_status}
                            </p>
                          </div>
                        )}
                        {selectedItem.order_status && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Order Status</p>
                            <p className="text-lg font-bold text-gray-900 capitalize">
                              {selectedItem.order_status}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {activeTab === "BNPL Orders" && (() => {
                      const rs = selectedItem.repayment_summary;
                      const schedule: any[] = Array.isArray(selectedItem.repayment_schedule)
                        ? selectedItem.repayment_schedule
                        : [];
                      const history: any[] = Array.isArray(selectedItem.repayment_history)
                        ? selectedItem.repayment_history
                        : [];
                      const paidInstallments = schedule.filter(
                        (i) => i.status === "paid" || i.computed_status === "paid"
                      );
                      const customerName =
                        rs?.order_customer_name ||
                        `${selectedItem.user?.first_name || ""} ${selectedItem.user?.sur_name || ""}`.trim() ||
                        "—";
                      const customerEmail =
                        rs?.order_customer_email || selectedItem.user?.email || null;
                      const customerId = rs?.order_customer_id ?? selectedItem.user?.id;

                      return (
                        <div className="space-y-6">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <svg className="w-5 h-5 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              Customer repayment summary
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                              Payments on this BNPL order are attributed to the customer below. When a linked transaction exists, the payer shown is taken from that payment record.
                            </p>
                            <div className="bg-white/80 rounded-lg border border-blue-100 p-4 mb-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Order customer</p>
                              <p className="text-base font-semibold text-gray-900">{customerName}</p>
                              <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                                {customerId != null && <span>User ID: #{customerId}</span>}
                                {customerEmail && <span>{customerEmail}</span>}
                              </div>
                            </div>
                            {rs ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white rounded-lg p-4 border border-blue-100">
                                  <p className="text-xs text-gray-500 mb-1">Total repayment</p>
                                  <p className="text-xl font-bold text-gray-900">{formatCurrency(rs.total_amount ?? 0)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-4 border border-blue-100">
                                  <p className="text-xs text-gray-500 mb-1">Paid</p>
                                  <p className="text-xl font-bold text-green-700">{formatCurrency(rs.paid_amount ?? 0)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-4 border border-blue-100">
                                  <p className="text-xs text-gray-500 mb-1">Pending</p>
                                  <p className="text-xl font-bold text-amber-700">{formatCurrency(rs.pending_amount ?? 0)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-4 border border-blue-100">
                                  <p className="text-xs text-gray-500 mb-1">Overdue (installments)</p>
                                  <p className="text-xl font-bold text-red-700">{formatCurrency(rs.overdue_amount ?? 0)}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600">No repayment summary available for this order.</p>
                            )}
                            {rs && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center text-sm">
                                <div className="bg-white/90 rounded-lg py-2 px-2 border border-blue-50">
                                  <span className="text-gray-500 block text-xs">Installments</span>
                                  <span className="font-bold text-gray-900">{rs.total_installments ?? 0}</span>
                                </div>
                                <div className="bg-white/90 rounded-lg py-2 px-2 border border-blue-50">
                                  <span className="text-gray-500 block text-xs">Paid</span>
                                  <span className="font-bold text-green-700">{rs.paid_installments ?? 0}</span>
                                </div>
                                <div className="bg-white/90 rounded-lg py-2 px-2 border border-blue-50">
                                  <span className="text-gray-500 block text-xs">Pending</span>
                                  <span className="font-bold text-amber-700">{rs.pending_installments ?? 0}</span>
                                </div>
                                <div className="bg-white/90 rounded-lg py-2 px-2 border border-blue-50">
                                  <span className="text-gray-500 block text-xs">Overdue</span>
                                  <span className="font-bold text-red-700">{rs.overdue_installments ?? 0}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payments recorded</h3>
                            <p className="text-sm text-gray-600 mb-4">
                              Installments marked paid and repayment log entries. Payer name uses the linked transaction user when available; otherwise the order customer is shown.
                            </p>
                            {paidInstallments.length === 0 && history.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">No payments recorded yet.</p>
                            ) : (
                              <div className="space-y-4">
                                {paidInstallments.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Paid installments</h4>
                                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-left text-gray-600">
                                          <tr>
                                            <th className="px-3 py-2 font-medium">#</th>
                                            <th className="px-3 py-2 font-medium">Amount</th>
                                            <th className="px-3 py-2 font-medium">Paid at</th>
                                            <th className="px-3 py-2 font-medium">Recorded payer</th>
                                            <th className="px-3 py-2 font-medium">Method / ref</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {paidInstallments.map((inst: any) => (
                                            <tr key={inst.id ?? `${inst.installment_number}-${inst.paid_at}`}>
                                              <td className="px-3 py-2">{inst.installment_number ?? "—"}</td>
                                              <td className="px-3 py-2 font-medium">{formatCurrency(inst.amount)}</td>
                                              <td className="px-3 py-2 text-gray-700">
                                                {inst.paid_at ? formatDate(inst.paid_at) : "—"}
                                              </td>
                                              <td className="px-3 py-2">
                                                <span className="font-medium text-gray-900">
                                                  {inst.paid_by_display ||
                                                    inst.transaction?.payer_name ||
                                                    customerName}
                                                </span>
                                                {inst.transaction?.payer_email && (
                                                  <span className="block text-xs text-gray-500">{inst.transaction.payer_email}</span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-gray-700">
                                                {inst.transaction?.method || "—"}
                                                {inst.transaction?.tx_id && (
                                                  <span className="block text-xs text-gray-500 truncate max-w-[140px]" title={inst.transaction.tx_id}>
                                                    {inst.transaction.tx_id}
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                                {history.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Repayment log</h4>
                                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-left text-gray-600">
                                          <tr>
                                            <th className="px-3 py-2 font-medium">Amount</th>
                                            <th className="px-3 py-2 font-medium">Status</th>
                                            <th className="px-3 py-2 font-medium">When</th>
                                            <th className="px-3 py-2 font-medium">Recorded payer</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {history.map((h: any) => (
                                            <tr key={h.id}>
                                              <td className="px-3 py-2 font-medium">{formatCurrency(h.amount)}</td>
                                              <td className="px-3 py-2 capitalize">{h.status || "—"}</td>
                                              <td className="px-3 py-2 text-gray-700">{h.created_at ? formatDate(h.created_at) : "—"}</td>
                                              <td className="px-3 py-2">
                                                <span className="font-medium text-gray-900">{h.payer_name || customerName}</span>
                                                {h.payer_email && (
                                                  <span className="block text-xs text-gray-500">{h.payer_email}</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Repayment schedule</h3>
                            <p className="text-sm text-gray-600 mb-4">
                              Full installment plan for this order (same data customers see on the dashboard).
                            </p>
                            {schedule.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">
                                No installments found. The schedule may appear after the loan is activated and installments are generated.
                              </p>
                            ) : (
                              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-gray-50 text-left text-gray-600">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">#</th>
                                      <th className="px-3 py-2 font-medium">Due date</th>
                                      <th className="px-3 py-2 font-medium">Amount</th>
                                      <th className="px-3 py-2 font-medium">Status</th>
                                      <th className="px-3 py-2 font-medium">Paid at</th>
                                      <th className="px-3 py-2 font-medium">Payer (if paid)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {schedule.map((inst: any) => {
                                      const st = inst.computed_status || inst.status;
                                      const isPaid = inst.status === "paid" || st === "paid";
                                      return (
                                        <tr key={inst.id ?? `${inst.installment_number}-${inst.payment_date}`}>
                                          <td className="px-3 py-2">{inst.installment_number ?? "—"}</td>
                                          <td className="px-3 py-2">{inst.payment_date ? formatDate(inst.payment_date) : "—"}</td>
                                          <td className="px-3 py-2 font-medium">{formatCurrency(inst.amount)}</td>
                                          <td className="px-3 py-2">
                                            <span
                                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                                isPaid
                                                  ? "bg-green-100 text-green-800"
                                                  : inst.is_overdue || st === "overdue"
                                                    ? "bg-red-100 text-red-800"
                                                    : "bg-amber-100 text-amber-800"
                                              }`}
                                            >
                                              {String(st || "pending").replace(/_/g, " ")}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-gray-700">
                                            {inst.paid_at ? formatDate(inst.paid_at) : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-gray-800">
                                            {isPaid
                                              ? inst.paid_by_display || inst.transaction?.payer_name || customerName
                                              : "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : activeTab === "BNPL Applications" ? (
                  <>
                    {/* Application Overview */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Application Overview</h3>
                        <span
                          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full"
                          style={getStatusColor(selectedItem.status)}
                        >
                          {selectedItem.status || "N/A"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Application ID</p>
                          <p className="text-sm font-semibold text-gray-900">#{selectedItem.id || "N/A"}</p>
                        </div>
                        {selectedItem.loan_amount && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
                            <p className="text-sm font-semibold text-[#273E8E]">
                              {formatCurrency(selectedItem.loan_amount)}
                            </p>
                          </div>
                        )}
                        {selectedItem.repayment_duration && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Repayment Duration</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {selectedItem.repayment_duration} months
                            </p>
                          </div>
                        )}
                        {selectedItem.created_at && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Application Date</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(selectedItem.created_at)}
                            </p>
                          </div>
                        )}
                        {selectedItem.prior_application_id && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Re-application</p>
                            <p className="text-sm font-semibold text-amber-700">
                              Yes — from Application #{selectedItem.prior_application_id}
                            </p>
                          </div>
                        )}
                        {getRequestedServiceDate(selectedItem) && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              {getRequestedServiceDateLabel(selectedItem)}
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(getRequestedServiceDate(selectedItem))}
                            </p>
                          </div>
                        )}
                      </div>
                      {(() => {
                        const orderLabel = bnplApplicationOrderSummary(selectedItem as Record<string, unknown>);
                        if (!orderLabel) return null;
                        return (
                          <div className="mt-4 pt-4 border-t border-blue-200">
                            <p className="text-xs text-gray-500 mb-1">Bundle / product ordered</p>
                            <p className="text-sm font-semibold text-gray-900">{orderLabel}</p>
                          </div>
                        );
                      })()}
                      {selectedItem.user?.id && (
                        <div className="mt-4 pt-4 border-t border-blue-200">
                          <Link
                            to={`/user-activity/${selectedItem.user.id}/loans`}
                            className="text-sm font-medium text-[#273E8E] hover:underline"
                          >
                            View customer profile &amp; all applications →
                          </Link>
                        </div>
                      )}
                    </div>

                    {detailUserId && siblingApplications.length > 1 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                          All applications for this customer
                        </h3>
                        <div className="space-y-2">
                          {siblingApplications.map((app: any) => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => openApplicationDetail(app.id)}
                              className={`w-full text-left flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm transition-colors ${
                                app.id === selectedItem.id
                                  ? "border-[#273E8E] bg-indigo-50"
                                  : "border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              <span className="font-medium text-gray-900">
                                Application #{app.id}
                                {app.id === selectedItem.id ? " (current)" : ""}
                              </span>
                              <span className="capitalize text-gray-600">{app.status || "—"}</span>
                              <span className="text-gray-500">{formatDate(app.created_at)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedItem.loan_plan_snapshot &&
                      typeof selectedItem.loan_plan_snapshot === "object" &&
                      (() => {
                        const snap = selectedItem.loan_plan_snapshot as Record<string, unknown>;
                        const ld = snap;
                        const loanCalc = selectedItem.mono as Record<string, unknown> | null | undefined;
                        const loanApp = selectedItem;
                        const DEFAULT_BNPL_INTEREST_RATE_PERCENT = 4;

                        const parseAmount = (amount: unknown): number => {
                          if (amount == null || amount === "") return 0;
                          if (typeof amount === "number" && Number.isFinite(amount)) return amount;
                          const n = parseFloat(String(amount).replace(/,/g, ""));
                          return Number.isFinite(n) ? n : 0;
                        };
                        const toNum = (v: unknown): number | null => {
                          if (v === null || v === undefined || v === "") return null;
                          const n = parseAmount(v);
                          return Number.isFinite(n) ? n : null;
                        };
                        const pickNum = (...vals: unknown[]): number => {
                          for (const v of vals) {
                            const n = toNum(v);
                            if (n !== null) return n;
                          }
                          return 0;
                        };
                        const parseInterestRate = (v: unknown): number | null => {
                          if (v === null || v === undefined || v === "") return null;
                          const n = parseFloat(String(v).replace(/,/g, ""));
                          return Number.isFinite(n) ? n : null;
                        };

                        const statusLower = String(selectedItem?.status ?? selectedItem?.order_status ?? "").toLowerCase();
                        const isCounterOfferAccepted = statusLower === "counter_offer_accepted";
                        const acceptedMinDeposit = pickNum(
                          selectedItem?.counter_offer_min_deposit,
                          (selectedItem as Record<string, unknown>)?.counter_offer_details &&
                            (selectedItem as Record<string, unknown>).counter_offer_details &&
                            ((selectedItem as Record<string, unknown>).counter_offer_details as Record<string, unknown>)
                              .down_payment
                        );
                        const acceptedMinTenor = pickNum(
                          selectedItem?.counter_offer_min_tenor,
                          (selectedItem as Record<string, unknown>)?.counter_offer_details &&
                            (selectedItem as Record<string, unknown>).counter_offer_details &&
                            ((selectedItem as Record<string, unknown>).counter_offer_details as Record<string, unknown>)
                              .repayment_duration
                        );
                        const feePcts = bnplFeePctsForCounter(ld);
                        const iPct = feePcts.insurance / 100;
                        const mPct = feePcts.management / 100;
                        const lPct = feePcts.legal / 100;
                        const totalAmount = pickNum(ld.totalAmount, loanCalc?.total_amount);
                        const adminFeesTotal = pickNum(
                          ld.adminFeesTotal,
                          pickNum(ld.insuranceFee, 0) +
                            pickNum(ld.managementFee, 0) +
                            pickNum(ld.legalFee, 0)
                        );
                        const initialDepositWithFees = isCounterOfferAccepted && acceptedMinDeposit > 0
                          ? acceptedMinDeposit
                          : pickNum(ld.depositAmount, loanCalc?.down_payment);
                        const baseDepositFromSnap = pickNum(ld.baseDepositAmount);
                        const bundlePriceApprox =
                          pickNum(ld.principal, ld.totalLoanAmount) > 0 && baseDepositFromSnap >= 0
                            ? Math.max(pickNum(ld.principal, ld.totalLoanAmount) + baseDepositFromSnap, 0)
                            : totalAmount > 0 && adminFeesTotal >= 0
                              ? Math.max(totalAmount - adminFeesTotal, 0)
                              : 0;

                        let explicitLoanAmount = pickNum(
                          ld.totalLoanAmount,
                          ld.principal,
                          loanCalc?.principal_amount
                        );
                        const monoLoanAmt = pickNum(loanCalc?.loan_amount);
                        const monoTotalAmt = pickNum(loanCalc?.total_amount);
                        if (explicitLoanAmount <= 0 && monoLoanAmt > 0) {
                          const looksLikeDuplicatePrincipal =
                            monoTotalAmt > 0 && Math.abs(monoLoanAmt - monoTotalAmt) < 1;
                          const tr = pickNum(ld.totalRepaymentAmount, ld.totalRepayment);
                          const looksLikeTotalRepayment =
                            tr > 0 && Math.abs(monoLoanAmt - tr) < 1;
                          if (!looksLikeDuplicatePrincipal && !looksLikeTotalRepayment) {
                            explicitLoanAmount = monoLoanAmt;
                          }
                        }
                        let totalLoanAmount =
                          explicitLoanAmount > 0
                            ? explicitLoanAmount
                            : Math.max(totalAmount - initialDepositWithFees, 0);

                        const depositPercentRaw = pickNum(ld.depositPercent);
                        let depositPercentForLabel = depositPercentRaw;
                        if (!depositPercentForLabel || depositPercentForLabel <= 0) {
                          const baseDep = pickNum(ld.baseDepositAmount);
                          if (baseDep > 0 && bundlePriceApprox > 0) {
                            depositPercentForLabel = Math.round((baseDep / bundlePriceApprox) * 100);
                          } else if (initialDepositWithFees > 0 && bundlePriceApprox > 0) {
                            const baseOnly = Math.max(initialDepositWithFees - adminFeesTotal, 0);
                            if (baseOnly > 0) {
                              depositPercentForLabel = Math.round((baseOnly / bundlePriceApprox) * 100);
                            }
                          }
                        }
                        const interestRatePercent =
                          parseInterestRate(ld.interestRate) ??
                          parseInterestRate(ld.interest_rate) ??
                          parseInterestRate(loanCalc?.interest_rate) ??
                          DEFAULT_BNPL_INTEREST_RATE_PERCENT;
                        const tenor =
                          Number(
                            (isCounterOfferAccepted && acceptedMinTenor > 0 ? acceptedMinTenor : null) ??
                              ld.tenor ??
                              loanApp?.repayment_duration ??
                              loanCalc?.repayment_duration ??
                              loanCalc?.tenor ??
                              12
                          ) || 12;
                        const totalInterestFromApi = pickNum(
                          ld.totalInterestAmount,
                          ld.totalInterest,
                          loanCalc?.total_interest_amount
                        );
                        let totalInterestAmount =
                          totalInterestFromApi > 0
                            ? totalInterestFromApi
                            : (interestRatePercent / 100) * totalLoanAmount * tenor;
                        let totalRepaymentAmount =
                          pickNum(ld.totalRepaymentAmount, ld.totalRepayment, loanCalc?.total_repayment) ||
                          totalLoanAmount + totalInterestAmount;
                        let monthlyRepaymentAmount =
                          pickNum(
                            ld.monthlyRepaymentAmount,
                            ld.monthlyRepayment,
                            loanCalc?.monthly_repayment,
                            loanCalc?.monthly_payment
                          ) || (tenor > 0 ? totalRepaymentAmount / tenor : 0);

                        if (isCounterOfferAccepted && acceptedMinDeposit > 0 && bundlePriceApprox > 0) {
                          const denom = 1 - mPct - lPct;
                          const baseDeposit =
                            denom > 0.0001
                              ? Math.max((acceptedMinDeposit - bundlePriceApprox * (iPct + mPct + lPct)) / denom, 0)
                              : 0;
                          const baseLoanAmount = Math.max(bundlePriceApprox - baseDeposit, 0);
                          totalLoanAmount = baseLoanAmount;
                          totalInterestAmount = (interestRatePercent / 100) * baseLoanAmount * tenor;
                          totalRepaymentAmount = baseLoanAmount + totalInterestAmount;
                          monthlyRepaymentAmount = tenor > 0 ? totalRepaymentAmount / tenor : 0;
                          depositPercentForLabel =
                            bundlePriceApprox > 0 ? Math.round((baseDeposit / bundlePriceApprox) * 100) : depositPercentForLabel;
                        }
                        const depositLabelPct =
                          depositPercentForLabel > 0 ? `${depositPercentForLabel}%` : "—";

                        const summaryRows: {
                          num: number;
                          label: string;
                          value: number;
                          bold: boolean;
                        }[] = [
                          {
                            num: 1,
                            label: `Initial Deposit (${depositLabelPct}) + Total Administrative Fees`,
                            value: initialDepositWithFees,
                            bold: true,
                          },
                          {
                            num: 2,
                            label: "Total Loan Amount",
                            value: totalLoanAmount,
                            bold: false,
                          },
                          {
                            num: 3,
                            label: `Total Interest Amount (${interestRatePercent}% × ${tenor} mo)`,
                            value: totalInterestAmount,
                            bold: false,
                          },
                          {
                            num: 4,
                            label: "Total Repayment Amount",
                            value: totalRepaymentAmount,
                            bold: false,
                          },
                          {
                            num: 5,
                            label: "Monthly Repayment Amount",
                            value: monthlyRepaymentAmount,
                            bold: true,
                          },
                        ];

                        return (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-200 p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="text-[#273E8E] text-2xl font-bold" aria-hidden="true">
                                ₦
                              </span>
                              <h3 className="text-xl font-semibold text-gray-800">Loan Summary</h3>
                            </div>
                            <div className="space-y-3">
                              {summaryRows.map((row) => (
                                <div
                                  key={row.num}
                                  className="bg-white rounded-lg p-4 border border-green-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                                >
                                  <p
                                    className={`text-sm text-gray-800 ${
                                      row.bold ? "font-bold" : "font-medium"
                                    }`}
                                  >
                                    {row.num}. {row.label}
                                  </p>
                                  <p
                                    className={`text-xl tabular-nums ${
                                      row.num === 5
                                        ? "font-bold text-[#273E8E]"
                                        : row.bold
                                          ? "font-bold text-gray-800"
                                          : "font-medium text-gray-800"
                                    }`}
                                  >
                                    {formatCurrencyLoanSummary(row.value)}
                                  </p>
                                </div>
                              ))}
                              <div className="border-t border-green-200 pt-3 mt-1">
                                <div className="bg-white rounded-lg p-4 border border-green-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                  <p className="text-sm font-medium text-gray-800">6. Loan Tenor</p>
                                  <p className="text-xl font-bold text-[#273E8E]">
                                    {tenor} {tenor === 1 ? "month" : "months"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {/* {showAdminFees && (
                              <div className="mt-4 bg-white rounded-lg p-4 border border-green-100">
                                <h4 className="text-sm font-semibold text-gray-800 mb-2">
                                  Administrative Fees
                                </h4>
                                <p className="text-xs text-gray-600 mb-3">
                                  Insurance is calculated on the bundle price only. Management and legal fees
                                  are calculated on the loan amount.
                                </p>
                                <div className="space-y-2 text-sm">
                                  {snap.insuranceFee != null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-700">1. Insurance Fee</span>
                                      <span className="font-medium">
                                        {formatCurrencyLoanSummary(snap.insuranceFee as number)}
                                      </span>
                                    </div>
                                  )}
                                  {snap.managementFee != null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-700">2. Management Fee</span>
                                      <span className="font-medium">
                                        {formatCurrencyLoanSummary(snap.managementFee as number)}
                                      </span>
                                    </div>
                                  )}
                                  {snap.legalFee != null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-700">3. Legal Fee</span>
                                      <span className="font-medium">
                                        {formatCurrencyLoanSummary(snap.legalFee as number)}
                                      </span>
                                    </div>
                                  )}
                                  {snap.adminFeesTotal != null && (
                                    <div className="flex justify-between font-semibold border-t border-green-100 pt-2 mt-2">
                                      <span>Total Administrative Fees</span>
                                      <span>{formatCurrencyLoanSummary(snap.adminFeesTotal as number)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )} */}
                          </div>
                        );
                      })()}

                    {/* Final Application — same field order as customer BNPL flow (Personal + credit step) */}
                    {selectedItem.user &&
                      (() => {
                        const u = selectedItem.user as {
                          id?: number;
                          first_name?: string;
                          sur_name?: string;
                          email?: string;
                          phone?: string;
                          bvn?: string | null;
                        };
                        const snapP = bnplFinalApplicationPersonalFromSnapshot(selectedItem.loan_plan_snapshot);
                        const nameLine =
                          snapP?.full_name ||
                          [u.first_name, u.sur_name].filter(Boolean).join(" ").trim() ||
                          null;
                        const bvnLine = snapP?.bvn || bnplDisplayBvn(selectedItem, u) || null;
                        const phoneLine = snapP?.phone || u.phone || null;
                        const emailLine = snapP?.email || u.email || null;
                        const socialLine =
                          snapP?.social_media ||
                          (selectedItem.social_media_handle != null
                            ? String(selectedItem.social_media_handle).trim()
                            : null) ||
                          null;
                        return (
                          <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                              <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Final application
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">
                              Personal and property details as collected in the BNPL flow (snapshot + profile fallbacks when older applications have no stored form copy).
                            </p>

                            <h4 className="text-sm font-semibold text-gray-800 mb-3">Personal details</h4>
                            <p className="text-xs text-gray-500 mb-3">
                              Full name, BVN, phone, email, and social handle — same labels as the customer &quot;Final Application&quot; step.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Full name</p>
                                <p className="text-sm font-medium text-gray-900">{bnplDash(nameLine)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">BVN</p>
                                <p className="text-sm font-medium text-gray-900 font-mono tracking-wide">{bnplDash(bvnLine)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Phone number</p>
                                <p className="text-sm font-medium text-gray-900">{bnplDash(phoneLine)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Email address</p>
                                <p className="text-sm font-medium text-gray-900 break-all">{bnplDash(emailLine)}</p>
                              </div>
                              <div className="md:col-span-2">
                                <p className="text-xs text-gray-500 mb-1">Social media handle</p>
                                <p className="text-sm font-medium text-gray-900">{bnplDash(socialLine)}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Required for verification on the customer flow (e.g. @username or facebook.com/username).
                                </p>
                              </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100">
                              <h4 className="text-sm font-semibold text-gray-800 mb-3">Credit check</h4>
                              <p className="text-xs text-gray-500 mb-2">After personal details, the customer continues to credit check with this method.</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Credit check method</p>
                                  <p className="text-sm font-medium text-gray-900 capitalize">
                                    {bnplDash(
                                      selectedItem.credit_check_method != null
                                        ? String(selectedItem.credit_check_method)
                                        : null
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">User ID (account)</p>
                                  {u.id != null ? (
                                    <Link
                                      to={`/user-activity/${u.id}/loans`}
                                      className="text-sm font-medium text-[#273E8E] hover:underline"
                                    >
                                      View profile #{u.id}
                                    </Link>
                                  ) : (
                                    <p className="text-sm font-medium text-gray-900">—</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {u.id != null && (
                              <div className="mt-6 pt-4 border-t border-gray-100">
                                <MonoApplicationTools
                                  token={token || ""}
                                  userId={u.id}
                                  userName={nameLine || "Customer"}
                                  application={{
                                    credit_check_method: selectedItem.credit_check_method,
                                    mono_credit_status: selectedItem.mono_credit_status,
                                    mono_can_afford: selectedItem.mono_can_afford,
                                    mono_monthly_payment_kobo: selectedItem.mono_monthly_payment_kobo,
                                    mono_credit_report: selectedItem.mono_credit_report,
                                    mono_account_id: selectedItem.mono_account_id,
                                    loan_amount: selectedItem.loan_amount,
                                    repayment_duration: selectedItem.repayment_duration,
                                  }}
                                  onCreditCheckStarted={() => {
                                    if (selectedItem?.id) {
                                      openApplicationDetail(selectedItem.id);
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    {/* Property details — same labels/order as customer BNPL “Final Application” form */}
                    {selectedItem && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          Property details
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                          State, address, current power sources, floors, rooms, and gated estate — matching the customer flow (estate name/address required when gated).
                        </p>
                        <div className="space-y-2 text-sm text-gray-900">
                          <p>
                            <span className="font-semibold text-gray-700">State:</span>{" "}
                            {bnplDash(selectedItem.property_state != null ? String(selectedItem.property_state) : null)}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-700">Address:</span>{" "}
                            <span className="whitespace-pre-wrap">
                              {bnplDash(selectedItem.property_address != null ? String(selectedItem.property_address) : null)}
                            </span>
                          </p>
                          <p>
                            <span className="font-semibold text-gray-700">Current Power Sources:</span>{" "}
                            {bnplDash(selectedItem.property_landmark != null ? String(selectedItem.property_landmark) : null)}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-700">Floors:</span>{" "}
                            {selectedItem.property_floors != null && selectedItem.property_floors !== ""
                              ? String(selectedItem.property_floors)
                              : "—"}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-700">Rooms:</span>{" "}
                            {selectedItem.property_rooms != null && selectedItem.property_rooms !== ""
                              ? String(selectedItem.property_rooms)
                              : "—"}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-700">Gated Estate:</span>{" "}
                            {bnplGatedEstateLabel(selectedItem.is_gated_estate)}
                          </p>
                          {selectedItem.is_gated_estate ? (
                            <>
                              <p>
                                <span className="font-semibold text-gray-700">Estate name:</span>{" "}
                                <span className="whitespace-pre-wrap">
                                  {bnplLoanAppEstateText(selectedItem as Record<string, unknown>, "name")}
                                </span>
                              </p>
                              <p>
                                <span className="font-semibold text-gray-700">Estate address:</span>{" "}
                                <span className="whitespace-pre-wrap">
                                  {bnplLoanAppEstateText(selectedItem as Record<string, unknown>, "address")}
                                </span>
                              </p>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* Assign / Update Beneficiary (like loan flow) */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Assign / Update Beneficiary
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Assign email and contact for this application (e.g. for sending offer).</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Beneficiary Email</label>
                          <input
                            type="email"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="email@example.com"
                            value={beneficiaryForm.beneficiary_email}
                            onChange={(e) => setBeneficiaryForm((f) => ({ ...f, beneficiary_email: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Beneficiary Name</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Full name"
                            value={beneficiaryForm.beneficiary_name}
                            onChange={(e) => setBeneficiaryForm((f) => ({ ...f, beneficiary_name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Beneficiary Phone</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Phone"
                            value={beneficiaryForm.beneficiary_phone}
                            onChange={(e) => setBeneficiaryForm((f) => ({ ...f, beneficiary_phone: e.target.value }))}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={savingBeneficiary}
                        onClick={async () => {
                          if (!selectedItem?.id) return;
                          setSavingBeneficiary(true);
                          try {
                            await updateBNPLApplication(selectedItem.id, {
                              beneficiary_email: beneficiaryForm.beneficiary_email || undefined,
                              beneficiary_name: beneficiaryForm.beneficiary_name || undefined,
                              beneficiary_phone: beneficiaryForm.beneficiary_phone || undefined,
                            }, token);
                            queryClient.invalidateQueries({ queryKey: ["bnpl-applications"] });
                            const fresh = await getBNPLApplication(selectedItem.id, token);
                            setSelectedItem(fresh.data);
                            alert("Beneficiary updated successfully.");
                          } catch (err: any) {
                            alert(err?.message || "Failed to update beneficiary");
                          } finally {
                            setSavingBeneficiary(false);
                          }
                        }}
                        className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {savingBeneficiary ? "Saving..." : "Save Beneficiary"}
                      </button>
                    </div>

                    {/* Adjust Loan Offer (change amount, down payment, tenor) – all amounts in Naira (₦) */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Adjust Loan Offer (₦)
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Change loan amount, initial deposit, or repayment duration before approving or sending counter offer. All amounts are in Nigerian Naira (₦).</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Loan Amount (₦)</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="e.g. 5000000"
                            value={offerForm.loan_amount}
                            onChange={(e) => setOfferForm((f) => ({ ...f, loan_amount: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Down Payment (₦)</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="e.g. 1500000"
                            value={offerForm.down_payment}
                            onChange={(e) => setOfferForm((f) => ({ ...f, down_payment: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Repayment Duration (months)</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={offerForm.repayment_duration}
                            onChange={(e) => setOfferForm((f) => ({ ...f, repayment_duration: e.target.value }))}
                          >
                            <option value="">Select</option>
                            {allowedDurations.map((m) => (
                              <option key={m} value={m}>{m} months</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Interest rate (%)</label>
                          <input type="number" step="0.01" min="0" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Default from settings" value={offerForm.interest_rate} onChange={(e) => setOfferForm((f) => ({ ...f, interest_rate: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Management fee (%)</label>
                          <input type="number" step="0.01" min="0" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Default" value={offerForm.management_fee_percentage} onChange={(e) => setOfferForm((f) => ({ ...f, management_fee_percentage: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Legal fee (%)</label>
                          <input type="number" step="0.01" min="0" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Default" value={offerForm.legal_fee_percentage} onChange={(e) => setOfferForm((f) => ({ ...f, legal_fee_percentage: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Insurance fee (%)</label>
                          <input type="number" step="0.01" min="0" max="100" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Default" value={offerForm.insurance_fee_percentage} onChange={(e) => setOfferForm((f) => ({ ...f, insurance_fee_percentage: e.target.value }))} />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={savingOffer}
                        onClick={async () => {
                          if (!selectedItem?.id) return;
                          setSavingOffer(true);
                          try {
                            await updateBNPLLoanOffer(selectedItem.id, {
                              loan_amount: offerForm.loan_amount ? Number(offerForm.loan_amount) : undefined,
                              down_payment: offerForm.down_payment ? Number(offerForm.down_payment) : undefined,
                              repayment_duration: offerForm.repayment_duration ? Number(offerForm.repayment_duration) : undefined,
                              interest_rate: offerForm.interest_rate ? Number(offerForm.interest_rate) : undefined,
                              management_fee_percentage: offerForm.management_fee_percentage ? Number(offerForm.management_fee_percentage) : undefined,
                              legal_fee_percentage: offerForm.legal_fee_percentage ? Number(offerForm.legal_fee_percentage) : undefined,
                              insurance_fee_percentage: offerForm.insurance_fee_percentage ? Number(offerForm.insurance_fee_percentage) : undefined,
                            }, token);
                            queryClient.invalidateQueries({ queryKey: ["bnpl-applications"] });
                            const fresh = await getBNPLApplication(selectedItem.id, token);
                            const mono = fresh.data?.mono;
                            setSelectedItem(fresh.data);
                            setOfferForm({
                              loan_amount: mono?.loan_amount ?? fresh.data?.loan_amount ?? "",
                              down_payment: mono?.down_payment ?? "",
                              repayment_duration: mono?.repayment_duration ?? fresh.data?.repayment_duration ?? "",
                              interest_rate: mono?.interest_rate ?? "",
                              management_fee_percentage: mono?.management_fee_percentage ?? "",
                              legal_fee_percentage: mono?.legal_fee_percentage ?? "",
                              insurance_fee_percentage: mono?.insurance_fee_percentage ?? "",
                            });
                            alert("Loan offer updated successfully.");
                          } catch (err: any) {
                            alert(err?.response?.data?.message || err?.message || "Failed to update loan offer");
                          } finally {
                            setSavingOffer(false);
                          }
                        }}
                        className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {savingOffer ? "Saving..." : "Save Loan Offer"}
                      </button>
                    </div>

                    {/* Guarantor – admin adds guarantor data; user only downloads/uploads form */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Guarantor
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Add guarantor details for this application. The user will only see the option to download the guarantor form and upload the signed copy—they cannot add guarantor details.</p>
                      {/* Customer's signed guarantor form – section when uploaded */}
                      {selectedItem?.guarantor?.signed_form_path && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <h4 className="text-sm font-semibold text-green-800 mb-2">Customer&apos;s signed guarantor form</h4>
                          <p className="text-xs text-green-700 mb-3">The customer has uploaded the signed guarantor form. You can view or download it below.</p>
                          <a
                            href={selectedItem.guarantor.signed_form_path.startsWith("http") ? selectedItem.guarantor.signed_form_path : `${DOCUMENT_BASE_URL}/${selectedItem.guarantor.signed_form_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-[#273E8E] hover:underline"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View / Download signed guarantor form
                          </a>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Full name</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Guarantor full name"
                            value={guarantorForm.full_name}
                            onChange={(e) => setGuarantorForm((f) => ({ ...f, full_name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Phone</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Phone"
                            value={guarantorForm.phone}
                            onChange={(e) => setGuarantorForm((f) => ({ ...f, phone: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Email (optional)</label>
                          <input
                            type="email"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="email@example.com"
                            value={guarantorForm.email}
                            onChange={(e) => setGuarantorForm((f) => ({ ...f, email: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Relationship (optional)</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="e.g. Spouse, Colleague"
                            value={guarantorForm.relationship}
                            onChange={(e) => setGuarantorForm((f) => ({ ...f, relationship: e.target.value }))}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={savingGuarantor || !guarantorForm.full_name.trim() || !guarantorForm.phone.trim()}
                        onClick={async () => {
                          if (!selectedItem?.id) return;
                          setSavingGuarantor(true);
                          try {
                            await setBNPLApplicationGuarantor(selectedItem.id, {
                              full_name: guarantorForm.full_name.trim(),
                              phone: guarantorForm.phone.trim(),
                              email: guarantorForm.email?.trim() || undefined,
                              relationship: guarantorForm.relationship?.trim() || undefined,
                            }, token);
                            queryClient.invalidateQueries({ queryKey: ["bnpl-applications"] });
                            const fresh = await getBNPLApplication(selectedItem.id, token);
                            setSelectedItem(fresh.data);
                            setGuarantorForm({
                              full_name: fresh.data?.guarantor?.full_name || "",
                              phone: fresh.data?.guarantor?.phone || "",
                              email: fresh.data?.guarantor?.email || "",
                              relationship: fresh.data?.guarantor?.relationship || "",
                            });
                            alert("Guarantor saved. User can download the form and upload the signed copy.");
                          } catch (err: any) {
                            alert(err?.message || "Failed to save guarantor");
                          } finally {
                            setSavingGuarantor(false);
                          }
                        }}
                        className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {savingGuarantor ? "Saving..." : "Save Guarantor"}
                      </button>
                    </div>

                    {/* Installation Date – accept or reject customer's requested date */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Installation Date
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Customer can book an installation date after down payment. Accept or reject the requested date here. If rejected, they will be notified and can book another date.</p>
                      {selectedItem?.installation_requested_date ? (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Requested date:</span> {selectedItem.installation_requested_date}
                          </p>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Status:</span>{" "}
                            <span className={selectedItem.installation_booking_status === "accepted" ? "text-green-600" : selectedItem.installation_booking_status === "rejected" ? "text-red-600" : "text-amber-600"}>
                              {selectedItem.installation_booking_status || "pending"}
                            </span>
                          </p>
                          {selectedItem.installation_booking_status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={savingInstallationAccept || savingInstallationReject}
                                onClick={async () => {
                                  if (!selectedItem?.id || !token) return;
                                  setSavingInstallationAccept(true);
                                  try {
                                    await acceptBNPLInstallationDate(selectedItem.id, token);
                                    queryClient.invalidateQueries({ queryKey: ["bnpl-applications"] });
                                    const fresh = await getBNPLApplication(selectedItem.id, token);
                                    setSelectedItem(fresh.data);
                                    alert("Installation date accepted.");
                                  } catch (err: any) {
                                    alert(err?.response?.data?.message || err?.message || "Failed to accept");
                                  } finally {
                                    setSavingInstallationAccept(false);
                                  }
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                              >
                                {savingInstallationAccept ? "Accepting..." : "Accept"}
                              </button>
                              <button
                                type="button"
                                disabled={savingInstallationAccept || savingInstallationReject}
                                onClick={async () => {
                                  if (!selectedItem?.id || !token) return;
                                  setSavingInstallationReject(true);
                                  try {
                                    await rejectBNPLInstallationDate(selectedItem.id, token);
                                    queryClient.invalidateQueries({ queryKey: ["bnpl-applications"] });
                                    const fresh = await getBNPLApplication(selectedItem.id, token);
                                    setSelectedItem(fresh.data);
                                    alert("Installation date rejected. Customer has been notified to book another date.");
                                  } catch (err: any) {
                                    alert(err?.response?.data?.message || err?.message || "Failed to reject");
                                  } finally {
                                    setSavingInstallationReject(false);
                                  }
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                              >
                                {savingInstallationReject ? "Rejecting..." : "Reject"}
                              </button>
                            </div>
                          )}
                          {Array.isArray(selectedItem.installation_rejected_dates) && selectedItem.installation_rejected_dates.length > 0 && (
                            <p className="text-xs text-gray-500">Rejected dates (customer cannot re-select): {selectedItem.installation_rejected_dates.join(", ")}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No installation date requested yet. Customer will see &quot;Book Installation Date&quot; after down payment.</p>
                      )}
                    </div>

                    {/* Send to Partner (before approving - like loan flow) */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send to Partner
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">You can send application details to a financing partner before approving. The user will receive notification once you approve.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPartnerIdForSend("");
                          setShowSendToPartnerModal(true);
                        }}
                        className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send details to partner (Email)
                      </button>
                    </div>

                    {/* Loan Details */}
                    {/* <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Loan Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedItem.loan_amount && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
                            <p className="text-lg font-bold text-[#273E8E]">
                              {formatCurrency(selectedItem.loan_amount)}
                            </p>
                          </div>
                        )}
                        {selectedItem.repayment_duration && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Repayment Duration</p>
                            <p className="text-lg font-bold text-gray-900">
                              {selectedItem.repayment_duration} months
                            </p>
                          </div>
                        )}
                        {selectedItem.monthly_payment && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Monthly Payment</p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(selectedItem.monthly_payment)}
                            </p>
                          </div>
                        )}
                        {selectedItem.interest_rate && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Interest Rate</p>
                            <p className="text-lg font-bold text-gray-900">
                              {selectedItem.interest_rate}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div> */}

                    {/* Beneficiary Information */}
                    {(selectedItem.beneficiary_name || selectedItem.beneficiary_email || selectedItem.beneficiary_phone || selectedItem.beneficiary_relationship) && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Beneficiary Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedItem.beneficiary_name && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Beneficiary Name</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.beneficiary_name}
                              </p>
                            </div>
                          )}
                          {selectedItem.beneficiary_email && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Beneficiary Email</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.beneficiary_email}
                              </p>
                            </div>
                          )}
                          {selectedItem.beneficiary_phone && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Beneficiary Phone</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.beneficiary_phone}
                              </p>
                            </div>
                          )}
                          {selectedItem.beneficiary_relationship && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Relationship</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.beneficiary_relationship}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Manual credit check documents (Mono auto uses Mono bank tools above) */}
                    {String(selectedItem.credit_check_method || "").toLowerCase() !== "auto" &&
                    (selectedItem.title_document ||
                      selectedItem.upload_document ||
                      selectedItem.bank_statement_path ||
                      selectedItem.live_photo_path) && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Uploaded documents
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedItem.title_document && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Title Document</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedItem.title_document}
                            </p>
                          </div>
                        )}
                        {selectedItem.upload_document && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Uploaded Document</p>
                            {typeof selectedItem.upload_document === "string" && (
                              selectedItem.upload_document.startsWith("http") ? (
                                <a
                                  href={selectedItem.upload_document}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-[#273E8E] hover:underline flex items-center"
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  View Document
                                </a>
                              ) : (
                                <a
                                  href={`${DOCUMENT_BASE_URL}/${selectedItem.upload_document}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-[#273E8E] hover:underline flex items-center"
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  View Document
                                </a>
                              )
                            )}
                          </div>
                        )}
                        {selectedItem.bank_statement_path && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Bank Statement</p>
                            <a
                              href={selectedItem.bank_statement_path.startsWith("http") ? selectedItem.bank_statement_path : `${DOCUMENT_BASE_URL}/${selectedItem.bank_statement_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-[#273E8E] hover:underline flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              View Bank Statement
                            </a>
                          </div>
                        )}
                        {selectedItem.live_photo_path && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Live Photo</p>
                            <a
                              href={selectedItem.live_photo_path.startsWith("http") ? selectedItem.live_photo_path : `${DOCUMENT_BASE_URL}/${selectedItem.live_photo_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-[#273E8E] hover:underline flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              View Live Photo
                            </a>
                          </div>
                        )}
                        {(!selectedItem.title_document && !selectedItem.upload_document && !selectedItem.bank_statement_path && !selectedItem.live_photo_path) && (
                          <p className="text-sm text-gray-500 italic md:col-span-2">No manual documents uploaded</p>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Additional Information */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
                      <div className="space-y-3">
                        {Object.entries(selectedItem).map(([key, value]: [string, any]) => {
                          // Skip already displayed fields
                          const skipKeys = [
                            "id", "status", "loan_amount", "repayment_duration", "monthly_payment",
                            "interest_rate", "user", "beneficiary_name", "beneficiary_email",
                            "beneficiary_phone", "beneficiary_relationship", "title_document",
                            "upload_document", "bank_statement_path", "live_photo_path",
                            "created_at", "updated_at", "guarantors", "loan_configuration"
                          ];
                          if (skipKeys.includes(key)) return null;
                          if (bnplSkipAdditionalInfoScalar(key, value)) return null;
                          return (
                            <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {key.replace(/_/g, " ")}:
                              </span>
                              <span className="text-sm text-gray-900">
                                {key === "is_gated_estate"
                                  ? bnplGatedEstateLabel(value)
                                  : key.includes("amount") || key.includes("price") || key.includes("fee")
                                    ? formatCurrency(value)
                                    : String(value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : activeTab === "Audit Requests" ? (
                  <>
                    {/* Audit Request Overview */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Audit Request Overview</h3>
                        <span
                          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full"
                          style={getStatusColor(selectedItem.status)}
                        >
                          {selectedItem.status || "N/A"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Request ID</p>
                          <p className="text-sm font-semibold text-gray-900">#{selectedItem.id || "N/A"}</p>
                        </div>
                        {selectedItem.audit_type && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Audit Type</p>
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                              {selectedItem.audit_type === "home-office" && selectedItem.audit_subtype
                                ? selectedItem.audit_subtype === "office"
                                  ? "Home–Office (Office)"
                                  : "Home–Office (Home)"
                                : String(selectedItem.audit_type).replace("-", "/")}
                            </p>
                          </div>
                        )}
                        {selectedItem.audit_type === "home-office" && selectedItem.audit_subtype && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Audit for</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {selectedItem.audit_subtype === "office" ? "Office" : "Home"}
                            </p>
                          </div>
                        )}
                        {selectedItem.customer_type && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Customer Type</p>
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                              {selectedItem.customer_type}
                            </p>
                          </div>
                        )}
                        {selectedItem.product_category && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Solution</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {labelProductCategory(selectedItem.product_category)}
                            </p>
                          </div>
                        )}
                        {selectedItem.created_at && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Request Date</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(selectedItem.created_at)}
                            </p>
                          </div>
                        )}
                        {(selectedItem.preferred_audit_date || selectedItem.preferred_audit_time) && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Preferred audit schedule</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatAuditPreferredSchedule(selectedItem)}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Request source</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {selectedItem.source === "buy_now"
                              ? "Buy Now"
                              : selectedItem.source === "bnpl"
                                ? "BNPL"
                                : selectedItem.source
                                  ? String(selectedItem.source)
                                  : "Not specified (legacy)"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* User Information */}
                    {selectedItem.user && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Customer Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Full Name</p>
                            <p className="text-sm font-medium text-gray-900">
                              {displayUserFullName(selectedItem.user)}
                            </p>
                          </div>
                          {selectedItem.user.email && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Email</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.user.email}</p>
                            </div>
                          )}
                          {selectedItem.user.phone && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Phone</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.user.phone}</p>
                            </div>
                          )}
                          {selectedItem.user.id && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">User ID</p>
                              <p className="text-sm font-medium text-gray-900">#{selectedItem.user.id}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Property Details */}
                    {(selectedItem.property_address || selectedItem.property_state || selectedItem.contact_name || selectedItem.contact_phone || selectedItem.company_name || selectedItem.facility_description || selectedItem.building_type || selectedItem.property_floors || selectedItem.property_rooms !== undefined || selectedItem.is_gated_estate !== undefined || selectedItem.preferred_audit_date || selectedItem.preferred_audit_time) && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          Property / facility details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedItem.company_name && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 mb-1">Company Name</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.company_name}</p>
                            </div>
                          )}
                          {selectedItem.contact_name && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Contact Name</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.contact_name}
                              </p>
                            </div>
                          )}
                          {selectedItem.contact_phone && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Contact Phone</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.contact_phone}
                              </p>
                            </div>
                          )}
                          {selectedItem.property_address && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 mb-1">Address</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.property_address}
                              </p>
                            </div>
                          )}
                          {selectedItem.property_state && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">State</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.property_state}
                              </p>
                            </div>
                          )}
                          {selectedItem.property_landmark && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Current power sources</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.property_landmark}</p>
                            </div>
                          )}
                          {(selectedItem.preferred_audit_date || selectedItem.preferred_audit_time) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Preferred audit schedule</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatAuditPreferredSchedule(selectedItem)}
                              </p>
                            </div>
                          )}
                          {selectedItem.building_type && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Type of building</p>
                              <p className="text-sm font-medium text-gray-900">{selectedItem.building_type}</p>
                            </div>
                          )}
                          {selectedItem.facility_description && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 mb-1">Description of facility</p>
                              <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                                {selectedItem.facility_description}
                              </p>
                            </div>
                          )}
                          {selectedItem.property_floors !== undefined && selectedItem.property_floors !== null && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Number of Floors</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.property_floors}
                              </p>
                            </div>
                          )}
                          {selectedItem.property_rooms !== undefined && selectedItem.property_rooms !== null && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">
                                {selectedItem.audit_subtype === "office" ? "Number of office spaces" : "Number of Rooms"}
                              </p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.property_rooms}
                              </p>
                            </div>
                          )}
                          {selectedItem.is_gated_estate !== undefined && selectedItem.is_gated_estate !== null && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Gated Estate</p>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedItem.is_gated_estate ? "Yes" : "No"}
                              </p>
                            </div>
                          )}
                          {selectedItem.has_property_details !== undefined && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Property Details Status</p>
                              <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                                selectedItem.has_property_details 
                                  ? "bg-green-100 text-green-800 border border-green-300" 
                                  : "bg-yellow-100 text-yellow-800 border border-yellow-300"
                              }`}>
                                {selectedItem.has_property_details ? "✓ Details Shared" : "⚠️ Needs Details"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Order Information (if linked) */}
                    {selectedItem.order_id && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Linked Order
                        </h3>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Order ID</p>
                          <p className="text-sm font-medium text-gray-900">#{selectedItem.order_id}</p>
                        </div>
                      </div>
                    )}

                    {(selectedItem.status === "approved" &&
                      (selectedItem.approval_payment_date ||
                        selectedItem.approval_payment_time ||
                        selectedItem.approval_payment_amount != null ||
                        selectedItem.approval_payment_account_details)) && (
                      <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-6">
                        <h3 className="text-lg font-semibold text-emerald-900 mb-4">
                          Audit visit details and payment instructions
                        </h3>
                        <p className="text-sm text-emerald-800 mb-4">
                          These are the details sent to the customer when the audit request is approved.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedItem.approval_payment_date && (
                            <div>
                              <p className="text-xs text-emerald-700 mb-1">Audit date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatDate(selectedItem.approval_payment_date)}
                              </p>
                            </div>
                          )}
                          {selectedItem.approval_payment_time && (
                            <div>
                              <p className="text-xs text-emerald-700 mb-1">Audit time</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatAuditPreferredTime(selectedItem.approval_payment_time)}
                              </p>
                            </div>
                          )}
                          {selectedItem.approval_payment_amount != null && (
                            <div>
                              <p className="text-xs text-emerald-700 mb-1">Payment amount</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(selectedItem.approval_payment_amount)}
                              </p>
                            </div>
                          )}
                          {selectedItem.approval_payment_account_details && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-emerald-700 mb-1">Account details</p>
                              <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                                {selectedItem.approval_payment_account_details}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedItem.status === "approved" && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Customer payment received
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Recorded after approval when the customer pays for the audit.
                        </p>
                        {selectedItem.customer_has_paid ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Payment status</p>
                              <p className="text-sm font-medium text-emerald-700">Paid</p>
                            </div>
                            {selectedItem.customer_payment_date && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Payment date</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {formatDate(selectedItem.customer_payment_date)}
                                </p>
                              </div>
                            )}
                            {selectedItem.customer_payment_time && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Payment time</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {formatAuditPreferredTime(selectedItem.customer_payment_time)}
                                </p>
                              </div>
                            )}
                            {auditPaymentReceiptUrl(selectedItem) && (
                              <div className="md:col-span-2">
                                <p className="text-xs text-gray-500 mb-1">Payment receipt</p>
                                <a
                                  href={auditPaymentReceiptUrl(selectedItem) || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-[#273E8E] hover:underline"
                                >
                                  View payment receipt
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-amber-700">
                            Not marked as paid yet. Use Update to record payment date and time.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Additional Information */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
                      <div className="space-y-3">
                        {Object.entries(selectedItem).map(([key, value]: [string, any]) => {
                          // Skip already displayed fields
                          const skipKeys = [
                            "id", "status", "audit_type", "audit_subtype", "customer_type", "product_category", "user", "property_address",
                            "property_state", "property_landmark", "building_type", "facility_description",
                            "property_floors", "property_rooms", "company_name", "is_gated_estate",
                            "contact_name", "contact_phone", "has_property_details", "order_id", "created_at", "updated_at",
                            "preferred_audit_date", "preferred_audit_time", "source",
                            "approval_payment_date", "approval_payment_time", "approval_payment_amount",
                            "approval_payment_account_details", "admin_notes", "approved_at", "approved_by",
                            "customer_has_paid", "customer_payment_date", "customer_payment_time",
                            "customer_payment_receipt_path", "customer_payment_receipt_url",
                          ];
                          if (skipKeys.includes(key)) return null;
                          if (bnplSkipAdditionalInfoScalar(key, value)) return null;
                          return (
                            <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {key.replace(/_/g, " ")}:
                              </span>
                              <span className="text-sm text-gray-900">
                                {key === "is_gated_estate" ? bnplGatedEstateLabel(value) : String(value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  // Generic display for other tabs
                  <div className="space-y-4">
                    {Object.entries(selectedItem).map(([key, value]: [string, any]) => {
                      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        return (
                          <div key={key} className="bg-white rounded-lg border border-gray-200 p-4">
                            <h3 className="font-semibold text-gray-700 capitalize mb-3">
                              {key.replace(/_/g, " ")}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {Object.entries(value).map(([subKey, subValue]: [string, any]) => (
                                <div key={subKey}>
                                  <p className="text-xs text-gray-500 mb-1 capitalize">
                                    {subKey.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {typeof subValue === "object" && subValue !== null
                                      ? JSON.stringify(subValue)
                                      : subValue === null || subValue === "null"
                                      ? "N/A"
                                      : String(subValue)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      if (Array.isArray(value)) {
                        return (
                          <div key={key} className="bg-white rounded-lg border border-gray-200 p-4">
                            <h3 className="font-semibold text-gray-700 capitalize mb-3">
                              {key.replace(/_/g, " ")} ({value.length})
                            </h3>
                            <div className="space-y-2">
                              {value.map((item: any, idx: number) => (
                                <div key={idx} className="bg-gray-50 rounded p-3 border border-gray-200">
                                  {typeof item === "object" ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {Object.entries(item).map(([k, v]: [string, any]) => (
                                        <div key={k}>
                                          <p className="text-xs text-gray-500 mb-1 capitalize">
                                            {k.replace(/_/g, " ")}
                                          </p>
                                          <p className="text-sm font-medium text-gray-900">
                                            {typeof v === "object" ? JSON.stringify(v) : v === null || v === "null" ? "N/A" : String(v)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-900">{String(item)}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      if (value === null || value === "null" || value === "") {
                        return null;
                      }
                      return (
                        <div key={key} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 capitalize">
                              {key.replace(/_/g, " ")}:
                            </span>
                            <span className="text-sm text-gray-900">
                              {key === "is_gated_estate"
                                ? bnplGatedEstateLabel(value)
                                : key.includes("amount") || key.includes("price") || key.includes("fee")
                                  ? formatCurrency(value)
                                  : String(value)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {detailModalTab === "Summary" && (
              <div className="space-y-4">
                {loadingSummary ? (
                  <LoadingSpinner message="Loading order summary..." />
                ) : orderSummary ? (
                  <>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Order Information</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Order Number:</span>
                          <span className="ml-2 font-medium">{orderSummary.order_number || selectedItem.id}</span>
                        </div>
                        {(orderSummary.bundle_title || selectedItem.bundle?.title) && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Bundle:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {orderSummary.bundle_title || selectedItem.bundle?.title}
                            </span>
                          </div>
                        )}
                        {resolveOrderCustomerType(selectedItem, orderSummary) && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Customer type:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {resolveOrderCustomerType(selectedItem, orderSummary)}
                            </span>
                          </div>
                        )}
                        {resolveOrderInstallerChoice(selectedItem, orderSummary) && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Installer:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {resolveOrderInstallerChoice(selectedItem, orderSummary) === "own"
                                ? "Use my own installer"
                                : "TrooSolar installer"}
                            </span>
                          </div>
                        )}
                        {(orderSummary.product_title || selectedItem.product?.title) && !orderSummary.bundle_title && !selectedItem.bundle?.title && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Product:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {orderSummary.product_title || selectedItem.product?.title}
                            </span>
                          </div>
                        )}
                        {orderSummary.installation_requested_date && (
                          <div className="col-span-2">
                            <span className="text-gray-600">
                              {getRequestedServiceDateLabel(selectedItem, orderSummary)}:
                            </span>
                            <span className="ml-2 font-medium text-gray-900">
                              {formatDate(orderSummary.installation_requested_date)}
                            </span>
                          </div>
                        )}
                        {orderSummary.delivery_address && (
                          <div className="col-span-2 space-y-1 border-t border-gray-200 pt-3 mt-1">
                            <p className="text-gray-600 font-medium">
                              {getSiteSectionTitle(selectedItem, orderSummary)}
                            </p>
                            <p className="text-gray-800">
                              {[orderSummary.delivery_address.address, orderSummary.delivery_address.state]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {(resolveOrderPropertyField("property_floors", selectedItem, orderSummary) != null ||
                              resolveOrderPropertyField("property_rooms", selectedItem, orderSummary) != null ||
                              resolveOrderPropertyField("is_gated_estate", selectedItem, orderSummary) !== null) && (
                              <p className="text-xs text-gray-500">
                                {[
                                  resolveOrderPropertyField("property_floors", selectedItem, orderSummary) != null
                                    ? `Floors: ${resolveOrderPropertyField("property_floors", selectedItem, orderSummary)}`
                                    : null,
                                  resolveOrderPropertyField("property_rooms", selectedItem, orderSummary) != null
                                    ? `Rooms: ${resolveOrderPropertyField("property_rooms", selectedItem, orderSummary)}`
                                    : null,
                                  resolveOrderPropertyField("is_gated_estate", selectedItem, orderSummary) !== null
                                    ? `Gated estate: ${orderGatedEstateLabel(resolveOrderPropertyField("is_gated_estate", selectedItem, orderSummary))}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              Site phone: {orderSummary.delivery_address.phone_number || "—"}
                              {(() => {
                                const c = deliverySiteContactDisplay(
                                  orderSummary.delivery_address,
                                  selectedItem?.user
                                );
                                return c && c !== "—" ? ` · Contact: ${c}` : "";
                              })()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {resolveModalOrderItems(orderSummary, selectedItem).length > 0 && (
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
                        {renderOrderItemsList(resolveModalOrderItems(orderSummary, selectedItem))}
                      </div>
                    )}

                    {orderSummary.appliances &&
                      !(
                        orderSummary.bundle_title ||
                        selectedItem.bundle?.title ||
                        (orderSummary.items && orderSummary.items.length > 0)
                      ) && (
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Appliances</h3>
                        <p className="text-gray-600">{orderSummary.appliances}</p>
                      </div>
                    )}

                    {/* {orderSummary.backup_time && (
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Backup Time</h3>
                        <p className="text-gray-600">{orderSummary.backup_time}</p>
                      </div>
                    )} */}
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No summary data available
                  </div>
                )}
              </div>
            )}

            {detailModalTab === "Invoice" && (
              <div className="space-y-4">
                {loadingInvoice ? (
                  <LoadingSpinner message="Loading invoice details..." />
                ) : orderInvoice ? (
                  <>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Invoice Information</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Order Number:</span>
                          <span className="ml-2 font-medium">{orderInvoice.order_number || selectedItem.id}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total paid:</span>
                          <span className="ml-2 font-medium text-[#273E8E]">
                            {formatCurrency(
                              orderInvoice.invoice?.grand_total
                                ?? orderInvoice.invoice?.total
                                ?? orderInvoice.total
                                ?? selectedItem.total_price
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {orderInvoice.invoice && (
                      <div className="space-y-4">
                        {/* Product breakdown: prefer per-line bundle materials from API; else legacy 3-bucket summary */}
                        {(() => {
                          const productLineItems = filterOrderListRowsForInstaller(
                            orderInvoice.invoice.product_line_items || [],
                            selectedItem,
                            orderInvoice
                          );
                          const lineItems = filterOrderListRowsForInstaller(
                            orderInvoice.invoice.bundle_line_items || [],
                            selectedItem,
                            orderInvoice
                          );
                          const bundleTitle =
                            orderInvoice.bundle_title ||
                            selectedItem?.bundle?.title ||
                            orderInvoice.invoice?.bundle_title;
                          const isSingleBundleTitleLine =
                            Array.isArray(productLineItems) &&
                            productLineItems.length === 1 &&
                            bundleTitle &&
                            String(productLineItems[0]?.description || "").trim() === String(bundleTitle).trim();
                          const hasProductLines =
                            Array.isArray(productLineItems) &&
                            productLineItems.length > 0 &&
                            !isGenericInvoiceBreakdownRows(productLineItems) &&
                            !isSingleBundleTitleLine;
                          const hasLineItems = Array.isArray(lineItems) && lineItems.length > 0;
                          const invoiceTypeLabel = (t: string) => {
                            if (t === "inverter") return "Inverter";
                            if (t === "panels") return "Panels";
                            if (t === "batteries") return "Battery";
                            return "Other / accessory";
                          };

                          if (hasProductLines) {
                            return (
                              <div className="mb-4">
                                <h3 className="font-semibold text-gray-900 mb-2">
                                  {bundleTitle ? `Order list — ${bundleTitle}` : "Product breakdown"}
                                </h3>
                                <p className="text-sm text-gray-600 mb-3">
                                  Catalog prices per item. Order-level discount (if any) is shown in the fees breakdown below.
                                </p>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 text-left text-gray-600">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">Description</th>
                                        <th className="px-3 py-2 font-medium">Qty</th>
                                        <th className="px-3 py-2 font-medium text-right">Unit price</th>
                                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {productLineItems.map((row: { description?: string; quantity?: number; rate?: number; total_cost?: number }, idx: number) => (
                                        <tr key={idx}>
                                          <td className="px-3 py-2 font-medium text-gray-900">{row.description || "—"}</td>
                                          <td className="px-3 py-2">{row.quantity ?? 1}</td>
                                          <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(row.rate ?? 0)}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-[#273E8E]">
                                            {formatCurrency(row.total_cost ?? 0)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          }

                          if (hasLineItems) {
                            return (
                              <div className="mb-4">
                                <h3 className="font-semibold text-gray-900 mb-2">
                                  {bundleTitle ? `Order list — ${bundleTitle}` : "Product breakdown"}
                                </h3>
                                <p className="text-sm text-gray-600 mb-3">
                                  Each row is a catalog item in the bundle. Amounts are scaled to match the order
                                  subtotal using each line&apos;s share of the bundle catalog total (no fake panel
                                  line for inverter-only systems).
                                </p>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 text-left text-gray-600">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">Type</th>
                                        <th className="px-3 py-2 font-medium">Description</th>
                                        <th className="px-3 py-2 font-medium">Qty</th>
                                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {lineItems.map((row: { type?: string; description?: string; quantity?: number; price?: number }, idx: number) => (
                                        <tr key={idx}>
                                          <td className="px-3 py-2 text-gray-700">{invoiceTypeLabel(String(row.type || "other"))}</td>
                                          <td className="px-3 py-2 font-medium text-gray-900">{row.description || "—"}</td>
                                          <td className="px-3 py-2">{row.quantity ?? 1}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-[#273E8E]">
                                            {formatCurrency(row.price ?? 0)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          }

                          const inv = orderInvoice.invoice.solar_inverter;
                          const pan = orderInvoice.invoice.solar_panels;
                          const bat = orderInvoice.invoice.batteries;
                          const lineHasAmount = (line: { price?: number | string } | null | undefined) =>
                            line != null && Number(line.price) > 0;
                          const showInv = lineHasAmount(inv);
                          const showPan = lineHasAmount(pan);
                          const showBat = lineHasAmount(bat);
                          const fakeSplit = isFakePercentBundleBreakdown(inv, pan, bat);

                          if (fakeSplit && bundleTitle) {
                            const bundleTotal =
                              Number(inv?.price ?? 0) + Number(pan?.price ?? 0) + Number(bat?.price ?? 0);
                            return (
                              <div className="mb-4">
                                <h3 className="font-semibold text-gray-900 mb-2">
                                  Order list — {bundleTitle}
                                </h3>
                                <p className="text-sm text-gray-600 mb-3">
                                  Bundle order (single line). Fee and tax details are in the breakdown below.
                                </p>
                                <div className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                                  <div>
                                    <h4 className="font-medium text-gray-900">{bundleTitle}</h4>
                                    <p className="text-sm text-gray-600 mt-1">Quantity: 1</p>
                                  </div>
                                  <div className="font-semibold text-[#273E8E]">{formatCurrency(bundleTotal)}</div>
                                </div>
                              </div>
                            );
                          }

                          if (!showInv && !showPan && !showBat) return null;
                          if (fakeSplit) return null;
                          return (
                            <div className="mb-4">
                              <h3 className="font-semibold text-gray-900 mb-3">Product Breakdown</h3>
                              <div className="space-y-3">
                                {showInv && (
                                  <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <h4 className="font-medium text-gray-900">
                                          {inv?.description || "Solar Inverter"}
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                          Quantity: {inv?.quantity ?? 1}
                                        </p>
                                      </div>
                                      <div className="font-semibold text-[#273E8E]">{formatCurrency(inv?.price)}</div>
                                    </div>
                                  </div>
                                )}
                                {showPan && (
                                  <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <h4 className="font-medium text-gray-900">
                                          {pan?.description || "Solar Panels"}
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                          Quantity: {pan?.quantity ?? 1}
                                        </p>
                                      </div>
                                      <div className="font-semibold text-[#273E8E]">{formatCurrency(pan?.price)}</div>
                                    </div>
                                  </div>
                                )}
                                {showBat && (
                                  <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <h4 className="font-medium text-gray-900">
                                          {bat?.description || "Batteries"}
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                          Quantity: {bat?.quantity ?? 1}
                                        </p>
                                      </div>
                                      <div className="font-semibold text-[#273E8E]">{formatCurrency(bat?.price)}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Payment summary — same layout/labels as customer Buy Now PaymentSummaryCard */}
                        {(() => {
                          const inv = orderInvoice.invoice;
                          const amt = (n: number | string | null | undefined) =>
                            formatCurrencyLoanSummary(n);
                          const row = (
                            label: string,
                            value: number | string | null | undefined,
                            opts: { prefix?: string; emphasize?: boolean; valueClass?: string } = {}
                          ) => {
                            const n = Number(value || 0);
                            if (!Number.isFinite(n) && value == null) return null;
                            return (
                              <div
                                className={`flex justify-between items-center py-2.5 text-sm ${
                                  opts.emphasize ? "font-medium" : ""
                                }`}
                              >
                                <span className="text-gray-700">{label}</span>
                                <span
                                  className={`font-semibold tabular-nums ${
                                    opts.valueClass || "text-gray-900"
                                  }`}
                                >
                                  {opts.prefix || ""}
                                  {amt(Math.abs(n))}
                                </span>
                              </div>
                            );
                          };
                          const Divider = () => (
                            <hr className="border-0 border-t border-gray-300 my-1" />
                          );
                          const subTotal = Number(inv.items_subtotal_before_discount ?? 0);
                          const discount = Number(inv.outright_discount_amount ?? 0);
                          const discountPct = Math.round(
                            Number(inv.outright_discount_percentage ?? 10)
                          );
                          const netTotal = Number(inv.subtotal ?? 0);
                          const deliveryFee = Number(inv.delivery_fee ?? 0);
                          const installationFee = Number(inv.installation_fee ?? 0);
                          const inspectionFee = Number(inv.inspection_fee ?? 0);
                          const materialCost = Number(inv.material_cost ?? 0);
                          const totalAmount = Number(
                            inv.sum_before_vat ??
                              netTotal + deliveryFee + installationFee + inspectionFee + materialCost
                          );
                          const vatAmount = Number(inv.vat_amount ?? 0);
                          const vatPct = Number(inv.vat_percentage ?? 7.5);
                          const insuranceFee = Number(inv.insurance_fee ?? 0);
                          const insurancePct = Number(inv.insurance_fee_percentage ?? 3);
                          const grandTotal = Number(inv.grand_total ?? inv.total ?? 0);
                          const hasServiceFees =
                            deliveryFee > 0 ||
                            installationFee > 0 ||
                            inspectionFee > 0 ||
                            materialCost > 0;

                          return (
                            <div className="mb-4 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                                  Payment summary
                                </h3>
                              </div>
                              <div className="px-4 py-2">
                                {row("Sub-Total", subTotal)}
                                {discount > 0 &&
                                  row(`Discount (${discountPct}%)`, discount, {
                                    prefix: "-",
                                    valueClass: "text-green-700",
                                  })}
                                {row("Net Total", netTotal, { emphasize: true })}
                                {hasServiceFees && (
                                  <>
                                    <Divider />
                                    {deliveryFee > 0 &&
                                      row("Delivery Fee", deliveryFee, { prefix: "+" })}
                                    {installationFee > 0 &&
                                      row("Installation Fee", installationFee, { prefix: "+" })}
                                    {inspectionFee > 0 &&
                                      row("Inspection Fee", inspectionFee, { prefix: "+" })}
                                    {materialCost > 0 &&
                                      row("Installation Materials Cost", materialCost, {
                                        prefix: "+",
                                      })}
                                  </>
                                )}
                                <Divider />
                                {row("Total Amount", totalAmount, { emphasize: true })}
                                {vatAmount > 0 &&
                                  row(`VAT (${vatPct}% of Total Amount)`, vatAmount, {
                                    prefix: "+",
                                  })}
                                {insuranceFee > 0 &&
                                  row(
                                    `Insurance Fee (${insurancePct}% of Sub-Total)`,
                                    insuranceFee,
                                    { prefix: "+" }
                                  )}
                                <Divider />
                                <div className="flex justify-between items-center py-3">
                                  <span className="font-bold text-base uppercase text-[#273E8E] tracking-wide">
                                    Grand Total
                                  </span>
                                  <span className="font-bold text-xl text-[#273E8E] tabular-nums">
                                    {amt(grandTotal)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                ) : invoiceNotFound ? (
                  <div className="text-center text-gray-500 py-8">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-2">Invoice does not exist</p>
                    <p className="text-sm text-gray-500">
                      This order does not have an invoice available.
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p className="mb-4">Invoice details not loaded</p>
                    <button
                      onClick={handleLoadInvoice}
                      className="bg-[#273E8E] text-white px-4 py-2 rounded-lg hover:bg-[#1e3270] transition-colors"
                    >
                      Load Invoice
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedItem && (
        <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Update Status</h2>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedItem(null);
                  setStatusForm(emptyStatusForm());
                  setAuditPaymentReceiptFile(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  value={statusForm.status}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, status: e.target.value })
                  }
                >
                  <option value="">Select Status</option>
                  {activeTab === "BNPL Applications" && (
                    <>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="counter_offer">Counter Offer</option>
                    </>
                  )}
                  {activeTab === "BNPL Guarantors" && (
                    <>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </>
                  )}
                  {(activeTab === "Buy Now Orders" || activeTab === "BNPL Orders") && (
                    <>
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  )}
                  {activeTab === "Audit Requests" && (
                    <>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </>
                  )}
                </select>
                  {activeTab === "Audit Requests" && (
                  <p className="mt-2 text-xs text-gray-600">
                    Approved sends the audit visit date/time plus payment instructions to the customer. After approval, use the payment received section to record when the customer paid. Rejected sends an update email.
                  </p>
                )}
              </div>

              {activeTab === "Audit Requests" && statusForm.status === "approved" && (
                <div className="rounded-xl border border-[#273E8E]/20 bg-[#F5F7FF] p-4 space-y-3">
                  <p className="text-sm font-semibold text-[#273E8E]">
                    Audit visit details and payment instructions
                  </p>
                  <p className="text-xs text-gray-600">
                    Tell the customer when the team will come for the audit. Payment account details below tell them how to pay before the visit.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Audit date *
                      </label>
                      <input
                        type="date"
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                        value={statusForm.approval_payment_date}
                        onChange={(e) =>
                          setStatusForm({ ...statusForm, approval_payment_date: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Audit time *
                      </label>
                      <select
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                        value={statusForm.approval_payment_time}
                        onChange={(e) =>
                          setStatusForm({ ...statusForm, approval_payment_time: e.target.value })
                        }
                      >
                        <option value="">Select time</option>
                        {auditVisitTimeOptions.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Payment amount (₦) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                      placeholder="e.g. 50000"
                      value={statusForm.approval_payment_amount}
                      onChange={(e) =>
                        setStatusForm({ ...statusForm, approval_payment_amount: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Payment account details *
                    </label>
                    <textarea
                      className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                      rows={3}
                      placeholder="Bank name, account name, account number, and payment instructions."
                      value={statusForm.approval_payment_account_details}
                      onChange={(e) =>
                        setStatusForm({
                          ...statusForm,
                          approval_payment_account_details: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {activeTab === "Audit Requests" && statusForm.status === "approved" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-900">
                    Customer payment received
                  </p>
                  <p className="text-xs text-emerald-800">
                    After the customer pays, mark it here with the payment date and time, and upload the payment receipt.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-[#273E8E] rounded border-gray-300"
                      checked={!!statusForm.customer_has_paid}
                      onChange={(e) =>
                        setStatusForm({
                          ...statusForm,
                          customer_has_paid: e.target.checked,
                          ...(e.target.checked
                            ? {}
                            : { customer_payment_date: "", customer_payment_time: "" }),
                        })
                      }
                    />
                    <span className="text-sm text-gray-800">Customer has paid</span>
                  </label>
                  {statusForm.customer_has_paid && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Payment date *
                          </label>
                          <input
                            type="date"
                            className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                            value={statusForm.customer_payment_date}
                            onChange={(e) =>
                              setStatusForm({
                                ...statusForm,
                                customer_payment_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Payment time *
                          </label>
                          <select
                            className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                            value={statusForm.customer_payment_time}
                            onChange={(e) =>
                              setStatusForm({
                                ...statusForm,
                                customer_payment_time: e.target.value,
                              })
                            }
                          >
                            <option value="">Select time</option>
                            {auditVisitTimeOptions.map((slot) => (
                              <option key={slot.value} value={slot.value}>
                                {slot.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Payment receipt (PDF or image) *
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#273E8E] file:text-white file:text-sm file:font-medium"
                          onChange={(e) =>
                            setAuditPaymentReceiptFile(e.target.files?.[0] || null)
                          }
                        />
                        <p className="mt-1 text-xs text-emerald-800">
                          Uploading the receipt sends the payment confirmation email to the customer.
                        </p>
                        {auditPaymentReceiptFile && (
                          <p className="mt-1 text-xs text-gray-600">
                            Selected: {auditPaymentReceiptFile.name}
                          </p>
                        )}
                        {!auditPaymentReceiptFile && auditPaymentReceiptUrl(selectedItem) && (
                          <p className="mt-1 text-xs text-gray-600">
                            Current receipt:{" "}
                            <a
                              href={auditPaymentReceiptUrl(selectedItem) || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#273E8E] hover:underline"
                            >
                              View uploaded receipt
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {statusForm.status === "approved" && activeTab === "BNPL Applications" && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  Once you approve, the user will be able to pay their down payment and the order will be fulfilled.
                </div>
              )}

              {statusForm.status === "counter_offer" && activeTab === "BNPL Applications" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Counter offer — minimum deposit (% of bundle price)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      value={statusForm.counter_offer_min_deposit}
                      onChange={(e) =>
                        setStatusForm({
                          ...statusForm,
                          counter_offer_min_deposit: e.target.value,
                        })
                      }
                      placeholder="e.g. 40"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Same meaning as the customer &quot;Initial Deposit (X%)&quot; — percent of <strong>bundle price</strong>, not total repayment. Admin fees (insurance on bundle; management/legal on loan amount) are added to that equity deposit to get the full upfront due (stored as counter-offer minimum deposit in ₦).
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Counter offer — minimum tenor (months)
                    </label>
                    <select
                      className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      value={statusForm.counter_offer_min_tenor}
                      onChange={(e) =>
                        setStatusForm({
                          ...statusForm,
                          counter_offer_min_tenor: e.target.value,
                        })
                      }
                    >
                      <option value="">Select tenor</option>
                      {allowedDurations.map((m) => (
                        <option key={m} value={m}>{m} months</option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const snap =
                      selectedItem?.loan_plan_snapshot && typeof selectedItem.loan_plan_snapshot === "object"
                        ? (selectedItem.loan_plan_snapshot as Record<string, unknown>)
                        : null;
                    const bundle = bnplBundlePriceFromSnapshotForCounter(snap ?? undefined);
                    const pct = Number(statusForm.counter_offer_min_deposit);
                    const tenor = Number(statusForm.counter_offer_min_tenor);
                    const feePcts = bnplFeePctsForCounter(snap ?? undefined);
                    const interestM = bnplInterestMonthlyForCounter(
                      snap ?? undefined,
                      Number(selectedItem?.mono?.interest_rate) || 4
                    );
                    const snapPlan = bnplPlanFromSnapshotForCounter(snap ?? undefined);
                    const snapPct = bnplParseAmountCounter(snap?.depositPercent);
                    const snapTenor = bnplParseAmountCounter(snap?.tenor);
                    const shouldUseSnapshotPlan =
                      !!snapPlan &&
                      pct > 0 &&
                      tenor > 0 &&
                      Math.abs(pct - snapPct) < 0.01 &&
                      Math.abs(tenor - snapTenor) < 0.01;
                    const plan = shouldUseSnapshotPlan
                      ? snapPlan
                      : bundle > 0 && pct > 0 && pct <= 100 && tenor > 0
                        ? bnplComputeCounterOfferPlan(bundle, pct, tenor, interestM, feePcts)
                        : null;
                    if (!plan) {
                      return (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                          {bundle <= 0
                            ? "Bundle price not found on this application (missing loan plan snapshot). Counter offer math cannot be previewed."
                            : "Enter a deposit % (1–100) and select a tenor to preview the plan (matches customer BNPL loan summary)."}
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm space-y-2">
                        <p className="font-semibold text-gray-800">Preview (matches BNPL “Review Your Loan Plan”)</p>
                        <p className="text-xs text-gray-600">
                          Loan calculator total (principal + equity):{" "}
                          <strong>{formatCurrency(plan.bundlePrice)}</strong> · Interest: {interestM}% × {tenor} mo ·
                          Insurance {feePcts.insurance}% of this total; management {feePcts.management}% and legal{" "}
                          {feePcts.legal}% of the loan amount after equity deposit.
                        </p>
                        <ul className="space-y-1 text-gray-800 border-t border-green-200 pt-2 mt-2">
                          <li className="flex justify-between gap-2">
                            <span>1. Initial Deposit ({plan.depositPercent}%) + total administrative fees</span>
                            <span className="font-semibold tabular-nums">{formatCurrency(plan.upfrontDepositTotal)}</span>
                          </li>
                          <li className="flex justify-between gap-2">
                            <span>2. Total loan amount</span>
                            <span className="tabular-nums">{formatCurrency(plan.totalLoanAmount)}</span>
                          </li>
                          <li className="flex justify-between gap-2">
                            <span>3. Total interest ({interestM}% × {tenor} mo)</span>
                            <span className="tabular-nums">{formatCurrency(plan.totalInterestAmount)}</span>
                          </li>
                          <li className="flex justify-between gap-2">
                            <span>4. Total repayment amount</span>
                            <span className="tabular-nums">{formatCurrency(plan.totalRepaymentAmount)}</span>
                          </li>
                          <li className="flex justify-between gap-2 font-semibold text-[#273E8E]">
                            <span>5. Monthly repayment amount</span>
                            <span className="tabular-nums">{formatCurrency(plan.monthlyRepaymentAmount)}</span>
                          </li>
                        </ul>
                        <div className="mt-3 pt-3 border-t border-green-200 text-xs text-gray-700">
                          <p className="font-semibold text-gray-800 mb-1">Administrative fees</p>
                          <ul className="space-y-0.5">
                            <li className="flex justify-between gap-2">
                              <span>Insurance ({feePcts.insurance}% of loan calculator total)</span>
                              <span className="tabular-nums">{formatCurrency(plan.insuranceFee)}</span>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span>Management ({feePcts.management}% of loan amount)</span>
                              <span className="tabular-nums">{formatCurrency(plan.managementFee)}</span>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span>Legal ({feePcts.legal}% of loan amount)</span>
                              <span className="tabular-nums">{formatCurrency(plan.legalFee)}</span>
                            </li>
                            <li className="flex justify-between gap-2 font-medium border-t border-green-200 pt-1 mt-1">
                              <span>Total administrative fees</span>
                              <span className="tabular-nums">{formatCurrency(plan.adminFeesTotal)}</span>
                            </li>
                          </ul>
                        </div>
                        <p className="text-xs text-gray-600 pt-1">
                          Stored counter-offer minimum (₦):{" "}
                          <strong className="text-gray-900">{formatCurrency(plan.upfrontDepositTotal)}</strong> — equity
                          deposit ({formatCurrency(plan.baseDeposit)}) + admin fees ({formatCurrency(plan.adminFeesTotal)}).
                        </p>
                      </div>
                    );
                  })()}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {activeTab === "Audit Requests" ? "Additional notes (optional)" : "Admin Notes (Optional)"}
                </label>
                <textarea
                  className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                  value={statusForm.admin_notes}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, admin_notes: e.target.value })
                  }
                  placeholder="Enter admin notes..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedItem(null);
                  setStatusForm(emptyStatusForm());
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusSubmit}
                disabled={
                  !statusForm.status ||
                  updateApplicationStatusMutation.isPending ||
                  updateGuarantorStatusMutation.isPending ||
                  updateBuyNowOrderStatusMutation.isPending ||
                  updateAuditRequestStatusMutation.isPending
                }
                className={`px-6 py-2 rounded-full font-medium transition-colors flex items-center ${
                  statusForm.status &&
                  !updateApplicationStatusMutation.isPending &&
                  !updateGuarantorStatusMutation.isPending &&
                  !updateBuyNowOrderStatusMutation.isPending &&
                  !updateAuditRequestStatusMutation.isPending
                    ? "bg-[#273E8E] text-white hover:bg-[#1f2f7a]"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {(updateApplicationStatusMutation.isPending ||
                  updateGuarantorStatusMutation.isPending ||
                  updateBuyNowOrderStatusMutation.isPending ||
                  updateAuditRequestStatusMutation.isPending) && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                )}
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Partner Modal (BNPL - before approving) */}
      {showSendToPartnerModal && (selectedItem?.user_id != null || selectedItem?.user?.id != null) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Send to Partner</h2>
              <button
                onClick={() => {
                  setShowSendToPartnerModal(false);
                  setSelectedPartnerIdForSend("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Sends this BNPL application (the one you have open) to the partner: full customer and property details,
              loan plan snapshot, order lines, beneficiary, guarantor summary, and attachments when files exist on the
              server (bank statement, live selfie, KYC uploads, signed guarantor form).
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Partner</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#273E8E] focus:border-transparent outline-none"
                value={selectedPartnerIdForSend}
                onChange={(e) => setSelectedPartnerIdForSend(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select partner</option>
                {financePartnersLoading ? (
                  <option disabled>Loading partners...</option>
                ) : (
                  financePartnersList.map((partner: any) => (
                    <option key={partner.id} value={partner.id}>
                      {partner["Partner name"] ?? partner.name ?? `Partner #${partner.id}`}
                      {partner.Status ? ` (${partner.Status})` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSendToPartnerModal(false);
                  setSelectedPartnerIdForSend("");
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!selectedPartnerIdForSend || sendingToPartner}
                onClick={async () => {
                  const userId = selectedItem?.user_id ?? selectedItem?.user?.id;
                  if (!userId || !selectedPartnerIdForSend) return;
                  setSendingToPartner(true);
                  try {
                    await sendToPartnerDetail(
                      userId,
                      {
                        partner_id: Number(selectedPartnerIdForSend),
                        loan_application_id:
                          selectedItem?.id != null ? Number(selectedItem.id) : undefined,
                      },
                      token
                    );
                    setShowSendToPartnerModal(false);
                    setSelectedPartnerIdForSend("");
                    alert("Email sent to partner successfully.");
                  } catch (err: any) {
                    alert(err?.response?.data?.message || err?.message || "Failed to send to partner.");
                  } finally {
                    setSendingToPartner(false);
                  }
                }}
                className="px-6 py-2 rounded-lg font-medium bg-[#273E8E] text-white hover:bg-[#1e3270] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingToPartner ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Order Modal */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create Custom Order</h2>
              <button
                onClick={() => {
                  setShowCreateOrderModal(false);
                  setCreateOrderForm({
                    user_id: "",
                    order_type: "buy_now",
                    items: [],
                    send_email: true,
                    email_message: "",
                  });
                  setSelectedProducts([]);
                  setCustomProducts([]);
                  setShowAddCustomProduct(false);
                  setCreateOrderCatalogSearch("");
                  setNewCustomProduct({
                    name: "",
                    description: "",
                    price: "",
                    quantity: "1",
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <img src={images.cross} className="w-6 h-6" alt="Close" />
              </button>
            </div>

            <div className="space-y-4">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User *
                </label>
                <UserSearchSelect
                  value={createOrderForm.user_id}
                  onChange={(userId) =>
                    setCreateOrderForm({ ...createOrderForm, user_id: userId })
                  }
                  users={customOrderUsers}
                  loading={allUsersLoading}
                  placeholder="Search by name, email, phone, BVN, or user ID…"
                  emptyMessage={
                    allUsersLoading
                      ? "Loading users…"
                      : "No users match your search"
                  }
                />
              </div>

              {/* Order Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Type *
                </label>
                <select
                  value={createOrderForm.order_type}
                  onChange={(e) =>
                    setCreateOrderForm({
                      ...createOrderForm,
                      order_type: e.target.value as "buy_now" | "bnpl",
                    })
                  }
                  className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                  required
                >
                  <option value="buy_now">Buy Now</option>
                  <option value="bnpl">BNPL</option>
                </select>
              </div>

              {/* Product Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter Products/Bundles
                </label>
                <div className="flex space-x-2">
                  {(["all", "products", "bundles"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setProductTypeFilter(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        productTypeFilter === type
                          ? "bg-[#273E8E] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Products/Services Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Custom Products/Services
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      These will be automatically included in the email message sent to the user
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomProduct(true)}
                    className="text-sm text-[#273E8E] hover:text-[#1e3270] font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Custom Product/Service
                  </button>
                </div>
                
                {/* Add Custom Product Form */}
                {showAddCustomProduct && (
                  <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Add Custom Product/Service</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          value={newCustomProduct.name}
                          onChange={(e) => setNewCustomProduct({ ...newCustomProduct, name: e.target.value })}
                          className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                          placeholder="Enter product/service name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Description *
                        </label>
                        <textarea
                          value={newCustomProduct.description}
                          onChange={(e) => setNewCustomProduct({ ...newCustomProduct, description: e.target.value })}
                          className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                          rows={2}
                          placeholder="Enter description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Price (₦) *
                          </label>
                          <input
                            type="number"
                            value={newCustomProduct.price}
                            onChange={(e) => setNewCustomProduct({ ...newCustomProduct, price: e.target.value })}
                            className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Quantity *
                          </label>
                          <input
                            type="number"
                            value={newCustomProduct.quantity}
                            onChange={(e) => setNewCustomProduct({ ...newCustomProduct, quantity: e.target.value })}
                            className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white"
                            placeholder="1"
                            min="1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCustomProduct(false);
                            setNewCustomProduct({
                              name: "",
                              description: "",
                              price: "",
                              quantity: "1",
                            });
                          }}
                          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newCustomProduct.name.trim()) {
                              alert("Please enter a name");
                              return;
                            }
                            if (!newCustomProduct.description.trim()) {
                              alert("Please enter a description");
                              return;
                            }
                            if (!newCustomProduct.price || parseFloat(newCustomProduct.price) <= 0) {
                              alert("Please enter a valid price");
                              return;
                            }
                            if (!newCustomProduct.quantity || parseInt(newCustomProduct.quantity) < 1) {
                              alert("Please enter a valid quantity");
                              return;
                            }
                            
                            // Format custom product for email message
                            const customProduct = {
                              name: newCustomProduct.name.trim(),
                              description: newCustomProduct.description.trim(),
                              price: parseFloat(newCustomProduct.price),
                              quantity: parseInt(newCustomProduct.quantity),
                            };
                            
                            // Add to custom products list for display
                            setCustomProducts([...customProducts, customProduct]);
                            
                            // Automatically format and append to email message
                            const total = customProduct.price * customProduct.quantity;
                            const customProductText = `\n\n--- Custom Product/Service ---\n${customProduct.name}\nDescription: ${customProduct.description}\nPrice: ${formatCurrency(customProduct.price)} x ${customProduct.quantity} = ${formatCurrency(total)}`;
                            
                            const currentEmailMessage = createOrderForm.email_message || "";
                            setCreateOrderForm({
                              ...createOrderForm,
                              email_message: currentEmailMessage + customProductText,
                            });
                            
                            setNewCustomProduct({
                              name: "",
                              description: "",
                              price: "",
                              quantity: "1",
                            });
                            setShowAddCustomProduct(false);
                          }}
                          className="px-4 py-2 text-sm bg-[#273E8E] text-white rounded-lg hover:bg-[#1e3270]"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* List of Custom Products */}
                {customProducts.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Custom Products/Services (Will be included in email):</h4>
                      <span className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                        {customProducts.length} item{customProducts.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {customProducts.map((custom, index) => (
                        <div
                          key={index}
                          className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-900">{custom.name}</p>
                            <p className="text-xs text-gray-600 mt-1">{custom.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-sm font-semibold text-[#273E8E]">
                                {formatCurrency(custom.price)}
                              </span>
                              <span className="text-xs text-gray-500">Qty: {custom.quantity}</span>
                              <span className="text-xs text-gray-500">
                                Total: {formatCurrency(custom.price * custom.quantity)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              // Remove from custom products list
                              const updatedCustomProducts = customProducts.filter((_, i) => i !== index);
                              setCustomProducts(updatedCustomProducts);
                              
                              // Rebuild email message without the removed custom product
                              let emailMessage = createOrderForm.email_message || "";
                              
                              // Remove the custom product section from email message
                              const customProduct = customProducts[index];
                              const total = customProduct.price * customProduct.quantity;
                              const customProductText = `\n\n--- Custom Product/Service ---\n${customProduct.name}\nDescription: ${customProduct.description}\nPrice: ${formatCurrency(customProduct.price)} x ${customProduct.quantity} = ${formatCurrency(total)}`;
                              
                              // Remove this specific custom product text from email message
                              emailMessage = emailMessage.replace(customProductText, '');
                              
                              // Rebuild email message with remaining custom products
                              if (updatedCustomProducts.length > 0) {
                                const remainingCustomProductsText = updatedCustomProducts.map((custom) => {
                                  const customTotal = custom.price * custom.quantity;
                                  return `\n\n--- Custom Product/Service ---\n${custom.name}\nDescription: ${custom.description}\nPrice: ${formatCurrency(custom.price)} x ${custom.quantity} = ${formatCurrency(customTotal)}`;
                                }).join('');
                                
                                // Get the base message (before any custom products)
                                const baseMessage = emailMessage.split('--- Custom Product/Service ---')[0].trim();
                                emailMessage = baseMessage + remainingCustomProductsText;
                              } else {
                                // No custom products left, remove all custom product sections
                                emailMessage = emailMessage.split('--- Custom Product/Service ---')[0].trim();
                              }
                              
                              setCreateOrderForm({
                                ...createOrderForm,
                                email_message: emailMessage,
                              });
                            }}
                            className="ml-3 text-red-500 hover:text-red-700"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Products/Bundles Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Products/Bundles
                </label>
                <div className="mb-3">
                  <input
                    type="search"
                    value={createOrderCatalogSearch}
                    onChange={(e) => setCreateOrderCatalogSearch(e.target.value)}
                    placeholder="Search products or bundles by name..."
                    className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#273E8E] focus:border-transparent outline-none"
                  />
                </div>
                {cartProductsLoading ? (
                  <LoadingSpinner message="Loading products..." />
                ) : (
                  (() => {
                    const search = createOrderCatalogSearch.trim().toLowerCase();
                    const matchesSearch = (item: any) => {
                      if (!search) return true;
                      const title = String(item?.title || item?.name || "").toLowerCase();
                      const model = String(item?.product_model || item?.model || "").toLowerCase();
                      return title.includes(search) || model.includes(search);
                    };
                    const products = (cartProductsData?.data?.products || []).filter(matchesSearch);
                    const bundles = (cartProductsData?.data?.bundles || []).filter(matchesSearch);
                    const hasResults = products.length > 0 || bundles.length > 0;

                    return (
                  <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {!hasResults && (
                        <p className="text-sm text-gray-500 py-4 text-center">
                          {search
                            ? `No products or bundles match “${createOrderCatalogSearch.trim()}”.`
                            : "No products or bundles available."}
                        </p>
                      )}
                      {products.map((product: any) => (
                        <div
                          key={`product-${product.id}`}
                          className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{product.title}</p>
                            <p className="text-sm text-gray-600">
                              {formatCurrency(product.discount_price || product.price)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              defaultValue="1"
                              className="w-16 px-2 py-1 border rounded text-sm"
                              onChange={(e) => {
                                const quantity = parseInt(e.target.value) || 1;
                                const existing = selectedProducts.find(
                                  (p) => p.id === product.id && p.type === "product"
                                );
                                if (existing) {
                                  setSelectedProducts(
                                    selectedProducts.map((p) =>
                                      p.id === product.id && p.type === "product"
                                        ? { ...p, quantity }
                                        : p
                                    )
                                  );
                                } else {
                                  setSelectedProducts([
                                    ...selectedProducts,
                                    { type: "product", id: product.id, quantity },
                                  ]);
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const existing = selectedProducts.find(
                                  (p) => p.id === product.id && p.type === "product"
                                );
                                if (existing) {
                                  setSelectedProducts(
                                    selectedProducts.filter(
                                      (p) => !(p.id === product.id && p.type === "product")
                                    )
                                  );
                                } else {
                                  setSelectedProducts([
                                    ...selectedProducts,
                                    { type: "product", id: product.id, quantity: 1 },
                                  ]);
                                }
                              }}
                              className={`px-3 py-1 rounded text-sm ${
                                selectedProducts.some(
                                  (p) => p.id === product.id && p.type === "product"
                                )
                                  ? "bg-red-500 text-white"
                                  : "bg-[#273E8E] text-white"
                              }`}
                            >
                              {selectedProducts.some(
                                (p) => p.id === product.id && p.type === "product"
                              )
                                ? "Remove"
                                : "Add"}
                            </button>
                          </div>
                        </div>
                      ))}
                      {bundles.map((bundle: any) => (
                        <div
                          key={`bundle-${bundle.id}`}
                          className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{bundle.title}</p>
                            <p className="text-sm text-gray-600">
                              {formatCurrency(bundle.discount_price || bundle.price)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              defaultValue="1"
                              className="w-16 px-2 py-1 border rounded text-sm"
                              onChange={(e) => {
                                const quantity = parseInt(e.target.value) || 1;
                                const existing = selectedProducts.find(
                                  (p) => p.id === bundle.id && p.type === "bundle"
                                );
                                if (existing) {
                                  setSelectedProducts(
                                    selectedProducts.map((p) =>
                                      p.id === bundle.id && p.type === "bundle"
                                        ? { ...p, quantity }
                                        : p
                                    )
                                  );
                                } else {
                                  setSelectedProducts([
                                    ...selectedProducts,
                                    { type: "bundle", id: bundle.id, quantity },
                                  ]);
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const existing = selectedProducts.find(
                                  (p) => p.id === bundle.id && p.type === "bundle"
                                );
                                if (existing) {
                                  setSelectedProducts(
                                    selectedProducts.filter(
                                      (p) => !(p.id === bundle.id && p.type === "bundle")
                                    )
                                  );
                                } else {
                                  setSelectedProducts([
                                    ...selectedProducts,
                                    { type: "bundle", id: bundle.id, quantity: 1 },
                                  ]);
                                }
                              }}
                              className={`px-3 py-1 rounded text-sm ${
                                selectedProducts.some(
                                  (p) => p.id === bundle.id && p.type === "bundle"
                                )
                                  ? "bg-red-500 text-white"
                                  : "bg-[#273E8E] text-white"
                              }`}
                            >
                              {selectedProducts.some(
                                (p) => p.id === bundle.id && p.type === "bundle"
                              )
                                ? "Remove"
                                : "Add"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                    );
                  })()
                )}
              </div>

              {/* Email Options */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    checked={createOrderForm.send_email}
                    onChange={(e) =>
                      setCreateOrderForm({
                        ...createOrderForm,
                        send_email: e.target.checked,
                      })
                    }
                    className="rounded w-4 h-4 text-[#273E8E] focus:ring-[#273E8E] border-gray-300"
                  />
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#273E8E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">
                      Send email link to user
                    </span>
                  </div>
                </label>

                {createOrderForm.send_email && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Email Message (Optional)
                      </label>
                      <span className="text-xs text-gray-500">
                        {createOrderForm.email_message.length}/1000
                      </span>
                    </div>
                    <textarea
                      value={createOrderForm.email_message}
                      onChange={(e) =>
                        setCreateOrderForm({
                          ...createOrderForm,
                          email_message: e.target.value,
                        })
                      }
                      className="w-full border border-[#CDCDCD] rounded-lg px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-[#273E8E] focus:border-transparent outline-none transition-all resize-none"
                      rows={4}
                      placeholder="Enter a custom message to include in the email sent to the user. This message will be sent along with the order link..."
                      maxLength={1000}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      This message will be included in the email notification sent to the user when the order is created.
                    </p>
                  </div>
                )}
              </div>

              {/* Selected Items Summary */}
              {selectedProducts.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-2">Selected Order Items:</h3>
                  <ul className="space-y-1">
                    {selectedProducts.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-600">
                        {item.type === "product" ? "Product" : "Bundle"} ID {item.id} - Qty: {item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Custom Products Summary (Email Only) */}
              {customProducts.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <h3 className="font-medium text-blue-600">Custom Products/Services (Included in Email):</h3>
                  </div>
                  <ul className="space-y-1">
                    {customProducts.map((custom, idx) => (
                      <li key={`custom-${idx}`} className="text-sm text-gray-600">
                        {custom.name} - {formatCurrency(custom.price)} x {custom.quantity} = {formatCurrency(custom.price * custom.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowCreateOrderModal(false);
                    setCreateOrderForm({
                      user_id: "",
                      order_type: "buy_now",
                      items: [],
                      send_email: true,
                      email_message: "",
                    });
                    setSelectedProducts([]);
                    setCustomProducts([]);
                    setShowAddCustomProduct(false);
                    setCreateOrderCatalogSearch("");
                    setNewCustomProduct({
                      name: "",
                      description: "",
                      price: "",
                      quantity: "1",
                    });
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!createOrderForm.user_id) {
                      alert("Please select a user");
                      return;
                    }
                    if (selectedProducts.length === 0 && customProducts.length === 0) {
                      alert("Please select at least one product, bundle, or add a custom product/service");
                      return;
                    }
                    
                    // Custom products are already included in email_message automatically when added
                    // Only send regular products/bundles as items, custom products are in the email message
                    createCustomOrderMutation.mutate({
                      ...createOrderForm,
                      user_id: parseInt(createOrderForm.user_id),
                      items: selectedProducts,
                      custom_items: customProducts.map((custom) => ({
                        name: custom.name,
                        description: custom.description,
                        price: custom.price,
                        quantity: custom.quantity,
                      })),
                      email_message: (createOrderForm.email_message || "")
                        .split("--- Custom Product/Service ---")[0]
                        .trim(),
                    });
                  }}
                  disabled={createCustomOrderMutation.isPending}
                  className="px-6 py-2 bg-[#273E8E] text-white rounded-lg text-sm font-medium hover:bg-[#1e3270] disabled:opacity-50"
                >
                  {createCustomOrderMutation.isPending ? "Creating..." : "Create Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal - Shows Custom Order Request Details */}
      {showUserDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Custom Order Request Details</h2>
              <button
                onClick={() => {
                  setShowUserDetailModal(false);
                  setSelectedUser(null);
                  setSelectedUserId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <img src={images.cross} className="w-6 h-6" alt="Close" />
              </button>
            </div>

            {userCartLoading ? (
              <LoadingSpinner message="Loading request details..." />
            ) : (
              <>
                {/* User Information */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">User Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {selectedUser.name || `${selectedUser.first_name} ${selectedUser.sur_name}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedUser.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedUser.phone}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">User ID:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedUser.id}</span>
                    </div>
                  </div>
                </div>

                {/* Audit Request Information */}
                {selectedUser.audit_requests && selectedUser.audit_requests.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Audit Request Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Total Requests:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {selectedUser.audit_request_count || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Pending:</span>
                        <span className="ml-2 font-medium text-orange-600">
                          {selectedUser.pending_count || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Approved:</span>
                        <span className="ml-2 font-medium text-green-600">
                          {selectedUser.approved_count || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Last Request:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {selectedUser.last_audit_request_date
                            ? formatDate(selectedUser.last_audit_request_date)
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <h4 className="font-medium text-gray-700 text-sm">Audit Requests:</h4>
                      {selectedUser.audit_requests.map((request: any) => (
                        <div
                          key={request.id}
                          className="bg-white rounded p-3 border border-gray-200 text-xs"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium">
                                {request.audit_type === "commercial"
                                  ? "Commercial / Industrial"
                                  : request.audit_subtype === "office"
                                    ? "Office"
                                    : request.audit_subtype === "home"
                                      ? "Home"
                                      : "Home / Office"}
                              </span>
                              <span
                                className={`ml-2 px-2 py-1 rounded text-xs ${
                                  request.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : request.status === "pending"
                                    ? "bg-orange-100 text-orange-800"
                                    : request.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {request.status}
                              </span>
                            </div>
                            {request.needs_admin_input ? (
                              <span className="text-yellow-600 font-medium">⚠️ Needs Details</span>
                            ) : request.has_property_details ? (
                              <span className="text-green-600 font-medium">✓ Details Shared</span>
                            ) : (
                              <span className="text-gray-500 font-medium">No Details</span>
                            )}
                          </div>
                          {request.has_property_details && request.property_address && (
                            <div className="text-gray-600 mt-2 bg-green-50 p-2 rounded">
                              <div className="font-medium text-green-800 mb-1">Shared Property Details:</div>
                              {request.company_name && (
                                <div>
                                  <span className="font-medium">Company:</span> {request.company_name}
                                </div>
                              )}
                              <div>
                                <span className="font-medium">Address:</span> {request.property_address}
                              </div>
                              {request.property_state && (
                                <div>
                                  <span className="font-medium">State:</span> {request.property_state}
                                </div>
                              )}
                              {(request.preferred_audit_date || request.preferred_audit_time) && (
                                <div>
                                  <span className="font-medium">Preferred schedule:</span>{" "}
                                  {formatAuditPreferredSchedule(request)}
                                </div>
                              )}
                              {request.property_floors && (
                                <div>
                                  <span className="font-medium">Floors:</span> {request.property_floors}
                                </div>
                              )}
                              {request.property_rooms != null && request.property_rooms !== "" && (
                                <div>
                                  <span className="font-medium">
                                    {request.audit_subtype === "office" ? "Office spaces:" : "Rooms:"}
                                  </span>{" "}
                                  {request.property_rooms}
                                </div>
                              )}
                              {request.is_gated_estate !== undefined && (
                                <div>
                                  <span className="font-medium">Gated Estate:</span>{" "}
                                  {request.is_gated_estate ? "Yes" : "No"}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cart/Request Details */}
                {(() => {
                  const cartPayload = getApiData(userCartResponse);
                  return cartPayload ? (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Custom Order Cart</h3>
                    
                    {/* Cart Items */}
                    {cartPayload.cart_items?.length > 0 ? (
                      <>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                                  Item
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                                  Type
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                                  Quantity
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                                  Unit Price
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                                  Subtotal
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {cartPayload.cart_items.map((item: any) => (
                                <tr key={item.id}>
                                  <td className="px-4 py-3 text-sm">
                                    {item.itemable?.title || item.name || `Item ${item.id}`}
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                      {item.itemable_type?.includes("Product") ? "Product" : "Bundle"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm">{item.quantity}</td>
                                  <td className="px-4 py-3 text-sm">
                                    {formatCurrency(item.unit_price)}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium">
                                    {formatCurrency(item.subtotal)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => {
                                        if (
                                          confirm(
                                            "Are you sure you want to remove this item?"
                                          )
                                        ) {
                                          removeCartItemMutation.mutate({
                                            userId: selectedUserId!,
                                            itemId: item.id,
                                          });
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Cart Total */}
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                          <span className="text-lg font-semibold">Total Amount:</span>
                          <span className="text-lg font-bold text-[#273E8E]">
                            {formatCurrency(cartPayload.total_amount || 0)}
                          </span>
                        </div>

                        {selectedUser.has_cart_access_token && (
                          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            Custom order link has been sent to this user.
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="text-gray-600 font-medium">Resend link as:</span>
                          <select
                            value={detailResendOrderType}
                            onChange={(e) =>
                              setDetailResendOrderType(e.target.value as "buy_now" | "bnpl")
                            }
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="buy_now">Buy Now (cart & checkout)</option>
                            <option value="bnpl">BNPL (application flow)</option>
                          </select>
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-3 pt-4 border-t">
                          <button
                            onClick={() => {
                              setShowUserDetailModal(false);
                              setCreateOrderForm({
                                user_id: selectedUser.id.toString(),
                                order_type: "buy_now",
                                items: [],
                                send_email: true,
                                email_message: "",
                              });
                              setSelectedProducts([]);
                              setShowCreateOrderModal(true);
                            }}
                            className="px-6 py-2 bg-[#273E8E] text-white rounded-lg text-sm font-medium hover:bg-[#1e3270]"
                          >
                            Add Items to Cart
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to clear the entire cart?"
                                )
                              ) {
                                clearUserCartMutation.mutate(selectedUserId!);
                              }
                            }}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                          >
                            Clear Cart
                          </button>
                          <button
                            onClick={() => {
                              resendCartEmailMutation.mutate({
                                userId: selectedUserId!,
                                payload: { order_type: detailResendOrderType },
                              });
                            }}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                          >
                            Resend Cart Link
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                        <p className="mb-4">This user's cart is currently empty.</p>
                        <button
                          onClick={() => {
                            setShowUserDetailModal(false);
                            setCreateOrderForm({
                              user_id: selectedUser.id.toString(),
                              order_type: "buy_now",
                              items: [],
                              send_email: true,
                              email_message: "",
                            });
                            setSelectedProducts([]);
                            setShowCreateOrderModal(true);
                          }}
                          className="px-6 py-2 bg-[#273E8E] text-white rounded-lg text-sm font-medium hover:bg-[#1e3270]"
                        >
                          Add Items to Cart
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                    <p className="mb-4">No cart data available for this user.</p>
                    <button
                      onClick={() => {
                        setShowUserDetailModal(false);
                        setCreateOrderForm({
                          user_id: selectedUser.id.toString(),
                          order_type: "buy_now",
                          items: [],
                          send_email: true,
                          email_message: "",
                        });
                        setSelectedProducts([]);
                        setShowCreateOrderModal(true);
                      }}
                      className="px-6 py-2 bg-[#273E8E] text-white rounded-lg text-sm font-medium hover:bg-[#1e3270]"
                    >
                      Add Items to Cart
                    </button>
                  </div>
                );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* User Cart Modal (Legacy - keeping for backward compatibility) */}
      {showUserCartModal && selectedUserId && (
        <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">User Cart</h2>
              <button
                onClick={() => {
                  setShowUserCartModal(false);
                  setSelectedUserId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <img src={images.cross} className="w-6 h-6" alt="Close" />
              </button>
            </div>

            {userCartLoading ? (
              <LoadingSpinner message="Loading cart..." />
            ) : (userCartResponse as any)?.data ? (
              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold">
                    {(userCartResponse as any).data.user?.name || "User"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {(userCartResponse as any).data.user?.email}
                  </p>
                </div>

                {/* Cart Items */}
                {(userCartResponse as any).data.cart_items?.length > 0 ? (
                  <>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Item
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Quantity
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Unit Price
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Subtotal
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(userCartResponse as any).data.cart_items.map((item: any) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3 text-sm">
                                {item.itemable?.title || `Item ${item.id}`}
                              </td>
                              <td className="px-4 py-3 text-sm">{item.quantity}</td>
                              <td className="px-4 py-3 text-sm">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">
                                {formatCurrency(item.subtotal)}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Are you sure you want to remove this item?"
                                      )
                                    ) {
                                      removeCartItemMutation.mutate({
                                        userId: selectedUserId,
                                        itemId: item.id,
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Cart Total */}
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-lg font-bold text-[#273E8E]">
                        {formatCurrency((userCartResponse as any).data.total_amount || 0)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                      <span className="text-gray-600 font-medium">Resend link as:</span>
                      <select
                        value={detailResendOrderType}
                        onChange={(e) =>
                          setDetailResendOrderType(e.target.value as "buy_now" | "bnpl")
                        }
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="buy_now">Buy Now (cart & checkout)</option>
                        <option value="bnpl">BNPL (application flow)</option>
                      </select>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to clear the entire cart?"
                            )
                          ) {
                            clearUserCartMutation.mutate(selectedUserId);
                          }
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                      >
                        Clear Cart
                      </button>
                      <button
                        onClick={() => {
                          resendCartEmailMutation.mutate({
                            userId: selectedUserId,
                            payload: { order_type: detailResendOrderType },
                          });
                        }}
                        className="px-4 py-2 bg-[#273E8E] text-white rounded-lg text-sm font-medium hover:bg-[#1e3270]"
                      >
                        Resend Cart Link
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Cart is empty
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Failed to load cart
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default BNPLBuyNow;

