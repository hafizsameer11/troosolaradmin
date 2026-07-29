import { useState, useEffect, useRef, useMemo } from "react";
import type { ProductData } from "./shpmgt";
import ProductDetails from "./ProductDetails";
import AddProduct from "./AddProduct";
import images from "../../constants/images";
import ProductBuilder from "./ProductBuilder";
import { useMutation } from "@tanstack/react-query";
import { deleteBundle } from "../../utils/mutations/bundle";

//Code Related to the Integration
import { getAllProducts } from "../../utils/queries/product";
import { useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { getAllBundles } from "../../utils/queries/bundle";
import { getAllCategories } from "../../utils/queries/categories";
import { getAllBrands } from "../../utils/queries/brands";
import { API_DOMAIN } from "../../../apiConfig";

/** Match Solar Store bundle category ids / titles (admin categories 25 / 26). */
const SOLAR_BUNDLES_CATEGORY_ID = "25";
const INVERTER_BUNDLES_CATEGORY_ID = "26";

const normalizeBundleTypeKey = (s: string | null | undefined) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "");

const isSolarInverterBatteryBundle = (b: { bundle_type?: string | null }) => {
  const key = normalizeBundleTypeKey(b?.bundle_type);
  return (
    key === "solar+inverter+battery" ||
    key === "solarinverterbattery" ||
    /solar.*inverter.*battery/i.test(String(b?.bundle_type || ""))
  );
};

const isInverterBatteryBundle = (b: { bundle_type?: string | null }) => {
  if (isSolarInverterBatteryBundle(b)) return false;
  const key = normalizeBundleTypeKey(b?.bundle_type);
  return (
    key === "inverter+battery" ||
    key === "inverterbattery" ||
    /inverter.*battery/i.test(String(b?.bundle_type || ""))
  );
};

const isSolarBundlesCategory = (title: string, id?: string | number | null) => {
  const idStr = id != null ? String(id) : "";
  const label = String(title || "").toLowerCase();
  return idStr === SOLAR_BUNDLES_CATEGORY_ID || /solar\s+bundle/i.test(label);
};

const isInverterBundlesCategory = (title: string, id?: string | number | null) => {
  const idStr = id != null ? String(id) : "";
  const label = String(title || "").toLowerCase();
  return (
    idStr === INVERTER_BUNDLES_CATEGORY_ID || /inverter\s+bundle/i.test(label)
  );
};

const isBundleStoreCategory = (title: string, id?: string | number | null) =>
  isSolarBundlesCategory(title, id) || isInverterBundlesCategory(title, id);

