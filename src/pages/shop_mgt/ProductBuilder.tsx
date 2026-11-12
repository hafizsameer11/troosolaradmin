import { useState, useMemo, useEffect } from 'react';
import AddCustomService from './AddCustomService';
import images from '../../constants/images';

//Code Related to the Integration
import { addBundle, type CustomAppliancePayload } from '../../utils/mutations/bundle';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Cookies from "js-cookie";
import { getAllProducts } from '../../utils/queries/product';
import { getSingleBundle } from '../../utils/queries/bundle';

import { updateBundle } from '../../utils/mutations/bundle';
import { API_DOMAIN } from '../../../apiConfig';

// API Response Interfaces
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
  details: Array<{
    id: number;
    detail: string;
    product_id: number;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  images: Array<{
    id: number;
    product_id: number;
    image: string;
    created_at: string;
    updated_at: string;
  }>;
  reviews: unknown[];
}

interface CustomService {
  title: string;
  service_amount: number;
}

interface ProductBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  editingBundle?: any; // <-- add this prop
}

const ProductBuilder = ({ isOpen, onClose, editingBundle }: ProductBuilderProps) => {
  const [selectedProducts, setSelectedProducts] = useState<ApiProduct[]>([]);
  const [bundleName, setBundleName] = useState('');
  const [bundleType, setBundleType] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [topDeal, setTopDeal] = useState(false);
  const [highlyRecommended, setHighlyRecommended] = useState(false);
  const [totalPrice, setTotalPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [discountEndDate, setDiscountEndDate] = useState('');
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [existingFeaturedPreview, setExistingFeaturedPreview] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [existingGallery, setExistingGallery] = useState<Array<{ id: number; url: string }>>([]);
  const [removeFeaturedImage, setRemoveFeaturedImage] = useState(false);
  const [removeImageIds, setRemoveImageIds] = useState<number[]>([]);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extended bundle fields (spreadsheet / solar specs)
  const [productModel, setProductModel] = useState('');
  const [systemCapacityDisplay, setSystemCapacityDisplay] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [whatIsInsideBundleText, setWhatIsInsideBundleText] = useState('');
  const [whatBundlePowersText, setWhatBundlePowersText] = useState('');
  const [backupTimeDescription, setBackupTimeDescription] = useState('');
  const [inverRating, setInverRating] = useState('');
  const [totalOutput, setTotalOutput] = useState('');
  const [totalLoad, setTotalLoad] = useState('');

  // Custom appliances (name, wattage, quantity, hours)
  const [customAppliances, setCustomAppliances] = useState<CustomAppliancePayload[]>([]);
  const [activeSection, setActiveSection] = useState<'basic' | 'specs' | 'details' | 'appliances'>('basic');

  // Get token from cookies
  const token = Cookies.get('token') || '';
  const queryClient = useQueryClient();

  // Fetch products from API
  const { data: productsResponse, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => getAllProducts(token),
    enabled: !!token && isOpen,
  });

  // Extract products data from API response
  const availableProducts: ApiProduct[] = useMemo(() =>
    (productsResponse as { data?: ApiProduct[] })?.data || [],
    [productsResponse]
  );

  // Helper function to get full image URL
  // Extract base URL from API_DOMAIN (remove /api)
  const getBaseUrl = () => {
    const apiDomain = API_DOMAIN || 'http://localhost:8000/api';
    // Remove /api from the end if present
    return apiDomain.replace(/\/api$/, '');
  };

  const getImageUrl = (imagePath: string | null | undefined) => {
    if (!imagePath) return null;
    let value = String(imagePath).trim();
    const abs = value.match(/^https?:\/\/[^/]+(\/.*)$/i);
    if (abs) value = abs[1];
    value = value.replace(/^\/storage\/public\//, '/storage/');
    value = value.replace(/^storage\/public\//, '/storage/');
    value = value.replace(/^public\//, '');
    if (value.startsWith('http')) return value;
    const baseUrl = getBaseUrl();
    if (value.startsWith('/')) return `${baseUrl}${value}`;
    return `${baseUrl}/storage/${value}`;
  };

  const handleProductSelect = (product: ApiProduct) => {
    const isSelected = selectedProducts.find(p => p.id === product.id);
    if (isSelected) {
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    } else {
      setSelectedProducts(prev => [...prev, product]);
    }
  };

  // Add bundle mutation (for create)
  const addBundleMutation = useMutation({
    mutationFn: (data: any) => addBundle(data, token),
    onSuccess: () => {
      // Invalidate and refetch bundles
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      resetForm();
      onClose();
    },
    onError: (_error: unknown) => {
      console.error('Error creating bundle:', _error);
      setIsSubmitting(false);
      alert('Error creating bundle. Please try again.');
    },
  });

  // Add update bundle mutation (for edit)
  const updateBundleMutation = useMutation({
    mutationFn: (data: { id: number; payload: any }) => updateBundle(data.id, data.payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      resetForm();
      onClose();
    },
    onError: (_error: unknown) => {
      setIsSubmitting(false);
      alert('Error updating bundle. Please try again.');
    },
  });

  const applyBundleToForm = (bundle: any) => {
    if (!bundle) return;
    setBundleName(bundle.title || "");
    setBundleType(bundle.bundle_type || "");
    setIsAvailable(bundle.is_available !== false);
    setTopDeal(bundle.top_deal === true);
    setHighlyRecommended(bundle.is_most_popular === true);
    setTotalPrice(bundle.total_price ? String(bundle.total_price) : "");
    setDiscountPrice(bundle.discount_price ? String(bundle.discount_price) : "");
    setDiscountEndDate(bundle.discount_end_date || "");
    setProductModel(bundle.product_model || "");
    setSystemCapacityDisplay(bundle.system_capacity_display || "");
    setDetailedDescription(bundle.detailed_description || "");
    setWhatIsInsideBundleText(bundle.what_is_inside_bundle_text || "");
    setWhatBundlePowersText(bundle.what_bundle_powers_text || "");
    setBackupTimeDescription(bundle.backup_time_description || "");
    setInverRating(bundle.inver_rating || "");
    setTotalOutput(bundle.total_output || "");
    setTotalLoad(bundle.total_load ?? "");
    setCustomAppliances(bundle.custom_appliances || []);
    if (bundle.bundle_items && Array.isArray(bundle.bundle_items)) {
      const productIds = bundle.bundle_items.map((item: any) => item.product_id);
      const selected = availableProducts.filter(p => productIds.includes(p.id));
      setSelectedProducts(selected);
    }
    setCustomServices(bundle.custom_services || []);
    setFeaturedImage(null);
    setRemoveFeaturedImage(false);
    setRemoveImageIds([]);
    setGalleryImages([]);
    setExistingFeaturedPreview(
      getImageUrl(bundle.featured_image_url || bundle.featured_image || null)
    );
    setExistingGallery(
      (Array.isArray(bundle.images) ? bundle.images : [])
        .map((img: { id?: number; image?: string; image_url?: string }) => {
          const url = getImageUrl(img.image_url || img.image);
          if (!url || !img.id) return null;
          return { id: Number(img.id), url };
        })
        .filter(Boolean) as Array<{ id: number; url: string }>
    );
  };

  // Populate form when editing a bundle (refresh from show API so images appear)
  useEffect(() => {
    if (!isOpen) return;
    if (!editingBundle) {
      resetForm();
      return;
    }
    applyBundleToForm(editingBundle);
    let cancelled = false;
    if (editingBundle.id) {
      getSingleBundle(String(editingBundle.id), token)
        .then((res) => {
          if (cancelled) return;
          const full = (res as any)?.data ?? res;
          if (full?.id) applyBundleToForm(full);
        })
        .catch((e) => console.error('Failed to load full bundle for shop edit', e));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, [editingBundle, isOpen, availableProducts]);

  const handleCreateOrUpdateBundle = () => {
    const hasProducts = selectedProducts.length > 0;
    const validCustomAppliances = customAppliances.filter(a => a.name.trim() && a.wattage > 0);

    if (!bundleName || !bundleType || !totalPrice) {
      alert('Please fill in Bundle Name, Bundle Type, and Total Price');
      return;
    }
    if (!featuredImage && !editingBundle && !existingFeaturedPreview) {
      alert('Please select a featured image');
      return;
    }
    setIsSubmitting(true);

    const bundleData: Record<string, unknown> = {
      title: bundleName,
      bundle_type: bundleType,
      is_available: isAvailable,
      top_deal: topDeal,
      is_most_popular: highlyRecommended,
      total_price: parseFloat(totalPrice),
      discount_price: discountPrice ? parseFloat(discountPrice) : undefined,
      discount_end_date: discountEndDate || undefined,
      featured_image: featuredImage || undefined,
      images: galleryImages.length > 0 ? galleryImages : undefined,
      remove_featured_image: removeFeaturedImage && !featuredImage ? true : undefined,
      remove_image_ids: removeImageIds.length > 0 ? removeImageIds : undefined,
      items: hasProducts ? selectedProducts.map(p => p.id) : undefined,
      custom_services: customServices.length > 0 ? customServices : undefined,
      product_model: productModel || undefined,
      system_capacity_display: systemCapacityDisplay || undefined,
      detailed_description: detailedDescription || undefined,
      what_is_inside_bundle_text: whatIsInsideBundleText || undefined,
      what_bundle_powers_text: whatBundlePowersText || undefined,
      backup_time_description: backupTimeDescription || undefined,
      inver_rating: inverRating || undefined,
      total_output: totalOutput || undefined,
      total_load: bundleType === 'Solar+Inverter+Battery' ? (totalLoad || undefined) : null,
      custom_appliances: validCustomAppliances.length > 0
        ? validCustomAppliances.map(a => ({
          name: a.name.trim(),
          wattage: Number(a.wattage),
          quantity: a.quantity ?? 1,
          estimated_daily_hours_usage: a.estimated_daily_hours_usage,
        }))
        : undefined,
    };

    if (editingBundle) {
      updateBundleMutation.mutate({ id: editingBundle.id, payload: bundleData });
    } else {
      addBundleMutation.mutate(bundleData);
    }
  };

  const resetForm = () => {
    setSelectedProducts([]);
    setBundleName('');
    setBundleType('');
    setIsAvailable(true);
    setTopDeal(false);
    setHighlyRecommended(false);
    setTotalPrice('');
    setDiscountPrice('');
    setDiscountEndDate('');
    setFeaturedImage(null);
    setExistingFeaturedPreview(null);
    setGalleryImages([]);
    setExistingGallery([]);
    setRemoveFeaturedImage(false);
    setRemoveImageIds([]);
    setCustomServices([]);
    setProductModel('');
    setSystemCapacityDisplay('');
    setDetailedDescription('');
    setWhatIsInsideBundleText('');
    setWhatBundlePowersText('');
    setBackupTimeDescription('');
    setInverRating('');
    setTotalOutput('');
    setTotalLoad('');
    setCustomAppliances([]);
    setActiveSection('basic');
    setIsSubmitting(false);
  };

  const addCustomAppliance = () => {
    setCustomAppliances(prev => [...prev, { name: '', wattage: 0, quantity: 1, estimated_daily_hours_usage: undefined }]);
  };

  const updateCustomAppliance = (index: number, field: keyof CustomAppliancePayload, value: string | number | undefined) => {
    setCustomAppliances(prev => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = value;
      return next;
    });
  };

  const removeCustomAppliance = (index: number) => {
    setCustomAppliances(prev => prev.filter((_, i) => i !== index));
  };

  const handleFeaturedImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFeaturedImage(file);
      setRemoveFeaturedImage(false);
    }
  };

  const handleGalleryUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      setGalleryImages((prev) => [...prev, ...files].slice(0, 12));
    }
    event.target.value = '';
  };

  const handleAddCustomService = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Stop event bubbling
    setIsAddServiceOpen(true);
    // Keep ProductBuilder open when opening AddCustomService
  };

  const handleCloseAddService = () => {
    setIsAddServiceOpen(false);
  };

  const formatPrice = (price: number) => {
    return `₦${price.toLocaleString()}`;
  };

  if (!isOpen) return null;

  const sectionTabs = [
    { id: 'basic' as const, label: 'Basic' },
    { id: 'specs' as const, label: 'Specs' },
    { id: 'details' as const, label: 'Details' },
    { id: 'appliances' as const, label: 'Custom Load' },
  ];

  return (
    <div className="fixed inset-0 backdrop-brightness-50 bg-opacity-50 flex items-start justify-end z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[100vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingBundle ? "Edit Bundle" : "Product Builder"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer"
          >
            <img src={images.cross} className="w-7 h-7" alt="" />
          </button>
        </div>

        <div className="p-4">
          {/* Section tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {sectionTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`px-3 py-2 text-sm font-medium rounded-t transition-colors ${
                  activeSection === tab.id
                    ? 'border-b-2 border-[#273E8E] text-[#273E8E] bg-gray-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Basic: Product list + name, type, image, price */}
          {activeSection === 'basic' && (
            <>
          <p className="text-xs text-gray-500 mb-2">Optional: select products below, or use the <strong>Custom Load</strong> tab to add appliances by name and wattage only.</p>
          {/* Product List */}
          <div className="space-y-3 mb-6">
            {productsLoading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-5 bg-gray-200 rounded animate-pulse w-20"></div>
                  </div>
                  <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))
            ) : availableProducts.length > 0 ? (
              availableProducts.map((product) => {
                const isSelected = selectedProducts.find(p => p.id === product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={getImageUrl(product.featured_image_url) || '/assets/images/newman1.png'}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/assets/images/newman1.png';
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">{product.title}</h3>
                      <p className="text-lg font-semibold text-gray-900">{formatPrice(product.price)}</p>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                      }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No products available
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Bundle Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bundle Name *
              </label>
              <input
                type="text"
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder="Enter bundle name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Bundle Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bundle Type *
              </label>
              <select
                value={bundleType}
                onChange={(e) => setBundleType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select bundle type</option>
                <option value="Inverter + Battery">Inverter + Battery</option>
                <option value="Solar+Inverter+Battery">Solar+Inverter+Battery</option>
                <option value="Custom Bundle">Custom Bundle</option>
                <option value="solar_package">Solar Package</option>
                <option value="inverter_package">Inverter Package</option>
                <option value="battery_package">Battery Package</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Availability
              </label>
              <select
                value={isAvailable ? "available" : "unavailable"}
                onChange={(e) => setIsAvailable(e.target.value === "available")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="available">Available (show on public app)</option>
                <option value="unavailable">Unavailable (hide from public app)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={topDeal}
                  onChange={(e) => setTopDeal(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Mark as Top deal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highlyRecommended}
                  onChange={(e) => setHighlyRecommended(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Highly recommended (show first in lists)</span>
              </label>
            </div>

            {/* Featured + Additional Images */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Featured Image {editingBundle ? '' : '*'}
                </label>
                <p className="text-xs text-gray-500 mb-3">Select the main bundle image</p>

                <div className="w-full">
                  {featuredImage ? (
                    <div className="w-32 h-24 border border-gray-300 rounded-lg overflow-hidden relative">
                      <img
                        src={URL.createObjectURL(featuredImage)}
                        alt="Featured Bundle"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFeaturedImage(null)}
                        className="absolute top-0 -right-0 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                      >
                        <span className='mb-1'>×</span>
                      </button>
                    </div>
                  ) : existingFeaturedPreview && !removeFeaturedImage ? (
                    <div className="w-32 h-24 border border-gray-300 rounded-lg overflow-hidden relative">
                      <img
                        src={existingFeaturedPreview}
                        alt="Current Featured Bundle"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-1 rounded">
                        Current
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setExistingFeaturedPreview(null);
                          setRemoveFeaturedImage(true);
                        }}
                        className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                        title="Remove featured image"
                      >
                        <span className="mb-1">×</span>
                      </button>
                      <label className="absolute -top-1 -left-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center cursor-pointer hover:bg-blue-600">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFeaturedImageUpload}
                          className="hidden"
                        />
                        +
                      </label>
                    </div>
                  ) : (
                    <label className="w-32 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFeaturedImageUpload}
                        className="hidden"
                      />
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Images
                </label>
                <p className="text-xs text-gray-500 mb-3">Upload multiple pictures for this bundle</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryUpload}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  {existingGallery.map((img) => (
                    <div key={img.id} className="relative">
                      <img src={img.url} alt="Bundle" className="w-20 h-16 object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveImageIds((prev) => [...prev, img.id]);
                          setExistingGallery((prev) => prev.filter((g) => g.id !== img.id));
                        }}
                        className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                        title="Remove image"
                      >
                        <span className="mb-1">×</span>
                      </button>
                    </div>
                  ))}
                  {galleryImages.map((file, idx) => (
                    <div key={`new-${idx}`} className="relative">
                      <img src={URL.createObjectURL(file)} alt="New" className="w-20 h-16 object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => setGalleryImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                        title="Remove image"
                      >
                        <span className="mb-1">×</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Total Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Price *
              </label>
              <input
                type="number"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="Enter total price"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Discount Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Price
              </label>
              <input
                type="text"
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value)}
                placeholder="Enter discount price"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Discount End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount End Date
              </label>
              <input
                type="date"
                value={discountEndDate}
                onChange={(e) => setDiscountEndDate(e.target.value)}
                placeholder="dd/mm/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
            </>
          )}

          {/* Specs: inver_rating, total_output, total_load, product_model, system_capacity_display */}
          {activeSection === 'specs' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Model</label>
              <input
                type="text"
                value={productModel}
                onChange={(e) => setProductModel(e.target.value)}
                placeholder="e.g. OG-1P1K2-T - 1.2kVA Yinergy Inverter / GCL 12100 12V 1.3kWh Cworth Battery"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">System Capacity (display)</label>
              <input
                type="text"
                value={systemCapacityDisplay}
                onChange={(e) => setSystemCapacityDisplay(e.target.value)}
                placeholder="e.g. 1.2kVA Inverter & 1.3kWh Lithium Ion Battery"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Inverter Rating (kVA)</label>
                <input
                  type="text"
                  value={inverRating}
                  onChange={(e) => setInverRating(e.target.value)}
                  placeholder="e.g. 1.2 kVA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Battery / Total Output (kWh)</label>
                <input
                  type="text"
                  value={totalOutput}
                  onChange={(e) => setTotalOutput(e.target.value)}
                  placeholder="e.g. 1.3 kWh"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {bundleType === 'Solar+Inverter+Battery' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Load / Solar (W or kW)</label>
                <input
                  type="text"
                  value={totalLoad}
                  onChange={(e) => setTotalLoad(e.target.value)}
                  placeholder="e.g. 600 W or 1.2 kWp"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
          )}

          {/* Details: detailed_description, what_is_inside, what_powers, backup_time */}
          {activeSection === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Description</label>
              <textarea
                rows={4}
                value={detailedDescription}
                onChange={(e) => setDetailedDescription(e.target.value)}
                placeholder="Full description of the bundle and what it powers..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What is inside the bundle</label>
              <textarea
                rows={2}
                value={whatIsInsideBundleText}
                onChange={(e) => setWhatIsInsideBundleText(e.target.value)}
                placeholder="e.g. 1 unit 1.2kVA Inverter, 1 unit 1.3kWh Battery & Installation Materials"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What the bundle will power</label>
              <textarea
                rows={3}
                value={whatBundlePowersText}
                onChange={(e) => setWhatBundlePowersText(e.target.value)}
                placeholder="e.g. 6–10 LED bulbs, 1 LED TV, 1 Decoder, 1 Fan, 1 Laptop, Wi-Fi, Small speakers"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Back-up time description</label>
              <textarea
                rows={2}
                value={backupTimeDescription}
                onChange={(e) => setBackupTimeDescription(e.target.value)}
                placeholder="e.g. 1–9 hours depending on load; from sunset to sunrise or when grid is unavailable"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          )}

          {/* Custom appliances: name, wattage, quantity, hours */}
          {activeSection === 'appliances' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Add custom appliances with wattage for load calculation (e.g. Fridge 200W, LED TV 20W).</p>
            <button
              type="button"
              onClick={addCustomAppliance}
              className="text-[#273E8E] text-sm font-medium hover:underline"
            >
              + Add appliance
            </button>
            {customAppliances.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2">Appliance</th>
                      <th className="text-left p-2">Wattage (W)</th>
                      <th className="text-left p-2">Qty</th>
                      <th className="text-left p-2">Hours/day</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {customAppliances.map((app, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-2">
                          <input
                            type="text"
                            value={app.name}
                            onChange={(e) => updateCustomAppliance(i, 'name', e.target.value)}
                            placeholder="e.g. Fridge"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            value={app.wattage || ''}
                            onChange={(e) => updateCustomAppliance(i, 'wattage', e.target.value ? Number(e.target.value) : 0)}
                            placeholder="W"
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            value={app.quantity ?? 1}
                            onChange={(e) => updateCustomAppliance(i, 'quantity', e.target.value ? Number(e.target.value) : 1)}
                            className="w-14 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={app.estimated_daily_hours_usage ?? ''}
                            onChange={(e) => updateCustomAppliance(i, 'estimated_daily_hours_usage', e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="hrs"
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => removeCustomAppliance(i)}
                            className="text-red-600 hover:underline text-xs"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 mt-6">

            <button
              type="button"
              onClick={handleAddCustomService}
              className="w-full py-3 px-4 cursor-pointer border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-full transition-colors"
            >
              Add Custom Service
            </button>

            <button
              type="button"
              onClick={handleCreateOrUpdateBundle}
              disabled={isSubmitting}
              className={`w-full py-3 px-4 font-medium rounded-full transition-colors flex items-center justify-center ${isSubmitting
                ? 'bg-gray-400 cursor-not-allowed text-white '
                : editingBundle
                  ? 'bg-[#E8A91D] cursor-pointer hover:bg-[#d89a1a]'
                  : 'bg-blue-900 cursor-pointer hover:bg-blue-800'
                }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center text-white">
                  <div className="animate-spin text-white rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {editingBundle ? "Updating Bundle..." : "Creating Bundle..."}
                </div>
              ) : (
                <span className="text-white">
                  {editingBundle ? "Update Bundle" : "Create Bundle"}
                </span>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* AddCustomService Modal */}
      {isAddServiceOpen && (
        <AddCustomService
          isOpen={isAddServiceOpen}
          onClose={handleCloseAddService}
        />
      )}
    </div>
  );
};

export default ProductBuilder;
