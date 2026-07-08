import React, { useState } from "react";
import Header from "../../component/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { getAllBundles } from "../../utils/queries/bundle";
import { addBundle, updateBundle, deleteBundle } from "../../utils/mutations/bundle";
import { getBundleMaterials } from "../../utils/queries/bundleMaterials";
import {
  addBundleMaterial,
  updateBundleMaterial,
  deleteBundleMaterial,
} from "../../utils/mutations/bundleMaterials";
import { getAllMaterials } from "../../utils/queries/materials";
import { getAllBrands } from "../../utils/queries/brands";
import { getSingleBundle } from "../../utils/queries/bundle";
import { updateMaterial } from "../../utils/mutations/materials";
import { getCalculatorSettings } from "../../utils/queries/calculator";
import { updateCalculatorSettings } from "../../utils/mutations/calculator";
import { isBillableInvoiceFeeRow } from "../../utils/invoiceFees";

// Types
interface ApiBrand {
  id: number;
  title: string;
  icon?: string;
  category_id?: number;
}

interface BundleSpecifications {
  company_oem?: string;
  inverter_capacity_kva?: string;
  voltage?: string;
  battery_type?: string;
  battery_capacity_kwh?: string;
  inverter_warranty?: string;
  battery_warranty?: string;
  solar_panel_capacity_w?: string;
  solar_panel_capacity_kw?: string;
  backup_time_range?: string;
  solar_panel_type?: string;
  solar_panels_wattage?: string;
  solar_panels_warranty?: string;
}

interface Bundle {
  id: number;
  title: string;
  bundle_type: string;
  is_available?: boolean;
  brand_id?: number | null;
  brand?: { id: number; title: string } | null;
  total_price: number;
  discount_price: number;
  inver_rating?: string;
  total_output?: string;
  total_load?: string | null;
  bundleItems?: any[];
  customServices?: any[];
  featured_image?: string;
  featured_image_url?: string;
  detailed_description?: string;
  product_model?: string;
  system_capacity_display?: string;
  what_is_inside_bundle_text?: string;
  what_bundle_powers_text?: string;
  backup_time_description?: string;
  specifications?: BundleSpecifications | null;
  created_at?: string;
  updated_at?: string;
}

interface BundleMaterial {
  id: number;
  bundle_id: number;
  material_id: number;
  quantity: string;
  created_at?: string;
  updated_at?: string;
  material: {
    id: number;
    name: string;
    unit: string;
    warranty?: number;
    category: {
      id: number;
      name: string;
    };
  };
}

interface Material {
  id: number;
  material_category_id: number;
  name: string;
  unit: string;
  warranty?: number;
  rate: string;
  selling_rate: string;
  profit: string;
  sort_order: number;
  is_active: boolean;
  category?: {
    id: number;
    name: string;
    code: string;
  };
}

const DEFAULT_BUNDLE_TYPES = ["Inverter + Battery", "Solar+Inverter+Battery"];

