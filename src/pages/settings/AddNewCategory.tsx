import { useState, useEffect } from "react";
import images from "../../constants/images";
import { addCategory } from "../../utils/mutations/categories";
import Cookies from "js-cookie";
import axios from "axios";
import { API_DOMAIN } from "../../../apiConfig";

interface AddNewCategoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categoryName: string, image: File | null, status: string) => void;
  editMode?: boolean;
  editData?: any;
}

const AddNewCategory = ({
  isOpen,
  onClose,
  onSave,
  editMode = false,
  editData,
}: AddNewCategoryProps) => {
  const [categoryName, setCategoryName] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const token = Cookies.get("token");

  useEffect(() => {
    if (editMode && editData) {
      setCategoryName(editData.categoryName || "");
      setStatus(editData.status || "");
      setImagePreview(editData.image || null);
      setSelectedImage(null);

      console.log("🔍 Modal opened in edit mode:", {
        editData,
        categoryName: editData.categoryName,
        status: editData.status,
        imagePreview: editData.image,
      });
    } else {
      setCategoryName("");
      setSelectedImage(null);
      setStatus("Active");
      setImagePreview(null);
      console.log("🔍 Modal opened in add mode → state reset");
    }
  }, [editMode, editData, isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("Please select an image smaller than 5MB");
        return;
      }
      setSelectedImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      console.log("🖼️ New image selected:", file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        setSelectedImage(file);
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
        console.log("🖼️ Image dropped:", file);
      } else {
        alert("Please drop a valid image file");
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      if (!editMode) {
        // ADD FLOW
        if (categoryName && selectedImage && status) {
          console.log("🟢 Adding category:", {
            title: categoryName,
            status,
            icon: selectedImage.name,
          });

          await addCategory(
            { title: categoryName, icon: selectedImage, status },
            token || ""
          );
        }
      } else if (editData && categoryName && status) {
        // UPDATE FLOW → manual axios call
        const formData = new FormData();
        formData.append("title", categoryName);
        formData.append("status", status);
        if (selectedImage) {
          formData.append("icon", selectedImage);
        }

        console.log(
          "🟠 Updating category FormData:",
          Array.from(formData.entries())
        );

        await axios.post(
          `${API_DOMAIN}/categories/${editData.id}/update`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      await onSave(categoryName, selectedImage, status);

      // reset form
      setCategoryName("");
      setSelectedImage(null);
      setStatus("");
      setImagePreview(null);
      onClose();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setCategoryName("");
    setSelectedImage(null);
    setStatus("");
    setImagePreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-brightness-50 bg-opacity-50 flex items-start justify-end z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {editMode ? "Edit Category" : "Add Category"}
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors"
          >
            <img src={images.cross} alt="" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Category Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Name
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Type category name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#273E8E] focus:border-[#273E8E] outline-none transition-colors"
            />
          </div>

          {/* Category Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Image
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById("imageUpload")?.click()}
            >
              {imagePreview ? (
                <div className="space-y-4">
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-lg mx-auto border-2 border-gray-200"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      {selectedImage?.name}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById("imageUpload")?.click();
                      }}
                      className="text-[#273E8E] text-sm font-medium hover:underline"
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto flex items-center justify-center bg-gray-100 rounded-lg">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <p className="text-gray-700 font-medium">
                      Upload category photo
                    </p>
                    <p className="text-xs text-gray-500">
                      Drag and drop your photo here, or click to browse
                    </p>
                    <p className="text-xs text-gray-400">
                      Supports: JPG, PNG, GIF (Max: 5MB)
                    </p>
                  </div>
                </div>
              )}
              <input
                id="imageUpload"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Solar Store visibility
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Hidden categories and their products/bundles are not shown on Solar Store.
              Buy Solar Bundles is unchanged.
            </p>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#273E8E] focus:border-[#273E8E] outline-none appearance-none bg-white text-gray-500"
              >
                <option value="">Select visibility</option>
                <option value="Active">Active — show on Solar Store</option>
                <option value="Hidden">Hidden — hide from Solar Store</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg
                  className="w-4 h-4 text-gray-400"
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
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4">
          <button
            onClick={handleSave}
            disabled={!categoryName.trim() || !status || isSaving}
            className="w-full bg-[#273E8E] text-white py-3 rounded-full font-medium hover:bg-[#1f2f7a] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddNewCategory;
