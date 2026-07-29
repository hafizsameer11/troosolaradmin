import images from "../../constants/images";
import { useState, useEffect } from "react";

import { useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { getSingleOrder } from "../../utils/queries/orders";
import { API_DOMAIN } from "../../../apiConfig";

const formatNgn = (v: string | number | undefined | null) => {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `₦${n.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatInvoiceAmount = (value: string | number | undefined | null) =>
  Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface OrderLineItem {
  itemable_type?: string;
  quantity?: number;
  unit_price?: string | number;
  subtotal?: string | number;
  /** Catalog / list price before online checkout discount (when applicable) */
  list_unit_price?: string | number;
  referral_outright_discount_percent?: string | number;
  item?: {
    title?: string;
    subtitle?: string;
    featured_image?: string | null;
  } | null;
}

interface OrderDetailModalProps {
  isOpen: boolean;
  order: {
    id: number;
    order_number?: string;
    order_status?: string;
    payment_status?: string;
    payment_method?: string;
    total_price?: string | number;
    created_at?: string;
    delivery_address?: {
      address?: string;
      phone_number?: string;
      contact_name?: string;
      title?: string;
      state?: string;
    } | null;
    items?: OrderLineItem[];
    items_subtotal?: number;
    /** Pre-discount sum of line list prices (shop checkout) */
    catalog_items_subtotal?: number | null;
    /** Total checkout discount vs catalog (matches customer receipt) */
    online_checkout_discount_amount?: number | null;
    delivery_fee?: number | string;
    insurance_fee?: number | string;
    insurance_fee_percentage?: number | string;
    installation_price?: number | string;
    inspection_fee?: number | string;
    material_cost?: number | string;
    include_installation?: boolean;
    installation_requested_date?: string | null;
    vat_amount?: number | string;
    vat_percentage?: number | string;
    outright_discount_percentage?: number | string | null;
    order_type?: string | null;
    estimated_delivery_from?: string;
    estimated_delivery_to?: string;
    delivery_estimate_label?: string;
    user_info?: {
      name?: string;
      phone?: string;
      email?: string;
      first_name?: string;
      sur_name?: string;
    };
    include_user_info?: {
      first_name?: string;
      phone?: string;
    };
    installation?: {
      installation_date?: string;
      installation_fee?: string;
      technician_name?: string;
    };
  } | null;
  onClose: () => void;
}

const OrderDetailModal = ({ isOpen, order, onClose }: OrderDetailModalProps) => {
  const token = Cookies.get("token");
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (order?.id) {
      setImageLoading({});
      setImageError({});
    }
  }, [order?.id]);

  const {
    data: apiData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["single-order-detail", order?.id],
    queryFn: () => getSingleOrder(order?.id || 0, token || ""),
    enabled: !!order?.id && isOpen,
  });

  if (!isOpen || !order) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 backdrop-brightness-50 flex items-end justify-end z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl flex items-center justify-center">
          <div className="py-12 text-center text-gray-500">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (isError || !apiData?.data) {
    return (
      <div className="fixed inset-0 backdrop-brightness-50 flex items-end justify-end z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl flex items-center justify-center">
          <div className="py-12 text-center text-red-500">Failed to load order details.</div>
        </div>
      </div>
    );
  }

  const data = apiData.data;
  const lineItems: OrderLineItem[] = Array.isArray(data.items) ? data.items : [];

  const getBaseUrl = () => {
    const apiDomain = API_DOMAIN || "http://localhost:8000/api";
    return apiDomain.replace(/\/api$/, "");
  };
  const baseImageUrl = getBaseUrl();

  const resolveImageSrc = (path: string | null | undefined) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const cleaned = path.startsWith("/") ? path : `/${path}`;
    return `${baseImageUrl}${cleaned}`;
  };

  const customerName = data.user_info?.name || data.include_user_info?.first_name || "—";
  const customerEmail = data.user_info?.email || "—";
  const customerPhone = data.user_info?.phone || data.include_user_info?.phone || "—";
  const deliveryAddress = data.delivery_address?.address || "—";
  const deliveryPhone = data.delivery_address?.phone_number || "—";
  const deliveryContact =
    data.delivery_address?.contact_name?.trim() ||
    data.delivery_address?.title?.trim() ||
    "—";
  const deliveryState = data.delivery_address?.state || "";

  const orderStatus = data.order_status || "—";
  const paymentStatus = data.payment_status || "—";
  const orderDate = data.created_at || "—";
  const paymentMethod = data.payment_method || "—";
  const installation = data.installation || null;

  const fmtEst = (iso: string | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const deliveryEstimateText =
    data.delivery_estimate_label ||
    (data.estimated_delivery_from && data.estimated_delivery_to
      ? `${fmtEst(data.estimated_delivery_from)} – ${fmtEst(data.estimated_delivery_to)}`
      : null) ||
    "—";

  const deliveryFeeNum = data.delivery_fee != null ? Number(data.delivery_fee) : 0;
  const installationNum =
    data.installation_price != null ? Number(data.installation_price) : 0;
  const insuranceNum = data.insurance_fee != null ? Number(data.insurance_fee) : 0;
  const inspectionNum =
    data.inspection_fee != null ? Number(data.inspection_fee) : 0;
  const materialNum =
    data.material_cost != null ? Number(data.material_cost) : 0;
  const vatNum = data.vat_amount != null ? Number(data.vat_amount) : 0;
  const vatPctNum = data.vat_percentage != null ? Number(data.vat_percentage) : 7.5;
  const insurancePctNum =
    data.insurance_fee_percentage != null
      ? Number(data.insurance_fee_percentage)
      : 0;

  const itemsFromLines =
    lineItems.length > 0
      ? lineItems.reduce((sum, row) => sum + Number(row.subtotal ?? 0), 0)
      : 0;

  const itemsSubtotalRaw =
    data.items_subtotal != null
      ? Number(data.items_subtotal)
      : itemsFromLines > 0
        ? itemsFromLines
        : 0;

  const catalogItemsSubtotalNum =
    data.catalog_items_subtotal != null && Number(data.catalog_items_subtotal) > 0
      ? Number(data.catalog_items_subtotal)
      : itemsSubtotalRaw;

  // Shop: snap reverse-VAT noise (e.g. ₦0.15) so Net Total matches checkout Item Subtotal.
  const isShopOrder = String(data.order_type || "").toLowerCase() === "shop";
  let itemsSubtotalNum = itemsSubtotalRaw;
  if (
    isShopOrder &&
    catalogItemsSubtotalNum > 0 &&
    (Math.abs(itemsSubtotalRaw - catalogItemsSubtotalNum) < 1 ||
      (catalogItemsSubtotalNum > itemsSubtotalRaw &&
        catalogItemsSubtotalNum - itemsSubtotalRaw < 1))
  ) {
    itemsSubtotalNum = catalogItemsSubtotalNum;
  }

  let onlineCheckoutDiscountNum =
    data.online_checkout_discount_amount != null
      ? Number(data.online_checkout_discount_amount)
      : 0;
  if (
    onlineCheckoutDiscountNum <= 0 &&
    catalogItemsSubtotalNum > itemsSubtotalNum + 0.005
  ) {
    onlineCheckoutDiscountNum = catalogItemsSubtotalNum - itemsSubtotalNum;
  }
  if (
    isShopOrder &&
    (onlineCheckoutDiscountNum < 1 ||
      (catalogItemsSubtotalNum > 0 &&
        Math.abs(itemsSubtotalNum - catalogItemsSubtotalNum) < 1))
  ) {
    onlineCheckoutDiscountNum = 0;
    itemsSubtotalNum = catalogItemsSubtotalNum > 0 ? catalogItemsSubtotalNum : itemsSubtotalNum;
  }

  const firstLineDiscountPct = lineItems.find(
    (r) => Number(r.referral_outright_discount_percent ?? 0) > 0
  )?.referral_outright_discount_percent;
  const outrightDiscountPctRaw =
    data.outright_discount_percentage != null
      ? Number(data.outright_discount_percentage)
      : firstLineDiscountPct != null
        ? Number(firstLineDiscountPct)
        : onlineCheckoutDiscountNum > 0 && catalogItemsSubtotalNum > 0
          ? Math.round(
              (onlineCheckoutDiscountNum / catalogItemsSubtotalNum) * 100
            )
          : 0;
  const outrightDiscountPct = Math.round(Number(outrightDiscountPctRaw) || 0);

  const serviceFeesTotal =
    deliveryFeeNum + installationNum + materialNum + inspectionNum;
  const totalAmountBeforeVatTax = itemsSubtotalNum + serviceFeesTotal;
  const grandTotalRaw =
    data.total_price != null ? Number(data.total_price) : NaN;
  const grandTotalNum =
    isShopOrder && Number.isFinite(grandTotalRaw)
      ? Math.round(grandTotalRaw * 100) / 100
      : grandTotalRaw;

  const preferredInstallDate =
    data.installation_requested_date ||
    installation?.installation_date ||
    null;

  const setImgLoading = (idx: number, v: boolean) => {
    setImageLoading((prev) => ({ ...prev, [idx]: v }));
  };
  const setImgErr = (idx: number, v: boolean) => {
    setImageError((prev) => ({ ...prev, [idx]: v }));
  };

  return (
    <div className="fixed inset-0 backdrop-brightness-50 flex items-end justify-end z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-gray-900">Order Details</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer">
            <img src={images.cross} alt="" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="text-center p-4 border-b border-gray-100 bg-gray-50/80">
            <div
              className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-2 ${
                orderStatus === "delivered"
                  ? "bg-green-100"
                  : orderStatus === "pending"
                    ? "bg-orange-100"
                    : "bg-blue-100"
              }`}
            >
              {orderStatus === "delivered" ? (
                <img src={images.tick} alt="" className="w-8 h-8" />
              ) : orderStatus === "pending" ? (
                <svg className="w-7 h-7 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium text-gray-900">
              {orderStatus === "delivered"
                ? "Delivered"
                : orderStatus === "pending"
                  ? "Processing"
                  : "Order"}
            </p>
            <p className="text-xs text-gray-600 mt-1">Placed: {orderDate}</p>
            <div
              className={`text-xs px-3 py-1 rounded-full inline-block mt-2 ${
                orderStatus === "delivered"
                  ? "bg-green-50 text-green-700"
                  : orderStatus === "pending"
                    ? "bg-orange-50 text-orange-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              Order #{data.order_number || data.id || "—"}
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Line items */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Products</h3>
              <div className="space-y-3">
                {lineItems.length === 0 ? (
                  <p className="text-xs text-gray-500 border rounded-xl p-3">No line items.</p>
                ) : (
                  lineItems.map((row, idx) => {
                    const title = row.item?.title || "Item";
                    const subtitle = row.item?.subtitle;
                    const qty = Number(row.quantity) || 0;
                    const unit = row.unit_price;
                    const sub = row.subtotal;
                    const listUnit = row.list_unit_price;
                    const listNum = listUnit != null ? Number(listUnit) : NaN;
                    const unitNum = unit != null ? Number(unit) : NaN;
                    const showListVsCharged =
                      Number.isFinite(listNum) &&
                      Number.isFinite(unitNum) &&
                      listNum > unitNum + 0.005;
                    const linePct = row.referral_outright_discount_percent;
                    const imgPath = row.item?.featured_image;
                    const src = imgPath ? resolveImageSrc(imgPath) : "";
                    const loading = imageLoading[idx] !== false && !!src;
                    const err = imageError[idx];

                    return (
                      <div
                        key={`${row.itemable_type}-${idx}-${row.item?.title}`}
                        className="flex gap-3 p-3 bg-white border border-gray-200 rounded-xl"
                      >
                        <div className="w-16 h-16 bg-[#F3F3F3] rounded-xl flex-shrink-0 overflow-hidden relative">
                          {src && !err ? (
                            <>
                              {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#273E8E]" />
                                </div>
                              )}
                              <img
                                src={src}
                                alt=""
                                className={`w-full h-full object-cover ${loading ? "opacity-0" : "opacity-100"}`}
                                onLoad={() => {
                                  setImgLoading(idx, false);
                                  setImgErr(idx, false);
                                }}
                                onError={() => {
                                  setImgLoading(idx, false);
                                  setImgErr(idx, true);
                                }}
                              />
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px] text-center px-1">
                              No img
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="text-sm font-medium text-gray-900 leading-snug">{title}</p>
                          {subtitle ? (
                            <p className="text-gray-500 mt-0.5 line-clamp-2">{subtitle}</p>
                          ) : null}
                          <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                            <div className="flex justify-between gap-2">
                              <span>Quantity</span>
                              <span className="text-gray-900 font-medium">{qty}</span>
                            </div>
                            {showListVsCharged ? (
                              <>
                                <div className="flex justify-between gap-2">
                                  <span>List unit (before checkout discount)</span>
                                  <span className="text-gray-500 line-through">{formatNgn(listUnit)}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span>Unit charged</span>
                                  <span className="text-gray-900 font-medium">{formatNgn(unit)}</span>
                                </div>
                                {linePct != null && Number(linePct) > 0 ? (
                                  <p className="text-[10px] text-amber-800 bg-amber-50 rounded px-1.5 py-0.5">
                                    Checkout discount: {Number(linePct)}% off list
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <div className="flex justify-between gap-2">
                                <span>Unit price</span>
                                <span className="text-gray-900">{formatNgn(unit)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-2 pt-1 border-t border-gray-100">
                              <span className="font-medium text-gray-800">Line subtotal</span>
                              <span className="font-semibold text-[#273E8E]">{formatNgn(sub)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Order placed: {orderDate}</p>
            </div>

            {/* Customer */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Customer</h3>
              <div className="p-4 border border-gray-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Name</span>
                  <span className="text-gray-900 font-medium text-right">{customerName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Email</span>
                  <span className="text-gray-900 text-right break-all">{customerEmail}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Phone</span>
                  <span className="text-gray-900">{customerPhone}</span>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
                  <span className="text-gray-500">Order status</span>
                  <span
                    className={`font-medium ${
                      orderStatus === "delivered"
                        ? "text-green-600"
                        : orderStatus === "pending"
                          ? "text-orange-600"
                          : "text-blue-600"
                    }`}
                  >
                    {orderStatus}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Payment status</span>
                  <span className="text-gray-900 capitalize">{paymentStatus}</span>
                </div>
              </div>
            </div>

            {/* Delivery & timelines */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Delivery &amp; scheduling</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-xs">
                <div className="p-4 bg-[#EDEDED]/80 border-b border-gray-200">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Delivery address</p>
                  <p className="text-[11px] text-gray-500 mt-1">Site / recipient name</p>
                  <p className="text-sm text-gray-900">{deliveryContact}</p>
                  <p className="text-[11px] text-gray-500 mt-2">Address</p>
                  <p className="text-sm text-gray-900">{deliveryAddress}</p>
                  {deliveryState ? (
                    <p className="text-sm text-gray-700 mt-1">State: {deliveryState}</p>
                  ) : null}
                  <p className="text-[11px] text-gray-500 mt-2">Phone</p>
                  <p className="text-sm text-gray-900">{deliveryPhone}</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-600">Estimated delivery</span>
                    <span className="text-gray-900 text-right max-w-[58%]">{deliveryEstimateText}</span>
                  </div>
                  {data.estimated_delivery_from && data.estimated_delivery_to ? (
                    <p className="text-[11px] text-gray-500">
                      Window: {fmtEst(data.estimated_delivery_from)} → {fmtEst(data.estimated_delivery_to)}
                    </p>
                  ) : null}
                  {data.include_installation || installationNum > 0 || preferredInstallDate ? (
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
                        Installation
                      </p>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600">Installation included</span>
                        <span className="text-gray-900">{data.include_installation ? "Yes" : "No"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600">Preferred / scheduled date</span>
                        <span className="text-gray-900 text-right">
                          {preferredInstallDate ? fmtEst(preferredInstallDate) || preferredInstallDate : "—"}
                        </span>
                      </div>
                      {installation?.technician_name ? (
                        <p className="text-[11px] text-gray-500">
                          Technician: {installation.technician_name}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Payment summary — same breakdown as customer invoice / PaymentSummaryCard */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                  Payment summary
                </h3>
              </div>
              <div className="px-4 py-2 text-sm">
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                  <span className="text-gray-600">Payment method</span>
                  <span className="text-gray-900 capitalize font-medium">{paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-gray-700">Item Subtotal</span>
                  <span className="font-semibold tabular-nums text-gray-900">
                    ₦{formatInvoiceAmount(catalogItemsSubtotalNum)}
                  </span>
                </div>
                {onlineCheckoutDiscountNum >= 1 ? (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-gray-700">
                      {outrightDiscountPct > 0
                        ? `Discount (${outrightDiscountPct}%)`
                        : "Discount"}
                    </span>
                    <span className="font-semibold tabular-nums text-green-700">
                      -₦{formatInvoiceAmount(onlineCheckoutDiscountNum)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between items-center py-2.5 font-medium">
                  <span className="text-gray-700">Net Total</span>
                  <span className="font-semibold tabular-nums text-gray-900">
                    ₦{formatInvoiceAmount(itemsSubtotalNum)}
                  </span>
                </div>
                <hr className="border-0 border-t border-gray-300 my-1" />
                {deliveryFeeNum > 0 ? (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-gray-700">Delivery Fee</span>
                    <span className="font-semibold tabular-nums text-gray-900">
                      +₦{formatInvoiceAmount(deliveryFeeNum)}
                    </span>
                  </div>
                ) : null}
                {installationNum > 0 ? (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-gray-700">Installation Fee</span>
                    <span className="font-semibold tabular-nums text-gray-900">
                      +₦{formatInvoiceAmount(installationNum)}
                    </span>
                  </div>
                ) : null}
                {inspectionNum > 0 ? (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-gray-700">Inspection Fee</span>
                    <span className="font-semibold tabular-nums text-gray-900">
                      +₦{formatInvoiceAmount(inspectionNum)}
                    </span>
                  </div>
                ) : null}
                {materialNum > 0 ? (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-gray-700">Installation Materials Cost</span>
                    <span className="font-semibold tabular-nums text-gray-900">
                      +₦{formatInvoiceAmount(materialNum)}
                    </span>
                  </div>
                ) : null}
                <hr className="border-0 border-t border-gray-300 my-1" />
                <div className="flex justify-between items-center py-2.5 font-medium">
                  <span className="text-gray-700">Total Amount</span>
                  <span className="font-semibold tabular-nums text-gray-900">
                    ₦{formatInvoiceAmount(totalAmountBeforeVatTax)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-gray-700">
                    VAT ({vatPctNum}% of Total Amount)
                  </span>
                  <span className="font-semibold tabular-nums text-gray-900">
                    +₦{formatInvoiceAmount(vatNum)}
                  </span>
                </div>
                {insuranceNum > 0 ? (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-gray-700">
                      Insurance Fee (
                      {insurancePctNum > 0 ? `${insurancePctNum}%` : "—"} of
                      Item Subtotal)
                    </span>
                    <span className="font-semibold tabular-nums text-gray-900">
                      +₦{formatInvoiceAmount(insuranceNum)}
                    </span>
                  </div>
                ) : null}
                <hr className="border-0 border-t border-gray-300 my-1" />
                <div className="flex justify-between items-center py-3">
                  <span className="font-bold text-base uppercase text-[#273e8e] tracking-wide">
                    Grand Total
                  </span>
                  <span className="font-bold text-xl text-[#273e8e] tabular-nums">
                    ₦
                    {formatInvoiceAmount(
                      Number.isFinite(grandTotalNum) ? grandTotalNum : 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