// API Response Interfaces
interface ApiProductDetail {
  id: number;
  detail: string;
  product_id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ApiProductImage {
  id: number;
  product_id: number;
  image: string;
  created_at: string;
  updated_at: string;
}

interface ApiProduct {
  id: number;
  title: string;
  category_id: number;
  brand_id: number;
  price: number;
  discount_price: number;
  discount_end_date: string;
  stock: string;
  installation_price: number | null;
  top_deal: boolean;
  installation_compulsory: boolean;
  featured_image: string;
  created_at: string;
  updated_at: string;
  old_quantity: string;
  featured_image_url: string;
  details: ApiProductDetail[];
  images: ApiProductImage[];
  reviews: unknown[];
}
interface ApiProductReview {
  rating?: number;
}

interface ApiBundleItem {
  id: number;
  product_id: number;
  quantity: number;
  created_at: string;
  updated_at: string;
}

interface ApiCustomService {
  id: number;
  name: string;
  price: number;
  created_at: string;
  updated_at: string;
}

interface ApiBundle {
  id: number;
  title: string | null;
  featured_image: string | null;
  bundle_type: string | null;
  total_price: number;
  discount_price: number;
  discount_end_date: string | null;
  created_at: string;
  updated_at: string;
  featured_image_url: string | null;
  bundle_items: ApiBundleItem[];
  custom_services: ApiCustomService[];
}

interface ApiCategory {
  id: number;
  title: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

interface ApiBrand {
  id: number;
  title: string;
  icon: string;
  category_id: number;
  created_at: string;
  updated_at: string;
}


interface DropdownProps {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
}

const CustomDropdown = ({ options, selected, onSelect }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option: string) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex justify-between w-32 cursor-pointer rounded-md border border-[#00000080] bg-white px-2 py-2 text-sm font-medium text-black shadow-sm hover:bg-gray-50 focus:outline-none"
        >
          {selected}
          <img src={images.arrow} alt="" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute mt-2 w-32 origin-top-right rounded-xl shadow-xl bg-white border border-gray-200 z-50">
          <ul className="py-2">
            {options.map((option: string, index: number) => (
              <li
                key={index}
                onClick={() => handleSelect(option)}
                className="px-2 py-2 text-black text-sm cursor-pointer hover:bg-gray-100"
              >
                {option}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Product = () => {
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(
    null
  );
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<unknown>(null);
  const [selectedCategory, setSelectedCategory] = useState("Categories");
  const [selectedAvailability, setSelectedAvailability] =
    useState("Availability");
  const [searchQuery, setSearchQuery] = useState("");
  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [bundleImageLoadingStates, setBundleImageLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [showBundleActionsModal, setShowBundleActionsModal] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [editBundleData, setEditBundleData] = useState<any>(null);
  const [isProductBuilderOpen, setIsProductBuilderOpen] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const itemsPerPage = 12;

  // Get token from cookies
  const token = Cookies.get('token') || '';

  // Fetch products data
  const {
    data: productsResponse,
    isLoading: productsLoading,
    error: productsError
  } = useQuery({
    queryKey: ['products'],
    queryFn: () => getAllProducts(token),
    enabled: !!token,
  });

  // Fetch bundles data
  const {
    data: bundlesResponse,
    isLoading: bundlesLoading,
    error: bundlesError
  } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => getAllBundles(token),
    enabled: !!token,
  });

  // Fetch categories data
  const {
    data: categoriesResponse,
    isLoading: categoriesLoading
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getAllCategories(token),
    enabled: !!token,
  });

  // Fetch brands data
  const {
    data: brandsResponse,
    isLoading: brandsLoading
  } = useQuery({
    queryKey: ['brands'],
    queryFn: () => getAllBrands(token),
    enabled: !!token,
  });

  // Extract data from API responses
  const apiProducts: ApiProduct[] = useMemo(() => (productsResponse as { data?: ApiProduct[] })?.data || [], [productsResponse]);
  const apiBundles: ApiBundle[] = useMemo(() => (bundlesResponse as { data?: ApiBundle[] })?.data || [], [bundlesResponse]);
  const apiCategories: ApiCategory[] = useMemo(() => (categoriesResponse as { data?: ApiCategory[] })?.data || [], [categoriesResponse]);
  const apiBrands: ApiBrand[] = useMemo(() => (brandsResponse as { data?: ApiBrand[] })?.data || [], [brandsResponse]);

  // Helper function to format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Helper function to calculate discount percentage
  const calculateDiscountPercentage = (originalPrice: number, discountPrice: number) => {
    if (originalPrice <= 0 || discountPrice <= 0) return 0;
    // Only calculate discount if discount price is less than original price
    if (discountPrice >= originalPrice) return 0;
    return Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
  };

  const parseStockQuantity = (value: string | number | null | undefined) => {
    if (value == null) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value).trim().toLowerCase();
    if (!text) return 0;
    const numeric = Number(text);
    if (Number.isFinite(numeric)) return numeric;
    if (text.includes("out of stock") || text === "unavailable" || text === "false") return 0;
    if (text.includes("in stock") || text === "available" || text === "true") return 1;
    const extracted = Number(text.replace(/[^\d.]/g, ""));
    return Number.isFinite(extracted) ? extracted : 0;
  };

  const parseOldQuantity = (value: string | number | null | undefined, fallback: number) => {
    const n = parseStockQuantity(value as string | number);
    return n > 0 ? n : Math.max(fallback, 1);
  };

  const getAverageRating = (reviews: unknown[]) => {
    const list = (Array.isArray(reviews) ? reviews : []) as ApiProductReview[];
    if (!list.length) return 0;
    const sum = list.reduce((acc, r) => acc + Number(r?.rating || 0), 0);
    return sum / list.length;
  };

  const renderStars = (rating: number) => (
    <div className="flex flex-row mt-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3 h-3 ${star <= Math.round(rating) ? "text-[#273E8E]" : "text-[#D9D9D9]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );

  // Helper function to get full image URL
  // Extract base URL from API_DOMAIN (remove /api)
  const getBaseUrl = () => {
    const apiDomain = API_DOMAIN || 'http://localhost:8000/api';
    // Remove /api from the end if present
    return apiDomain.replace(/\/api$/, '');
  };

  const getImageUrl = (imagePath: string | null) => {
    if (!imagePath) return '/assets/images/newmanbadge.png';
    if (imagePath.startsWith('http')) return imagePath;
    const baseUrl = getBaseUrl();
    return `${baseUrl}${imagePath}`;
  };

  // Filter products based on selected filters and search query
  const filteredProducts = useMemo(() => {
    let filtered = apiProducts;

    // Bundle categories are not product categories — hide products there.
    if (selectedCategory !== "Categories") {
      const selectedCategoryData = apiCategories.find(
        (cat) => cat.title === selectedCategory
      );
      if (
        selectedCategoryData &&
        isBundleStoreCategory(selectedCategoryData.title, selectedCategoryData.id)
      ) {
        return [];
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "Categories") {
      const selectedCategoryData = apiCategories.find(cat => cat.title === selectedCategory);
      if (selectedCategoryData) {
        filtered = filtered.filter(product => product.category_id === selectedCategoryData.id);
      }
    }

    // Filter by brand
    if (selectedBrand) {
      const selectedBrandData = apiBrands.find(brand => brand.id.toString() === selectedBrand);
      if (selectedBrandData) {
        filtered = filtered.filter(product => product.brand_id === selectedBrandData.id);
      }
    }

    // Filter by availability
    if (selectedAvailability === "Out of Stock") {
      filtered = filtered.filter(product => parseInt(product.stock) === 0);
    } else if (selectedAvailability === "All") {
      // Show all products (no additional filtering)
    }

    return filtered;
  }, [apiProducts, searchQuery, selectedCategory, selectedBrand, selectedAvailability, apiCategories, apiBrands]);

  const validBundles = useMemo(
    () => apiBundles.filter((b) => !!b.title && Number(b.total_price) > 0),
    [apiBundles]
  );

  const selectedCategoryMeta = useMemo(() => {
    if (selectedCategory === "Categories") return null;
    return apiCategories.find((cat) => cat.title === selectedCategory) || null;
  }, [apiCategories, selectedCategory]);

  const selectedIsBundleCategory = Boolean(
    selectedCategoryMeta &&
      isBundleStoreCategory(selectedCategoryMeta.title, selectedCategoryMeta.id)
  );

  // Bundles: show on All, or when a Solar/Inverter Bundles category is selected.
  const filteredBundles = useMemo(() => {
    // Product-only filters hide bundles (except bundle store categories).
    if (selectedAvailability === "Out of Stock") return [];
    if (selectedCategory !== "Categories" && !selectedIsBundleCategory) {
      return [];
    }
    // Brand filter is product-oriented; hide bundles when a brand is chosen
    // unless we are on a bundle category (then keep type filter only).
    if (selectedBrand && !selectedIsBundleCategory) return [];

    let filtered = validBundles;

    if (selectedIsBundleCategory && selectedCategoryMeta) {
      if (isSolarBundlesCategory(selectedCategoryMeta.title, selectedCategoryMeta.id)) {
        filtered = filtered.filter((b) => isSolarInverterBatteryBundle(b));
      } else if (
        isInverterBundlesCategory(selectedCategoryMeta.title, selectedCategoryMeta.id)
      ) {
        filtered = filtered.filter((b) => isInverterBatteryBundle(b));
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((b) =>
        String(b.title || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [
    validBundles,
    searchQuery,
    selectedCategory,
    selectedBrand,
    selectedAvailability,
    selectedIsBundleCategory,
    selectedCategoryMeta,
  ]);

  type CatalogItem =
    | { kind: "product"; product: ApiProduct }
    | { kind: "bundle"; bundle: ApiBundle };

  // Interleave on All; bundle categories → bundles only; product categories → products only
  const catalogItems = useMemo(() => {
    const products: CatalogItem[] = filteredProducts.map((product) => ({
      kind: "product",
      product,
    }));
    const bundles: CatalogItem[] = filteredBundles.map((bundle) => ({
      kind: "bundle",
      bundle,
    }));

    if (selectedIsBundleCategory) {
      return bundles;
    }
    if (selectedCategory !== "Categories") {
      return products;
    }

    const mixed: CatalogItem[] = [];
    const maxLen = Math.max(products.length, bundles.length);
    for (let i = 0; i < maxLen; i += 1) {
      if (i < products.length) mixed.push(products[i]);
      if (i < bundles.length) mixed.push(bundles[i]);
    }
    return mixed;
  }, [
    filteredProducts,
    filteredBundles,
    selectedCategory,
    selectedIsBundleCategory,
  ]);

  const paginatedCatalog = useMemo(() => {
    const start = (catalogPage - 1) * itemsPerPage;
    return catalogItems.slice(start, start + itemsPerPage);
  }, [catalogItems, catalogPage]);

  const catalogTotalPages = Math.max(
    1,
    Math.ceil(catalogItems.length / itemsPerPage)
  );

  useEffect(() => {
    setCatalogPage(1);
  }, [
    searchQuery,
    selectedCategory,
    selectedBrand,
    selectedAvailability,
    catalogItems.length,
  ]);

  // Handle image loading states
  const handleImageLoad = (imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
  };

  const handleImageError = (imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
  };

  const handleBundleImageLoad = (imageId: string) => {
    setBundleImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
  };

  const handleBundleImageError = (imageId: string) => {
    setBundleImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
  };

  // Set initial loading states for images
  useEffect(() => {
    if (apiProducts.length > 0) {
      const initialStates: { [key: string]: boolean } = {};
      apiProducts.forEach(product => {
        initialStates[`product-${product.id}`] = true;
      });
      setImageLoadingStates(initialStates);
    }
  }, [apiProducts]);

  useEffect(() => {
    if (apiBundles.length > 0) {
      const initialStates: { [key: string]: boolean } = {};
      apiBundles.forEach(bundle => {
        initialStates[`bundle-${bundle.id}`] = true;
      });
      setBundleImageLoadingStates(initialStates);
    }
  }, [apiBundles]);

  // Brand options from API data
  const brandOptions = useMemo(() => {
    if (brandsLoading) {
      return [{
        value: "",
        label: "Loading...",
        icon: null,
      }];
    }

    return apiBrands.map(brand => ({
      value: brand.id.toString(),
      label: brand.title,
      icon: getImageUrl(brand.icon),
    }));
  }, [apiBrands, brandsLoading]);

  // Custom dropdown handlers
  const handleBrandSelect = (brand: {
    value: string;
    label: string;
    icon: string | null;
  }) => {
    setSelectedBrand(brand.value);
    setIsBrandDropdownOpen(false);
  };

  const toggleBrandDropdown = () => {
    setIsBrandDropdownOpen(!isBrandDropdownOpen);
  };


  // Handle opening product details modal
  const handleViewDetails = (product: ProductData) => {
    setSelectedProduct(product);
    setIsProductDetailsOpen(true);
  };

  const handleCloseProductDetails = () => {
    setIsProductDetailsOpen(false);
    setSelectedProduct(null);
  };

  const handleEditProduct = (product: unknown) => {
    setEditingProduct(product);
    setIsAddProductOpen(true);
    setIsProductDetailsOpen(false);
  };

  const handleCloseAddProduct = () => {
    setIsAddProductOpen(false);
    setEditingProduct(null);
  };

  // Delete bundle mutation
  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: number | string) => {
      return await deleteBundle(bundleId, token || "");
    },
    onSuccess: () => {
      setShowBundleActionsModal(false);
      setSelectedBundle(null);
      // Optionally refetch bundles/orders here if needed
      window.location.reload(); // Or use queryClient.invalidateQueries if using react-query for bundles
    },
    onError: (_error) => {
      alert("Failed to delete bundle. Please try again.");
      setShowBundleActionsModal(false);
      setSelectedBundle(null);
    },
  });

  // Handler to open bundle actions modal
  const handleBundleActions = (bundle: any) => {
    setSelectedBundle(bundle);
    setShowBundleActionsModal(true);
  };

  // Handler for edit bundle
  const handleEditBundle = () => {
    setEditBundleData(selectedBundle);
    setIsProductBuilderOpen(true);
    setShowBundleActionsModal(false);
  };

  // Handler for delete bundle
  const handleDeleteBundle = () => {
    if (selectedBundle) {
      deleteBundleMutation.mutate(selectedBundle.id);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        brandDropdownRef.current &&
        !brandDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBrandDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      {/* Header with filters */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          {/* Filter Dropdowns */}
          <CustomDropdown
            options={[
              "Categories",
              ...(categoriesLoading ? ["Loading..."] : apiCategories.map(cat => cat.title))
            ]}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />

          <div className="relative" ref={brandDropdownRef}>
            <button
              onClick={toggleBrandDropdown}
              className="px-4 py-2 border border-[#00000080] rounded-lg text-sm font-medium bg-white hover:bg-gray-100 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer flex items-center justify-between w-[120px]"
            >
              <span>
                {selectedBrand
                  ? brandOptions.find((opt) => opt.value === selectedBrand)
                    ?.label
                  : "Brand"}
              </span>

              <svg
                className="w-4 h-4 text-gray-500 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isBrandDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-2xl shadow-xl z-50 overflow-y-auto p-2"
                style={{ width: "400px", height: "auto", maxHeight: "450px" }}
              >
                {brandOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleBrandSelect(option)}
                    className={`w-full flex items-center px-4 py-4 rounded-2xl mb-2 transition-colors ${selectedBrand === option.value
                      ? "bg-blue-50 text-blue-600"
                      : "bg-[#f3f3f3] text-gray-800 hover:bg-gray-200"
                      }`}
                  >
                    <div className="w-14 h-14 mr-4 flex items-center justify-center bg-[#bebef1] rounded-full">
                      <img
                        src={option.icon || ''}
                        alt={option.label}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                    <span className="text-lg font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <CustomDropdown
            options={["Availability", "All", "Out of Stock"]}
            selected={selectedAvailability}
            onSelect={setSelectedAvailability}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search products & bundles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-[#00000080] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-180"
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

      {/* Main Content Layout — products & bundles interleaved in one grid */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-6">All Products & Bundles</h2>

        {productsLoading || bundlesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {[...Array(8)].map((_, _index) => (
              <div
                key={_index}
                className="bg-white rounded-2xl border border-[#CDCDCD] shadow-sm animate-pulse"
              >
                <div className="aspect-square bg-gray-200 rounded-t-2xl"></div>
                <div className="p-2.5">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="border-b border-t pt-3 pb-3 border-[#CDCDCD]">
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="flex justify-between items-center mt-5">
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-8 bg-gray-200 rounded-full w-20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : productsError && bundlesError ? (
          <div className="text-center py-8">
            <p className="text-red-500">Error loading catalog. Please try again.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {catalogItems.length > 0 ? (
                paginatedCatalog.map((item) => {
                  if (item.kind === "product") {
                    const product = item.product;
                    const discountPercentage = calculateDiscountPercentage(
                      product.price,
                      product.discount_price
                    );
                    const stockQty = parseStockQuantity(product.stock);
                    const oldQty = parseOldQuantity(product.old_quantity, stockQty);
                    const stockPercentage = Math.max(
                      0,
                      Math.min(100, Math.round((stockQty / oldQty) * 100))
                    );
                    const avgRating = getAverageRating(product.reviews);

                    const convertedProduct: ProductData = {
                      id: product.id.toString(),
                      name: product.title,
                      category: "Solar Equipment",
                      price: formatPrice(product.discount_price),
                      stock: stockQty,
                      status: "Active",
                      image: getImageUrl(product.featured_image_url),
                      description:
                        product.details.map((d) => d.detail).join(", ") ||
                        "No description available",
                    };

                    return (
                      <div
                        key={`product-${product.id}`}
                        onClick={() => handleViewDetails(convertedProduct)}
                        className="bg-white rounded-2xl border border-[#CDCDCD] shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden cursor-pointer"
                      >
                        <div
                          className="aspect-square bg-white overflow-hidden p-2.5 relative"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(convertedProduct);
                          }}
                        >
                          {imageLoadingStates[`product-${product.id}`] && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#273E8E]"></div>
                            </div>
                          )}
                          <img
                            src={getImageUrl(product.featured_image_url)}
                            alt={product.title}
                            className="w-full h-full object-cover cursor-pointer"
                            onLoad={() => handleImageLoad(`product-${product.id}`)}
                            onError={() => {
                              handleImageError(`product-${product.id}`);
                              const img = document.querySelector(
                                `img[alt="${product.title}"]`
                              ) as HTMLImageElement;
                              if (img) img.src = "/assets/images/newmanbadge.png";
                            }}
                            style={{
                              display: imageLoadingStates[`product-${product.id}`]
                                ? "none"
                                : "block",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(convertedProduct);
                            }}
                          />
                        </div>

                        <div className="p-2.5">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-medium text-black text-md leading-tight">
                              {product.title}
                            </h3>
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#273E8E] bg-[#273E8E14] px-2 py-0.5 rounded-full">
                              Product
                            </span>
                          </div>

                          <div className="border-b border-t pt-3 pb-3 border-[#CDCDCD] flex flex-row justify-between">
                            <div className="flex flex-col">
                              <div>
                                <span className="text-[#273E8E] font-bold text-[20px]">
                                  {formatPrice(product.discount_price)}
                                </span>
                              </div>
                              <div className="flex flex-row gap-1.5">
                                {discountPercentage > 0 && (
                                  <>
                                    <div>
                                      <span className="line-through text-[#00000080] text-[13px]">
                                        {formatPrice(product.price)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#FFA500] bg-[#FFA50033] rounded-full p-1 text-[10px]">
                                        -{discountPercentage}%
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col mt-[-5px]">
                              <div>
                                <span className="text-sm font-medium text-black text-[10px]">
                                  {stockQty}/{oldQty}
                                </span>
                                <div className="w-16 bg-[#D9D9D9] rounded-full h-2 mt-1">
                                  <div
                                    className="bg-gradient-to-r from-red-600 to-green-600 h-2 rounded-full"
                                    style={{ width: `${stockPercentage}%` }}
                                  ></div>
                                </div>
                              </div>
                              {renderStars(avgRating)}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-5">
                            <span className="text-xs font-semibold text-black text-[15px]">
                              {stockQty} Stocks
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(convertedProduct);
                              }}
                              className="bg-[#273E8E] hover:bg-[#1e3270] text-white py-3 px-6 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const bundle = item.bundle;
                  const discountPercentage = calculateDiscountPercentage(
                    bundle.total_price,
                    bundle.discount_price
                  );
                  const borderColor =
                    bundle.bundle_type === "Mini" ? "#800080" : "#FF0000";

                  return (
                    <div
                      key={`bundle-${bundle.id}`}
                      className="bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden cursor-pointer"
                      style={{ borderColor }}
                      onClick={() => handleBundleActions(bundle)}
                    >
                      <div className="aspect-square bg-white overflow-hidden p-2.5 relative">
                        {bundleImageLoadingStates[`bundle-${bundle.id}`] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#273E8E]"></div>
                          </div>
                        )}
                        <img
                          src={getImageUrl(bundle.featured_image_url)}
                          alt={bundle.title || "Bundle"}
                          className="w-full h-full object-contain"
                          onLoad={() => handleBundleImageLoad(`bundle-${bundle.id}`)}
                          onError={() => {
                            handleBundleImageError(`bundle-${bundle.id}`);
                            const img = document.querySelector(
                              `img[alt="${bundle.title}"]`
                            ) as HTMLImageElement;
                            if (img) {
                              img.src =
                                bundle.bundle_type === "Mini"
                                  ? images.minibundle
                                  : images.maxibundle;
                            }
                          }}
                          style={{
                            display: bundleImageLoadingStates[`bundle-${bundle.id}`]
                              ? "none"
                              : "block",
                          }}
                        />
                      </div>
                      <div className="p-2.5">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-medium text-gray-900 text-md leading-tight">
                            {bundle.title}
                          </h3>
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#E8A91D] bg-[#E8A91D22] px-2 py-0.5 rounded-full">
                            Bundle
                          </span>
                        </div>
                        <div className="border-t pt-3 pb-3 border-[#CDCDCD] flex flex-row justify-between">
                          <div className="flex flex-col">
                            <div>
                              <span className="text-[#273E8E] font-bold text-[20px]">
                                {formatPrice(bundle.discount_price)}
                              </span>
                            </div>
                            <div className="flex flex-row gap-1.5">
                              {discountPercentage > 0 && (
                                <>
                                  <div>
                                    <span className="line-through text-[#00000080] text-[13px]">
                                      {formatPrice(bundle.total_price)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[#FFA500] bg-[#FFA50033] rounded-full p-1 text-[10px]">
                                      -{discountPercentage}%
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col mt-[-5px]">
                            <div>
                              <span className="text-sm font-medium text-black text-[10px]">
                                {bundle.bundle_items.length} items
                              </span>
                              <div className="w-16 bg-[#D9D9D9] rounded-full h-2 mt-1">
                                <div
                                  className="bg-gradient-to-r from-red-600 to-green-600 h-2 rounded-full"
                                  style={{ width: "75%" }}
                                ></div>
                              </div>
                            </div>
                            {renderStars(0)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-5">
                          <span className="text-xs font-semibold text-black text-[15px]">
                            {bundle.bundle_type || "Bundle"}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBundleActions(bundle);
                            }}
                            className="bg-[#E8A91D] hover:bg-[#d89a1a] text-white py-3 px-6 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-8">
                  <p className="text-gray-500">
                    {searchQuery ||
                    selectedCategory !== "Categories" ||
                    selectedBrand ||
                    selectedAvailability !== "Availability"
                      ? selectedIsBundleCategory
                        ? "No bundles found in this category"
                        : "No items found matching your filters"
                      : "No products or bundles available"}
                  </p>
                  {(searchQuery ||
                    selectedCategory !== "Categories" ||
                    selectedBrand ||
                    selectedAvailability !== "Availability") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCategory("Categories");
                        setSelectedBrand("");
                        setSelectedAvailability("Availability");
                      }}
                      className="mt-2 text-blue-500 hover:text-blue-700 text-sm underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>
            {catalogItems.length > 0 && catalogTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-600">
                  Showing {(catalogPage - 1) * itemsPerPage + 1}-
                  {Math.min(catalogPage * itemsPerPage, catalogItems.length)} of{" "}
                  {catalogItems.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                    disabled={catalogPage === 1}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="px-2 py-1 text-xs">
                    {catalogPage}/{catalogTotalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCatalogPage((p) => Math.min(catalogTotalPages, p + 1))
                    }
                    disabled={catalogPage === catalogTotalPages}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product Details Modal */}
      <ProductDetails
        isOpen={isProductDetailsOpen}
        onClose={handleCloseProductDetails}
        product={selectedProduct}
        onEdit={handleEditProduct}
      />

      {/* Add/Edit Product Modal */}
      <AddProduct
        isOpen={isAddProductOpen}
        onClose={handleCloseAddProduct}
        editingProduct={editingProduct}
      />

      {/* Bundle Actions Modal */}
      {showBundleActionsModal && selectedBundle && (
        <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <div className="flex flex-col items-center">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Bundle Actions</h2>
              <div className="flex flex-col gap-4 w-full">
                <button
                  className="w-full py-3 px-4 bg-[#E8A91D] text-white rounded-full font-semibold text-base hover:bg-[#d89a1a] transition-colors"
                  onClick={handleEditBundle}
                >
                  Edit Bundle
                </button>
                <button
                  className="w-full py-3 px-4 bg-red-600 text-white rounded-full font-semibold text-base hover:bg-red-700 transition-colors"
                  onClick={handleDeleteBundle}
                  disabled={deleteBundleMutation.isPending}
                >
                  {deleteBundleMutation.isPending ? "Deleting..." : "Delete Bundle"}
                </button>
                <button
                  className="w-full py-3 px-4 bg-gray-200 text-gray-700 rounded-full font-semibold text-base hover:bg-gray-300 transition-colors"
                  onClick={() => setShowBundleActionsModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Builder Modal (for create or edit) */}
      <ProductBuilder
        isOpen={isProductBuilderOpen}
        onClose={() => {
          setIsProductBuilderOpen(false);
          setEditBundleData(null);
        }}
        editingBundle={editBundleData}
      />
    </>
  );
};

export default Product;