const BundleMgt = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [bundleTypeFilter, setBundleTypeFilter] = useState<string>("all");
  const [bundleTypeOptions, setBundleTypeOptions] = useState<string[]>(DEFAULT_BUNDLE_TYPES);
  const [newBundleType, setNewBundleType] = useState("");
  
  // Modal states
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [bundleFormData, setBundleFormData] = useState({
    title: "",
    bundle_type: DEFAULT_BUNDLE_TYPES[0],
    is_available: true,
    brand_id: "" as string | number,
    total_price: "",
    discount_price: "",
    inver_rating: "",
    total_output: "",
    total_load: "",
    system_capacity_display: "",
    description: "",
    product_model: "",
    what_is_inside: "",
    what_it_powers: "",
    backup_time_description: "",
  });
  // Dynamic specification rows: [{id, key, value}]
  const [specRows, setSpecRows] = useState<{ id: number; key: string; value: string }[]>([]);
  const specDragIdx = React.useRef<number | null>(null);
  const specDragOverIdx = React.useRef<number | null>(null);
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);

  // Material management states
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<BundleMaterial | null>(null);
  const [materialFormData, setMaterialFormData] = useState({
    material_id: "",
    quantity: "",
  });
  const [showDeleteMaterialModal, setShowDeleteMaterialModal] = useState(false);
  const [deleteMaterialTarget, setDeleteMaterialTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Order List modal states
  const [showOrderListModal, setShowOrderListModal] = useState(false);
  const [orderListBundle, setOrderListBundle] = useState<Bundle | null>(null);
  const [orderListFlow, setOrderListFlow] = useState<"buy_now" | "bnpl">("buy_now");
  const [orderListTab, setOrderListTab] = useState<"orderlist" | "invoice">("orderlist");

  type OlEditRow = {
    id: number;
    title: string;
    amount: string;
    quantity: string;
    unit: string;
    quantityApplies: boolean;
    visibility: "both" | "troosolar" | "own";
  };
  type FeeEditRow = {
    id: number;
    title: string;
    amount: string;
    visibility: "both" | "troosolar" | "own";
  };
  type FlowOrderConfig = { orderItems: OlEditRow[]; fees: FeeEditRow[] };

  const emptyFlowOrderConfig = (): FlowOrderConfig => ({ orderItems: [], fees: [] });

  // Editable order list state — keyed by checkout flow, then "mat-{id}" for materials
  const [editMatRate, setEditMatRate] = useState<Record<string, string>>({});
  const [flowConfigs, setFlowConfigs] = useState<Record<"buy_now" | "bnpl", FlowOrderConfig>>({
    buy_now: emptyFlowOrderConfig(),
    bnpl: emptyFlowOrderConfig(),
  });
  const editOrderItems = flowConfigs[orderListFlow].orderItems;
  const editSvc = flowConfigs[orderListFlow].fees;
  const setEditOrderItems = (updater: React.SetStateAction<OlEditRow[]>) => {
    setFlowConfigs((prev) => {
      const current = prev[orderListFlow].orderItems;
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [orderListFlow]: { ...prev[orderListFlow], orderItems: next } };
    });
    setOrderListDirty(true);
  };
  const setEditSvc = (updater: React.SetStateAction<FeeEditRow[]>) => {
    setFlowConfigs((prev) => {
      const current = prev[orderListFlow].fees;
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [orderListFlow]: { ...prev[orderListFlow], fees: next } };
    });
    setOrderListDirty(true);
  };
  const [orderListDirty, setOrderListDirty] = useState(false);
  const [savingOrderList, setSavingOrderList] = useState(false);
  /** Simulates customer dashboard: Troosolar vs own installer for read-only invoice preview */
  const [invoicePreviewAsInstaller, setInvoicePreviewAsInstaller] = useState<"troosolar" | "own">("troosolar");
  const OL_PREFIX = "[OL]";
  const OL_VIS_TROO_PREFIX = "[OL:TROOSOLAR]";
  const OL_VIS_OWN_PREFIX = "[OL:OWN]";
  const parseOrderItemVisibility = (title: string) => {
    if (title.startsWith(OL_VIS_TROO_PREFIX)) return "troosolar" as const;
    if (title.startsWith(OL_VIS_OWN_PREFIX)) return "own" as const;
    if (title.startsWith(OL_PREFIX)) return "both" as const;
    return "both" as const;
  };

  const stripOrderItemPrefix = (title: string) => {
    if (title.startsWith(OL_VIS_TROO_PREFIX)) return title.slice(OL_VIS_TROO_PREFIX.length).trim();
    if (title.startsWith(OL_VIS_OWN_PREFIX)) return title.slice(OL_VIS_OWN_PREFIX.length).trim();
    if (title.startsWith(OL_PREFIX)) return title.slice(OL_PREFIX.length).trim();
    return title;
  };

  const encodeOrderItemTitleWithVisibility = (title: string, visibility: "both" | "troosolar" | "own") => {
    const clean = title.trim();
    if (visibility === "troosolar") return `${OL_VIS_TROO_PREFIX}${clean}`;
    if (visibility === "own") return `${OL_VIS_OWN_PREFIX}${clean}`;
    return `${OL_PREFIX}${clean}`;
  };

  const FEE_VIS_TROO_PREFIX = "[FEE:TROOSOLAR]";
  const FEE_VIS_OWN_PREFIX = "[FEE:OWN]";
  /** Explicit "Both" for fees (order list uses [OL] for both; fees must not be saved plain or heuristics remap e.g. "installation fee" → troosolar). */
  const FEE_VIS_BOTH_PREFIX = "[FEE]";

  const parseFeeVisibility = (title: string) => {
    if (title.startsWith(FEE_VIS_TROO_PREFIX)) return "troosolar" as const;
    if (title.startsWith(FEE_VIS_OWN_PREFIX)) return "own" as const;
    if (title.startsWith(FEE_VIS_BOTH_PREFIX)) return "both" as const;
    const lower = title.toLowerCase();
    // Backward-compatible defaults for existing untagged fee names (legacy rows only)
    if (lower.includes("installation fee") || lower.includes("inspection fee")) return "troosolar" as const;
    if (lower.includes("delivery fee") || lower.includes("delivery/logistics")) return "both" as const;
    return "both" as const;
  };

  const stripFeeVisibilityPrefix = (title: string) => {
    if (title.startsWith(FEE_VIS_TROO_PREFIX)) return title.slice(FEE_VIS_TROO_PREFIX.length).trim();
    if (title.startsWith(FEE_VIS_OWN_PREFIX)) return title.slice(FEE_VIS_OWN_PREFIX.length).trim();
    if (title.startsWith(FEE_VIS_BOTH_PREFIX)) return title.slice(FEE_VIS_BOTH_PREFIX.length).trim();
    return title;
  };

  const rowVisibleForInvoicePreview = (
    visibility: "both" | "troosolar" | "own",
    previewAs: "troosolar" | "own"
  ) => {
    if (visibility === "troosolar") return previewAs === "troosolar";
    if (visibility === "own") return previewAs === "own";
    return true;
  };

  const encodeFeeTitleWithVisibility = (title: string, visibility: "both" | "troosolar" | "own") => {
    const clean = title.trim();
    if (visibility === "troosolar") return `${FEE_VIS_TROO_PREFIX}${clean}`;
    if (visibility === "own") return `${FEE_VIS_OWN_PREFIX}${clean}`;
    return `${FEE_VIS_BOTH_PREFIX}${clean}`;
  };

  const token = Cookies.get("token") || "";
  const queryClient = useQueryClient();

  const { data: calculatorSettingsData } = useQuery({
    queryKey: ["calculator-settings"],
    queryFn: () => getCalculatorSettings(token),
    enabled: !!token,
  });

  React.useEffect(() => {
    const payload = (calculatorSettingsData as any)?.data || {};
    const configured = Array.isArray(payload?.bundle_types)
      ? payload.bundle_types
      : DEFAULT_BUNDLE_TYPES;
    const normalized = configured
      .map((v: unknown) => String(v ?? "").trim())
      .filter(Boolean);
    setBundleTypeOptions(normalized.length ? Array.from(new Set(normalized)) : DEFAULT_BUNDLE_TYPES);
  }, [calculatorSettingsData]);

  const saveBundleTypesMutation = useMutation({
    mutationFn: (types: string[]) => updateCalculatorSettings({ bundle_types: types }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-settings"] });
      setNewBundleType("");
    },
  });

  // Fetch bundles
  const {
    data: bundlesData,
    isLoading: bundlesLoading,
    isError: bundlesError,
  } = useQuery({
    queryKey: ["bundles", bundleTypeFilter],
    queryFn: () =>
      getAllBundles(token, {
        bundle_type: bundleTypeFilter !== "all" ? bundleTypeFilter : undefined,
      }),
    enabled: !!token,
  });

  const bundles: Bundle[] = (bundlesData as any)?.data || (bundlesData as any) || [];

  // Fetch materials for dropdown
  const { data: materialsData } = useQuery({
    queryKey: ["materials"],
    queryFn: () => getAllMaterials(token),
    enabled: !!token && showAddMaterialModal,
  });

  const allMaterials: Material[] =
    (materialsData as any)?.data || (materialsData as any) || [];

  // Fetch brands for bundle form (fetch always so it's ready when modal opens)
  const { data: brandsData } = useQuery({
    queryKey: ["brands"],
    queryFn: () => getAllBrands(token),
    enabled: !!token,
  });
  const apiBrands: ApiBrand[] = (brandsData as any)?.data || [];

  // Fetch bundle materials
  const {
    data: bundleMaterialsData,
    isLoading: bundleMaterialsLoading,
  } = useQuery({
    queryKey: ["bundle-materials", selectedBundle?.id],
    queryFn: () => getBundleMaterials(selectedBundle!.id, token),
    enabled: !!token && !!selectedBundle && showMaterialsModal,
  });

  // Fetch full bundle details for Order List modal
  const {
    data: bundleDetailsData,
    isLoading: bundleDetailsLoading,
  } = useQuery({
    queryKey: ["bundle-details", orderListBundle?.id],
    queryFn: () => getSingleBundle(String(orderListBundle!.id), token),
    enabled: !!token && !!orderListBundle && showOrderListModal,
  });

  const bundleDetails: any = (bundleDetailsData as any)?.data || null;

  const dedupeFeeRows = (fees: FeeEditRow[]): FeeEditRow[] => {
    const seen = new Set<string>();
    return fees.filter((fee) => {
      const key = `${fee.title.trim().toLowerCase()}|${fee.visibility}|${fee.amount}`;
      if (!fee.title.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const dedupeOrderRows = (items: OlEditRow[]): OlEditRow[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = [
        item.title.trim().toLowerCase(),
        item.visibility,
        item.amount,
        item.quantity,
        item.unit,
        item.quantityApplies ? "1" : "0",
      ].join("|");
      if (!item.title.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const normalizeFlowConfig = (config: FlowOrderConfig): FlowOrderConfig => ({
    orderItems: dedupeOrderRows(config.orderItems),
    fees: dedupeFeeRows(config.fees),
  });

  // Initialize editable state when bundle details load
  React.useEffect(() => {
    if (!bundleDetails) return;
    if (orderListDirty) return;

    const matRateMap: Record<string, string> = {};
    (bundleDetails.bundle_materials || []).forEach((bm: any) => {
      const key = `mat-${bm.material_id}`;
      const rate = bm.rate_override ?? bm.material?.selling_rate ?? bm.material?.rate ?? 0;
      matRateMap[key] = String(rate);
    });
    setEditMatRate(matRateMap);

    // ── 1. Parse custom_services → per-flow order items + invoice fees ──
    const allServices = (bundleDetails.custom_services || []) as any[];
    const parseServicesForFlow = (flow: "buy_now" | "bnpl"): FlowOrderConfig => {
      const olItems: OlEditRow[] = [];
      const feeItems: FeeEditRow[] = [];
      allServices
        .filter((svc) => (svc.flow_type || "buy_now") === flow)
        .forEach((svc: any) => {
          const rawTitle = svc.title || "";
          if (rawTitle.startsWith(OL_PREFIX) || rawTitle.startsWith(OL_VIS_TROO_PREFIX) || rawTitle.startsWith(OL_VIS_OWN_PREFIX)) {
            const stripped = stripOrderItemPrefix(rawTitle);
            if (stripped) {
              const qtyRaw = svc.quantity ?? 1;
              const qtyAppliesRaw = svc.quantity_applies ?? svc.quantity_applicable ?? svc.is_quantity_applicable;
              const qtyApplies = qtyAppliesRaw === undefined || qtyAppliesRaw === null
                ? true
                : !(String(qtyAppliesRaw).toLowerCase() === "false" || String(qtyAppliesRaw) === "0");
              olItems.push({
                id: svc.id,
                title: stripped,
                amount: String(svc.service_amount || 0),
                quantity: String(qtyRaw || 1),
                unit: String(svc.unit || "Nos"),
                quantityApplies: qtyApplies,
                visibility: parseOrderItemVisibility(rawTitle),
              });
            }
          } else {
            feeItems.push({
              id: svc.id,
              title: stripFeeVisibilityPrefix(rawTitle),
              amount: String(svc.service_amount || 0),
              visibility: parseFeeVisibility(rawTitle),
            });
          }
        });
      return { orderItems: dedupeOrderRows(olItems), fees: dedupeFeeRows(feeItems) };
    };

    let buyNowConfig = normalizeFlowConfig(parseServicesForFlow("buy_now"));
    let bnplConfig = normalizeFlowConfig(parseServicesForFlow("bnpl"));

    // ── 2. If Buy Now has no [OL] items yet, seed from bundle_items / product_model ──
    if (buyNowConfig.orderItems.length === 0) {
      const biArr = (bundleDetails.bundle_items || []) as any[];
      biArr.forEach((bi: any, idx: number) => {
        const prodTitle = bi.product?.title || bi.product?.name || bi.title || bi.name || "";
        if (prodTitle.trim()) {
          const rate = bi.rate_override ?? bi.product?.price ?? 0;
          buyNowConfig.orderItems.push({
            id: Date.now() + idx,
            title: prodTitle,
            amount: String(parseFloat(String(rate)) || 0),
            quantity: String(bi.quantity || 1),
            unit: "Nos",
            quantityApplies: true,
            visibility: "both",
          });
        }
      });
      if (buyNowConfig.orderItems.length === 0 && bundleDetails.product_model) {
        String(bundleDetails.product_model).split("/").map((s: string) => s.trim()).filter(Boolean)
          .forEach((part: string, idx: number) => buyNowConfig.orderItems.push({
            id: Date.now() + idx,
            title: part,
            amount: "0",
            quantity: "1",
            unit: "Nos",
            quantityApplies: true,
            visibility: "both",
          }));
      }
    }

    setFlowConfigs({ buy_now: buyNowConfig, bnpl: bnplConfig });
    setOrderListDirty(false);
  }, [bundleDetails, orderListDirty]);

  const bundleMaterials: BundleMaterial[] =
    (bundleMaterialsData as any)?.data || (bundleMaterialsData as any) || [];

  // Mutations
  const createBundleMutation = useMutation({
    mutationFn: (data: any) => addBundle(data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      setShowBundleModal(false);
      resetBundleForm();
    },
  });

  const updateBundleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateBundle(id, data, token),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["bundle-details", variables.id] });
    },
  });

  const deleteBundleMutation = useMutation({
    mutationFn: (id: number) => deleteBundle(id, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      setShowDeleteModal(false);
      setDeleteTarget(null);
    },
  });

  // Bundle Material Mutations
  const addMaterialMutation = useMutation({
    mutationFn: ({ bundleId, data }: { bundleId: number; data: any }) =>
      addBundleMaterial(bundleId, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundle-materials"] });
      setShowAddMaterialModal(false);
      resetMaterialForm();
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: ({
      bundleId,
      materialId,
      data,
    }: {
      bundleId: number;
      materialId: number;
      data: any;
    }) => updateBundleMaterial(bundleId, materialId, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundle-materials"] });
      setShowAddMaterialModal(false);
      setEditingMaterial(null);
      resetMaterialForm();
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: ({ bundleId, materialId }: { bundleId: number; materialId: number }) =>
      deleteBundleMaterial(bundleId, materialId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundle-materials"] });
      setShowDeleteMaterialModal(false);
      setDeleteMaterialTarget(null);
    },
  });

  // Update material selling_rate inline from Order List
  // @ts-ignore – kept for future use
  const updateMaterialRateMutation = useMutation({
    mutationFn: ({ materialId, selling_rate }: { materialId: number; selling_rate: number }) =>
      updateMaterial(materialId, { selling_rate }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundle-details"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });

  // Update bundle-material quantity inline from Order List
  // @ts-ignore – kept for future use
  const updateBundleMaterialQtyMutation = useMutation({
    mutationFn: ({ bundleId, materialId, quantity }: { bundleId: number; materialId: number; quantity: number }) =>
      updateBundleMaterial(bundleId, materialId, { quantity }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundle-details"] });
      queryClient.invalidateQueries({ queryKey: ["bundle-materials"] });
    },
  });

  // Form handlers
  const resetBundleForm = () => {
    setBundleFormData({
      title: "",
      bundle_type: bundleTypeOptions[0] || DEFAULT_BUNDLE_TYPES[0],
      is_available: true,
      brand_id: "",
      total_price: "",
      discount_price: "",
      inver_rating: "",
      total_output: "",
      total_load: "",
      system_capacity_display: "",
      description: "",
      product_model: "",
      what_is_inside: "",
      what_it_powers: "",
      backup_time_description: "",
    });
    setSpecRows([]);
    setFeaturedImage(null);
    setImagePreview(null);
    setEditingBundle(null);
  };

  const handleOpenBundleModal = (bundle?: Bundle) => {
    if (bundle) {
      setEditingBundle(bundle);
      const brandId = bundle.brand_id ?? bundle.brand?.id ?? "";
      const sp = bundle.specifications ?? {};
      setBundleFormData({
        title: bundle.title,
        bundle_type: bundle.bundle_type,
        is_available: bundle.is_available !== false,
        brand_id: brandId,
        total_price: bundle.total_price.toString(),
        discount_price: bundle.discount_price?.toString() || "",
        inver_rating: bundle.inver_rating || "",
        total_output: bundle.total_output || "",
        total_load: bundle.total_load || "",
        system_capacity_display: bundle.system_capacity_display || "",
        description: bundle.detailed_description || "",
        product_model: bundle.product_model || "",
        what_is_inside: bundle.what_is_inside_bundle_text || "",
        what_it_powers: bundle.what_bundle_powers_text || "",
        backup_time_description: bundle.backup_time_description || "",
      });
      if (bundle.bundle_type && !bundleTypeOptions.includes(bundle.bundle_type)) {
        setBundleTypeOptions((prev) => [...prev, bundle.bundle_type]);
      }
      // Load specifications as dynamic key-value rows
      const loadedRows = Object.entries(sp)
        .filter(([, v]) => v !== "" && v != null)
        .map(([k, v], idx) => ({ id: Date.now() + idx, key: k, value: String(v) }));
      setSpecRows(loadedRows);
      const imgUrl = bundle.featured_image_url || bundle.featured_image || null;
      if (imgUrl) {
        setImagePreview(imgUrl);
      }
    } else {
      resetBundleForm();
    }
    setShowBundleModal(true);
  };

  const handleAddBundleType = () => {
    const trimmed = newBundleType.trim();
    if (!trimmed) return;
    if (bundleTypeOptions.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setNewBundleType("");
      return;
    }
    const updated = [...bundleTypeOptions, trimmed];
    setBundleTypeOptions(updated);
    saveBundleTypesMutation.mutate(updated);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFeaturedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBundleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      title: bundleFormData.title,
      bundle_type: bundleFormData.bundle_type,
      is_available: bundleFormData.is_available,
      total_price: parseFloat(bundleFormData.total_price) || 0,
      discount_price: parseFloat(bundleFormData.discount_price) || 0,
    };

    if (bundleFormData.brand_id !== "" && bundleFormData.brand_id != null) {
      payload.brand_id = typeof bundleFormData.brand_id === "string" ? parseInt(bundleFormData.brand_id, 10) : bundleFormData.brand_id;
    } else {
      payload.brand_id = null;
    }

    if (bundleFormData.inver_rating) payload.inver_rating = bundleFormData.inver_rating;
    if (bundleFormData.total_output) payload.total_output = bundleFormData.total_output;
    if (bundleFormData.total_load) payload.total_load = bundleFormData.total_load;
    if (bundleFormData.bundle_type === "Inverter + Battery") payload.total_load = null;
    if (bundleFormData.system_capacity_display) payload.system_capacity_display = bundleFormData.system_capacity_display;
    if (bundleFormData.description) payload.detailed_description = bundleFormData.description;
    if (bundleFormData.product_model) payload.product_model = bundleFormData.product_model;
    if (bundleFormData.what_is_inside) payload.what_is_inside_bundle_text = bundleFormData.what_is_inside;
    if (bundleFormData.what_it_powers) payload.what_bundle_powers_text = bundleFormData.what_it_powers;
    if (bundleFormData.backup_time_description) payload.backup_time_description = bundleFormData.backup_time_description;

    // Build specifications object from dynamic spec rows
    const specs: Record<string, string> = {};
    specRows.forEach((row) => {
      const k = row.key.trim();
      const v = row.value.trim();
      if (k && v) specs[k] = v;
    });
    payload.specifications = specs;

    if (featuredImage) payload.featured_image = featuredImage;

    if (editingBundle) {
      const bundleId = editingBundle.id;
      updateBundleMutation.mutate(
        { id: bundleId, data: payload },
        {
          onSuccess: () => {
            setShowBundleModal(false);
            setEditingBundle(null);
            resetBundleForm();
          },
        }
      );
    } else {
      createBundleMutation.mutate(payload);
    }
  };

  const handleDelete = (id: number, title: string) => {
    setDeleteTarget({ id, title });
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteBundleMutation.mutate(deleteTarget.id);
  };

  // Filtered data
  const filteredBundles = bundles.filter((bundle) =>
    bundle.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bundle.bundle_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate discount percentage
  const calculateDiscountPercentage = (total: number, discount: number) => {
    if (total === 0 || discount === 0) return 0;
    return Math.round((discount / total) * 100);
  };

  // Material management handlers
  const handleManageMaterials = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setShowMaterialsModal(true);
  };

  const handleOpenAddMaterialModal = (material?: BundleMaterial) => {
    if (material) {
      setEditingMaterial(material);
      setMaterialFormData({
        material_id: material.material_id.toString(),
        quantity: material.quantity,
      });
    } else {
      resetMaterialForm();
    }
    setShowAddMaterialModal(true);
  };

  const resetMaterialForm = () => {
    setMaterialFormData({
      material_id: "",
      quantity: "",
    });
    setEditingMaterial(null);
  };

  const handleMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBundle) return;

    const payload = {
      material_id: parseInt(materialFormData.material_id),
      quantity: parseFloat(materialFormData.quantity),
    };

    if (editingMaterial) {
      updateMaterialMutation.mutate({
        bundleId: selectedBundle.id,
        materialId: editingMaterial.id,
        data: { quantity: payload.quantity },
      });
    } else {
      addMaterialMutation.mutate({
        bundleId: selectedBundle.id,
        data: payload,
      });
    }
  };

  const handleDeleteMaterial = (material: BundleMaterial) => {
    setDeleteMaterialTarget({
      id: material.id,
      name: material.material.name,
    });
    setShowDeleteMaterialModal(true);
  };

  const confirmDeleteMaterial = () => {
    if (!deleteMaterialTarget || !selectedBundle) return;
    deleteMaterialMutation.mutate({
      bundleId: selectedBundle.id,
      materialId: deleteMaterialTarget.id,
    });
  };

  // Order List handlers
  const handleOpenOrderList = (bundle: Bundle) => {
    setOrderListBundle(bundle);
    setOrderListTab("orderlist");
    setOrderListFlow("buy_now");
    setOrderListDirty(false);
    setShowOrderListModal(true);
  };

  const handleSaveOrderList = () => {
    if (!orderListBundle || !bundleDetails) return;
    setSavingOrderList(true);

    const materials_detail = (bundleDetails.bundle_materials || []).map((bm: any) => ({
      material_id: bm.material_id,
      quantity: bm.quantity ?? 1,
      rate_override: parseFloat(editMatRate[`mat-${bm.material_id}`]) || null,
    }));

    const buildServicesForFlow = (flow: "buy_now" | "bnpl", config: FlowOrderConfig) => {
      const normalized = normalizeFlowConfig(config);
      const orderItems = normalized.orderItems
        .filter((s) => s.title.trim() !== "")
        .map((s) => ({
          flow_type: flow,
          title: encodeOrderItemTitleWithVisibility(s.title, s.visibility || "both"),
          service_amount: parseFloat(s.amount) || 0,
          quantity: Math.max(1, parseInt(s.quantity || "1", 10) || 1),
          unit: (s.unit || "Nos").trim() || "Nos",
          quantity_applies: !!s.quantityApplies,
        }));

      const feeItems = normalized.fees
        .filter((s) => s.title.trim() !== "")
        .map((s) => ({
          flow_type: flow,
          title: encodeFeeTitleWithVisibility(s.title, s.visibility || "both"),
          service_amount: parseFloat(s.amount) || 0,
        }));

      return [...orderItems, ...feeItems];
    };

    const custom_services = [
      ...buildServicesForFlow("buy_now", flowConfigs.buy_now),
      ...buildServicesForFlow("bnpl", flowConfigs.bnpl),
    ];

    const payload: any = {
      materials_detail,
      custom_services,
      total_price: orderListBundle.total_price,
      discount_price: orderListBundle.discount_price ?? orderListBundle.total_price,
      title: orderListBundle.title,
    };

    updateBundleMutation.mutate(
      {
        id: orderListBundle.id,
        data: payload,
      },
      {
        onSuccess: () => {
          setOrderListDirty(false);
          setSavingOrderList(false);
          alert("Changes saved successfully!");
        },
        onError: (err: any) => {
          setSavingOrderList(false);
          const msg = err?.response?.data?.message || err?.message || "Failed to save changes.";
          alert(`Save failed: ${msg}`);
        },
      }
    );
  };

  const handleAddOrderItem = () => {
    setEditOrderItems((prev) => [...prev, { id: Date.now(), title: "", amount: "0", quantity: "1", unit: "Nos", quantityApplies: true, visibility: "both" }]);
  };

  const handleRemoveOrderItem = (idx: number) => {
    setEditOrderItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddService = () => {
    setEditSvc((prev) => [...prev, { id: Date.now(), title: "", amount: "0", visibility: "both" }]);
  };

  const handleRemoveService = (idx: number) => {
    setEditSvc((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDuplicateToOtherFlow = () => {
    const otherFlow: "buy_now" | "bnpl" = orderListFlow === "buy_now" ? "bnpl" : "buy_now";
    const source = flowConfigs[orderListFlow];
    const sourceLabel = orderListFlow === "buy_now" ? "Buy Now" : "BNPL";
    const targetLabel = otherFlow === "buy_now" ? "Buy Now" : "BNPL";
    const confirmed = window.confirm(
      `Copy the ${sourceLabel} order list and invoice fees to ${targetLabel}? This will replace any existing ${targetLabel} configuration.`
    );
    if (!confirmed) return;

    setFlowConfigs((prev) => ({
      ...prev,
      [otherFlow]: {
        orderItems: source.orderItems.map((item, i) => ({ ...item, id: Date.now() + i })),
        fees: source.fees.map((fee, i) => ({ ...fee, id: Date.now() + 10000 + i })),
      },
    }));
    setOrderListDirty(true);
  };

  const formatNaira = (val: number) =>
    `₦${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-[#F5F7FF] min-h-screen">
      <Header adminName="Hi, Admin" adminImage="/assets/layout/admin.png" />

      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bundle Management</h1>
        </div>

        {/* Filters and Actions */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative w-[320px]">
              <input
                type="text"
                placeholder="Search bundles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-3.5 border border-[#00000080] rounded-lg text-[15px] w-full focus:outline-none bg-white shadow-[0_2px_6px_rgba(0,0,0,0.05)] placeholder-gray-400"
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
            <select
              value={bundleTypeFilter}
              onChange={(e) => setBundleTypeFilter(e.target.value)}
              className="px-4 py-3.5 border border-[#00000080] rounded-lg text-[15px] bg-white focus:outline-none shadow-[0_2px_6px_rgba(0,0,0,0.05)]"
            >
              <option value="all">All Types</option>
              {bundleTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newBundleType}
                onChange={(e) => setNewBundleType(e.target.value)}
                placeholder="Add bundle type"
                className="px-3 py-3 border border-[#00000080] rounded-lg text-sm bg-white focus:outline-none shadow-[0_2px_6px_rgba(0,0,0,0.05)]"
              />
              <button
                type="button"
                onClick={handleAddBundleType}
                disabled={saveBundleTypesMutation.isPending}
                className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {saveBundleTypesMutation.isPending ? "Saving..." : "Add Type"}
              </button>
            </div>
          </div>
          <button
            onClick={() => handleOpenBundleModal()}
            className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-8 py-3.5 rounded-full text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            Add Bundle
          </button>
        </div>

        {/* Bundles Table */}
        {bundlesLoading ? (
          <LoadingSpinner message="Loading bundles..." />
        ) : bundlesError ? (
          <div className="p-8 text-center text-red-500">
            Failed to load bundles. Please try again.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="border-b border-gray-200 bg-[#EBEBEB]">
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Title</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Availability</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Inverter Rating</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Total Output</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Total Load</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Total Price</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Discount Price</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-black">Discount %</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-black">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredBundles.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                      No bundles found
                    </td>
                  </tr>
                ) : (
                  filteredBundles.map((bundle, index) => {
                    const discountPercentage = calculateDiscountPercentage(
                      bundle.total_price,
                      bundle.discount_price
                    );
                    return (
                      <tr
                        key={bundle.id}
                        className={`${
                          index % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"
                        } border-b border-gray-100`}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {bundle.title}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                              bundle.bundle_type === "Inverter + Battery"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {bundle.bundle_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                            bundle.is_available === false ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          }`}>
                            {bundle.is_available === false ? "Unavailable" : "Available"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {bundle.inver_rating || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {bundle.total_output || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {bundle.total_load || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          ₦{bundle.total_price.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {bundle.discount_price > 0 ? (
                            <span className="text-green-600">
                              ₦{bundle.discount_price.toLocaleString()}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {discountPercentage > 0 ? (
                            <span className="text-green-600 font-semibold">
                              {discountPercentage}%
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-2 flex-wrap gap-y-2">
                            <button
                              onClick={() => handleOpenOrderList(bundle)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                            >
                              Order List
                            </button>
                            <button
                              onClick={() => handleManageMaterials(bundle)}
                              className="bg-[#E8A91D] hover:bg-[#d89a1a] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                            >
                              Materials
                            </button>
                            <button
                              onClick={() => handleOpenBundleModal(bundle)}
                              className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(bundle.id, bundle.title)}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bundle Modal */}
      {showBundleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingBundle ? `Edit Bundle — ${editingBundle.title}` : "Add Bundle"}
              </h2>
              <button
                onClick={() => {
                  setShowBundleModal(false);
                  resetBundleForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleBundleSubmit}>
              <div className="space-y-5">

                {/* ── Section 1: Basic Info ── */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Basic Info</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                      <input type="text" required value={bundleFormData.title}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, title: e.target.value })}
                        placeholder="e.g., LitePower1213"
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bundle Type <span className="text-red-500">*</span></label>
                      <select required value={bundleFormData.bundle_type}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, bundle_type: e.target.value })}
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        {bundleTypeOptions.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                      <select
                        value={bundleFormData.brand_id === "" ? "" : String(bundleFormData.brand_id)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBundleFormData({ ...bundleFormData, brand_id: v === "" ? "" : (parseInt(v, 10) as number) });
                        }}
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">No brand</option>
                        {apiBrands.map((brand) => (
                          <option key={brand.id} value={brand.id}>{brand.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">System Capacity Display</label>
                      <input type="text" value={bundleFormData.system_capacity_display}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, system_capacity_display: e.target.value })}
                        placeholder="e.g. 1.2kVA + 1.3kWh"
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                      <select
                        value={bundleFormData.is_available ? "available" : "unavailable"}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, is_available: e.target.value === "available" })}
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="available">Available (show on public app)</option>
                        <option value="unavailable">Unavailable (hide from public app)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Pricing ── */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pricing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Price (₦) <span className="text-red-500">*</span></label>
                      <input type="number" required step="0.01" value={bundleFormData.total_price}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, total_price: e.target.value })}
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Discount Price (₦)</label>
                      <input type="number" step="0.01" value={bundleFormData.discount_price}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, discount_price: e.target.value })}
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Technical Ratings ── */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Technical Ratings</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Inverter Rating (kVA)</label>
                      <input type="text" value={bundleFormData.inver_rating}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, inver_rating: e.target.value })}
                        placeholder="e.g. 1.2"
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Battery Capacity (kWh)</label>
                      <input type="text" value={bundleFormData.total_output}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, total_output: e.target.value })}
                        placeholder="e.g. 1.3"
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    {bundleFormData.bundle_type === "Solar+Inverter+Battery" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Solar Capacity (kWp)</label>
                        <input type="text" value={bundleFormData.total_load}
                          onChange={(e) => setBundleFormData({ ...bundleFormData, total_load: e.target.value })}
                          placeholder="e.g. 0.6"
                          className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Section 4: Product Model & Content ── */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Content & Description</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Model</label>
                    <input type="text" value={bundleFormData.product_model}
                      onChange={(e) => setBundleFormData({ ...bundleFormData, product_model: e.target.value })}
                      placeholder="e.g. OG-1P1K2-T - 1.2kVA Yinergy Inverter / GCL 12100 12V 1.3kWh Battery"
                      className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows={3} value={bundleFormData.description}
                      onChange={(e) => setBundleFormData({ ...bundleFormData, description: e.target.value })}
                      placeholder="Full description of the bundle and what it powers..."
                      className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">What is inside the bundle</label>
                      <textarea rows={2} value={bundleFormData.what_is_inside}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, what_is_inside: e.target.value })}
                        placeholder="e.g. 1 unit 1.2kVA Inverter, 1 unit 1.3kWh Battery & Installation Materials"
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">What the bundle will power</label>
                      <textarea rows={2} value={bundleFormData.what_it_powers}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, what_it_powers: e.target.value })}
                        placeholder="e.g. 6–10 LED bulbs, 1 LED TV, 1 Decoder, 1 Fan, 1 Laptop, Wi-Fi"
                        className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Back-up Time Description</label>
                    <input type="text" value={bundleFormData.backup_time_description}
                      onChange={(e) => setBundleFormData({ ...bundleFormData, backup_time_description: e.target.value })}
                      placeholder="e.g. 1–9 hours depending on load"
                      className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>

                {/* ── Section 5: Specifications (dynamic key-value) ── */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Specifications</h3>
                    <button
                      type="button"
                      onClick={() => setSpecRows((prev) => [...prev, { id: Date.now(), key: "", value: "" }])}
                      className="flex items-center gap-1 bg-[#273E8E] hover:bg-[#1e3270] text-white text-xs px-3 py-1.5 rounded-full transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Field
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Add any specification fields (e.g. "Voltage" → "12V", "Inverter Capacity" → "1.2 kVA").</p>

                  {specRows.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-400">No specifications yet. Click &quot;+ Add Field&quot; to add one.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Header row */}
                      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 px-1">
                        <span className="w-6" />
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Field Name</span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Value</span>
                        <span className="w-8" />
                      </div>
                      {specRows.map((row, idx) => (
                        <div
                          key={row.id}
                          draggable
                          onDragStart={() => { specDragIdx.current = idx; }}
                          onDragEnter={() => { specDragOverIdx.current = idx; }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            const from = specDragIdx.current;
                            const to = specDragOverIdx.current;
                            if (from === null || to === null || from === to) return;
                            setSpecRows((prev) => {
                              const next = [...prev];
                              const [moved] = next.splice(from, 1);
                              next.splice(to, 0, moved);
                              return next;
                            });
                            specDragIdx.current = null;
                            specDragOverIdx.current = null;
                          }}
                          onDragEnd={() => {
                            specDragIdx.current = null;
                            specDragOverIdx.current = null;
                          }}
                          className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center group rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {/* Drag handle */}
                          <div
                            className="w-6 flex flex-col items-center justify-center gap-[3px] cursor-grab active:cursor-grabbing py-2 opacity-40 group-hover:opacity-100 transition-opacity"
                            title="Drag to reorder"
                          >
                            <span className="block w-3.5 h-0.5 bg-gray-500 rounded" />
                            <span className="block w-3.5 h-0.5 bg-gray-500 rounded" />
                            <span className="block w-3.5 h-0.5 bg-gray-500 rounded" />
                          </div>
                          <input
                            type="text"
                            value={row.key}
                            onChange={(e) => setSpecRows((prev) => prev.map((r, i) => i === idx ? { ...r, key: e.target.value } : r))}
                            placeholder="e.g. Voltage"
                            className="border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          />
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) => setSpecRows((prev) => prev.map((r, i) => i === idx ? { ...r, value: e.target.value } : r))}
                            placeholder="e.g. 12V"
                            className="border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setSpecRows((prev) => prev.filter((_, i) => i !== idx))}
                            className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove field"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick-add preset buttons */}
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-400 mb-2">Quick add common fields:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: "Company / OEM", value: "" },
                        { key: "Voltage", value: "" },
                        { key: "Inverter Capacity (kVA)", value: "" },
                        { key: "Inverter Warranty", value: "" },
                        { key: "Battery Type", value: "" },
                        { key: "Battery Capacity (kWh)", value: "" },
                        { key: "Battery Warranty", value: "" },
                        { key: "Backup Time Range", value: "" },
                        { key: "Solar Panel Type", value: "" },
                        { key: "Solar Capacity (kW)", value: "" },
                        { key: "Solar Panel Wattage", value: "" },
                        { key: "Solar Panel Warranty", value: "" },
                      ].map((preset) => {
                        const alreadyAdded = specRows.some((r) => r.key === preset.key);
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => setSpecRows((prev) => [...prev, { id: Date.now(), key: preset.key, value: preset.value }])}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              alreadyAdded
                                ? "border-gray-200 text-gray-300 cursor-not-allowed"
                                : "border-[#273E8E] text-[#273E8E] hover:bg-[#273E8E] hover:text-white cursor-pointer"
                            }`}
                          >
                            + {preset.key}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Section 6: Featured Image ── */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Featured Image</label>
                  <input type="file" accept="image/*" onChange={handleImageChange}
                    className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  {imagePreview && (
                    <div className="mt-2">
                      <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowBundleModal(false);
                    resetBundleForm();
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createBundleMutation.isPending || updateBundleMutation.isPending
                  }
                  className="px-6 py-2 bg-[#273E8E] text-white rounded-full font-medium transition-colors hover:bg-[#1f2f7a] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createBundleMutation.isPending || updateBundleMutation.isPending
                    ? "Saving..."
                    : editingBundle
                    ? "Update"
                    : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete bundle <strong>{deleteTarget.title}</strong>? This
              action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteBundleMutation.isPending}
                className="px-6 py-2 bg-red-600 text-white rounded-full font-medium transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteBundleMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Materials Management Modal */}
      {showMaterialsModal && selectedBundle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Manage Materials - {selectedBundle.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Bundle Type: {selectedBundle.bundle_type}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleOpenAddMaterialModal()}
                  className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                >
                  Add Material
                </button>
                <button
                  onClick={() => {
                    setShowMaterialsModal(false);
                    setSelectedBundle(null);
                    if (orderListBundle) {
                      queryClient.invalidateQueries({ queryKey: ["bundle-details", orderListBundle.id] });
                    }
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {bundleMaterialsLoading ? (
              <LoadingSpinner message="Loading materials..." />
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-[#EBEBEB]">
                      <th className="px-6 py-4 text-left text-sm font-medium text-black">
                        Material Name
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-black">Category</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-black">Unit</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-black">Quantity</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-black">Warranty</th>
                      <th className="px-6 py-4 text-center text-sm font-medium text-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {bundleMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No materials found. Add materials to this bundle.
                        </td>
                      </tr>
                    ) : (
                      bundleMaterials.map((bm, index) => (
                        <tr
                          key={bm.id}
                          className={`${
                            index % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"
                          } border-b border-gray-100`}
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {bm.material.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {bm.material.category.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{bm.material.unit}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{bm.quantity}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {bm.material.warranty ? `${bm.material.warranty} years` : "-"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleOpenAddMaterialModal(bm)}
                                className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteMaterial(bm)}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Material Modal */}
      {showAddMaterialModal && selectedBundle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingMaterial ? "Edit Material" : "Add Material"}
              </h2>
              <button
                onClick={() => {
                  setShowAddMaterialModal(false);
                  resetMaterialForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleMaterialSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Material <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    disabled={!!editingMaterial}
                    value={materialFormData.material_id}
                    onChange={(e) =>
                      setMaterialFormData({
                        ...materialFormData,
                        material_id: e.target.value,
                      })
                    }
                    className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                  >
                    <option value="">Select Material</option>
                    {allMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name} ({material.category?.name || "N/A"}) - {material.unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    value={materialFormData.quantity}
                    onChange={(e) =>
                      setMaterialFormData({
                        ...materialFormData,
                        quantity: e.target.value,
                      })
                    }
                    className="w-full border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMaterialModal(false);
                    resetMaterialForm();
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    addMaterialMutation.isPending || updateMaterialMutation.isPending
                  }
                  className="px-6 py-2 bg-[#273E8E] text-white rounded-full font-medium transition-colors hover:bg-[#1f2f7a] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addMaterialMutation.isPending || updateMaterialMutation.isPending
                    ? "Saving..."
                    : editingMaterial
                    ? "Update"
                    : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Material Confirmation Modal */}
      {showDeleteMaterialModal && deleteMaterialTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Remove</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove <strong>{deleteMaterialTarget.name}</strong> from this
              bundle? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteMaterialModal(false);
                  setDeleteMaterialTarget(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMaterial}
                disabled={deleteMaterialMutation.isPending}
                className="px-6 py-2 bg-red-600 text-white rounded-full font-medium transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMaterialMutation.isPending ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order List & Invoice Modal */}
      {showOrderListModal && orderListBundle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Order List & Invoice — {orderListBundle.title}
                </h2>
              </div>
              <button
                onClick={() => { setShowOrderListModal(false); setOrderListBundle(null); setOrderListFlow("buy_now"); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Checkout flow tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex border border-gray-200 rounded-lg overflow-hidden w-fit">
                <button
                  type="button"
                  onClick={() => setOrderListFlow("buy_now")}
                  className={`px-5 py-2 text-sm font-medium transition-colors ${
                    orderListFlow === "buy_now"
                      ? "bg-[#273E8E] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Buy Now
                </button>
                <button
                  type="button"
                  onClick={() => setOrderListFlow("bnpl")}
                  className={`px-5 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                    orderListFlow === "bnpl"
                      ? "bg-[#273E8E] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  BNPL
                </button>
              </div>
              <button
                type="button"
                onClick={handleDuplicateToOtherFlow}
                className="text-sm font-medium text-[#273E8E] hover:text-[#1e3270] border border-[#273E8E] px-4 py-2 rounded-full transition-colors"
              >
                Duplicate to {orderListFlow === "buy_now" ? "BNPL" : "Buy Now"}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setOrderListTab("orderlist")}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  orderListTab === "orderlist"
                    ? "border-[#273E8E] text-[#273E8E]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Order summary
              </button>
              <button
                onClick={() => setOrderListTab("invoice")}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  orderListTab === "invoice"
                    ? "border-[#273E8E] text-[#273E8E]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Invoice fees
              </button>
            </div>

            {bundleDetailsLoading ? (
              <LoadingSpinner message="Loading bundle details..." />
            ) : !bundleDetails ? (
              <p className="text-gray-500 text-center py-8">Could not load bundle details.</p>
            ) : orderListTab === "orderlist" ? (
              /* ---- ORDER LIST TAB ---- */
              <div>
                {/* Save bar */}
                {orderListDirty && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 flex items-center justify-between">
                    <span className="text-sm text-yellow-800 font-medium">You have unsaved changes.</span>
                    <button
                      onClick={handleSaveOrderList}
                      disabled={savingOrderList}
                      className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-5 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {savingOrderList ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}

                {/* ── Order List Items (customer order summary) ── */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">Products on order summary</h3>
                    <button
                      onClick={handleAddOrderItem}
                      className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#EBEBEB] border-b">
                          <th className="px-4 py-3 text-left text-sm font-medium text-black">ITEM DESCRIPTION</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-black w-16">QTY</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-black w-16">UNIT</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-black w-32">RATE (₦)</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-black w-44">Show For</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-black w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editOrderItems.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No order list items. Click &quot;+ Add Item&quot; to add items shown on the order summary.</td></tr>
                        ) : (
                          editOrderItems.map((item, idx) => {
                            const rate = parseFloat(item.amount) || 0;
                            return (
                              <tr key={item.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={item.title}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditOrderItems((prev) => prev.map((s, i) => i === idx ? { ...s, title: val } : s));
                                      setOrderListDirty(true);
                                    }}
                                    placeholder="e.g. 1.2kVA Inverter, 1.3kWh Battery"
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                  />
                                </td>
                                <td className="px-4 py-2 text-sm text-center">
                                  {item.quantityApplies ? (
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditOrderItems((prev) => prev.map((s, i) => i === idx ? { ...s, quantity: val } : s));
                                        setOrderListDirty(true);
                                      }}
                                      className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                  ) : (
                                    <span className="text-gray-500 italic">NIL</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-sm text-center text-gray-600">
                                  <div className="flex flex-col items-center gap-1">
                                    <select
                                      value={item.unit || "Nos"}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditOrderItems((prev) => prev.map((s, i) => i === idx ? { ...s, unit: val } : s));
                                        setOrderListDirty(true);
                                      }}
                                      className="border border-gray-300 rounded px-2 py-1 text-xs"
                                    >
                                      <option value="Nos">Nos</option>
                                      <option value="Lots">Lots</option>
                                      <option value="Set">Set</option>
                                      <option value="Unit">Unit</option>
                                    </select>
                                    <label className="flex items-center gap-1 text-[11px] text-gray-500">
                                      <input
                                        type="checkbox"
                                        checked={item.quantityApplies !== false}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setEditOrderItems((prev) => prev.map((s, i) => i === idx ? { ...s, quantityApplies: checked } : s));
                                          setOrderListDirty(true);
                                        }}
                                      />
                                      Qty applies
                                    </label>
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.amount}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditOrderItems((prev) => prev.map((s, i) => i === idx ? { ...s, amount: val } : s));
                                      setOrderListDirty(true);
                                    }}
                                    placeholder="0 = Included"
                                    className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:ring-1 focus:ring-blue-500 outline-none"
                                  />
                                  {rate === 0 && <span className="text-xs text-gray-400 ml-1 italic">Included</span>}
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    value={item.visibility || "both"}
                                    onChange={(e) => {
                                      const val = e.target.value as "both" | "troosolar" | "own";
                                      setEditOrderItems((prev) => prev.map((s, i) => i === idx ? { ...s, visibility: val } : s));
                                      setOrderListDirty(true);
                                    }}
                                    className="w-40 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                  >
                                    <option value="both">Both</option>
                                    <option value="troosolar">Troosolar Installer Only</option>
                                    <option value="own">Own Installer Only</option>
                                  </select>
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <button
                                    onClick={() => handleRemoveOrderItem(idx)}
                                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sub-Total */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
                  <span className="font-semibold text-gray-800">Bundle Price (Sub-Total)</span>
                  <span className="text-xl font-bold text-[#273E8E]">{formatNaira(orderListBundle.total_price)}</span>
                </div>

                {/* Bottom Save Button */}
                {orderListDirty && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleSaveOrderList}
                      disabled={savingOrderList}
                      className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-8 py-3 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {savingOrderList ? "Saving…" : "Save All Changes"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ---- INVOICE TAB (editable fees + preview) ---- */
              <div>
                {/* Save bar */}
                {orderListDirty && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 flex items-center justify-between">
                    <span className="text-sm text-yellow-800 font-medium">You have unsaved changes.</span>
                    <button
                      onClick={handleSaveOrderList}
                      disabled={savingOrderList}
                      className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-5 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {savingOrderList ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}

                {/* ── Editable Invoice Fees Section ── */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">Invoice Fees</h3>
                    <button
                      onClick={handleAddService}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                    >
                      + Add Fee
                    </button>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#EBEBEB] border-b">
                          <th className="px-4 py-3 text-left text-sm font-medium text-black">Fee Name</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-black w-40">Amount (₦)</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-black w-44">Show For</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-black w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editSvc.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No fees. Click &quot;+ Add Fee&quot; to add invoice fees.</td></tr>
                        ) : (
                          editSvc.map((svc, idx) => (
                            <tr key={svc.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={svc.title}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditSvc((prev) => prev.map((s, i) => i === idx ? { ...s, title: val } : s));
                                    setOrderListDirty(true);
                                  }}
                                  placeholder="e.g. Installation Material, Delivery Fees"
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={svc.amount}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditSvc((prev) => prev.map((s, i) => i === idx ? { ...s, amount: val } : s));
                                    setOrderListDirty(true);
                                  }}
                                  className="w-36 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={svc.visibility || "both"}
                                  onChange={(e) => {
                                    const val = e.target.value as "both" | "troosolar" | "own";
                                    setEditSvc((prev) => prev.map((s, i) => i === idx ? { ...s, visibility: val } : s));
                                    setOrderListDirty(true);
                                  }}
                                  className="w-40 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                >
                                  <option value="both">Both</option>
                                  <option value="troosolar">Troosolar Installer Only</option>
                                  <option value="own">Own Installer Only</option>
                                </select>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => handleRemoveService(idx)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Save for fees */}
                {orderListDirty && (
                  <div className="mb-6 flex justify-end">
                    <button
                      onClick={handleSaveOrderList}
                      disabled={savingOrderList}
                      className="bg-[#273E8E] hover:bg-[#1e3270] text-white px-8 py-3 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {savingOrderList ? "Saving…" : "Save All Changes"}
                    </button>
                  </div>
                )}

                {/* ═══ FULL INVOICE PREVIEW (read-only combined view) ═══ */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-lg font-bold text-gray-800">
                      Invoice Preview — {orderListBundle.title} ({orderListFlow === "buy_now" ? "Buy Now" : "BNPL"})
                    </h3>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="whitespace-nowrap font-medium">Preview as:</span>
                      <select
                        value={invoicePreviewAsInstaller}
                        onChange={(e) => setInvoicePreviewAsInstaller(e.target.value as "troosolar" | "own")}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        <option value="troosolar">Troosolar installer</option>
                        <option value="own">Own installer</option>
                      </select>
                    </label>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="py-2 text-left text-sm font-bold text-gray-700">ITEM DESCRIPTION</th>
                        <th className="py-2 text-center text-sm font-bold text-gray-700 w-16">QTY</th>
                        <th className="py-2 text-center text-sm font-bold text-gray-700 w-16">UNIT</th>
                        <th className="py-2 text-right text-sm font-bold text-gray-700 w-32">RATE</th>
                        <th className="py-2 text-right text-sm font-bold text-gray-700 w-28">TOTAL COST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Order list items (filtered by Show For vs preview installer, same as customer dashboard) */}
                      {editOrderItems.filter(
                        (i) =>
                          i.title.trim() &&
                          rowVisibleForInvoicePreview(i.visibility || "both", invoicePreviewAsInstaller)
                      ).map((item, idx) => {
                        const rate = parseFloat(item.amount) || 0;
                        const qtyApplies = item.quantityApplies !== false;
                        const qty = qtyApplies ? Math.max(1, parseInt(item.quantity || "1", 10) || 1) : 1;
                        const qtyDisplay = qtyApplies ? qty : "NIL";
                        const unitDisplay = item.unit || "Nos";
                        const total = rate * qty;
                        return (
                          <tr key={`inv-ol-${idx}`} className="border-b border-gray-100">
                            <td className="py-2 text-sm text-gray-800">{item.title}</td>
                            <td className="py-2 text-sm text-center">{qtyDisplay}</td>
                            <td className="py-2 text-sm text-center text-gray-600">{unitDisplay}</td>
                            <td className="py-2 text-sm text-right">{rate > 0 ? formatNaira(rate) : <span className="italic text-gray-400">Included</span>}</td>
                            <td className="py-2 text-sm text-right font-medium">{total > 0 ? formatNaira(total) : <span className="italic text-gray-400">Included</span>}</td>
                          </tr>
                        );
                      })}

                      {/* Invoice fee rows */}
                      {editSvc.filter(
                        (s) =>
                          isBillableInvoiceFeeRow(s.title, parseFloat(s.amount) || 0) &&
                          rowVisibleForInvoicePreview(s.visibility || "both", invoicePreviewAsInstaller)
                      ).map((svc, idx) => {
                        const amt = parseFloat(svc.amount) || 0;
                        const isInspection = /inspection/i.test(svc.title);
                        return (
                          <tr key={`inv-fee-${idx}`} className="border-b border-gray-100">
                            <td className="py-2 text-sm text-gray-800">{svc.title}</td>
                            <td className="py-2 text-sm text-center">1</td>
                            <td className="py-2 text-sm text-center text-gray-600">{isInspection ? 'Lots' : 'Nos'}</td>
                            <td className="py-2 text-sm text-right">{amt > 0 ? formatNaira(amt) : <span className="italic text-gray-400">Included</span>}</td>
                            <td className="py-2 text-sm text-right font-medium">{amt > 0 ? formatNaira(amt) : <span className="italic text-gray-400">Included</span>}</td>
                          </tr>
                        );
                      })}

                      {editOrderItems.filter(
                        (i) =>
                          i.title.trim() &&
                          rowVisibleForInvoicePreview(i.visibility || "both", invoicePreviewAsInstaller)
                      ).length === 0 &&
                        editSvc.filter(
                          (s) =>
                            isBillableInvoiceFeeRow(s.title, parseFloat(s.amount) || 0) &&
                            rowVisibleForInvoicePreview(s.visibility || "both", invoicePreviewAsInstaller)
                        ).length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-gray-400">No items yet for this preview. Add order list items from the Order List tab and fees above, or switch &quot;Preview as&quot;.</td></tr>
                      )}
                    </tbody>
                  </table>

                  {/* Totals */}
                  {(() => {
                    const bundlePrice = orderListBundle.total_price;
                    const feesTotal = editSvc
                      .filter((svc: { title: string; amount: string; visibility?: string }) =>
                        isBillableInvoiceFeeRow(svc.title, parseFloat(svc.amount) || 0) &&
                        rowVisibleForInvoicePreview(
                          (svc.visibility as "both" | "troosolar" | "own") || "both",
                          invoicePreviewAsInstaller
                        )
                      )
                      .reduce((s: number, svc: { amount: string }) => s + (parseFloat(svc.amount) || 0), 0);
                    const netTotal = bundlePrice + feesTotal;
                    const vat = netTotal * 0.075;
                    const grandTotal = netTotal + vat;
                    return (
                      <div className="mt-4 space-y-2 border-t-2 border-gray-300 pt-4">
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-gray-800">Net-Total</span>
                          <span className="font-bold">{formatNaira(netTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">VAT (7.5%)</span>
                          <span className="font-semibold">{formatNaira(vat)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2 text-red-600">
                          <span>Grand-Total</span>
                          <span>{formatNaira(grandTotal)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default BundleMgt;
