import { useState } from 'react';
import images from "../../constants/images";

//Code Relatead to the Integration
import { updateUser } from '../../utils/mutations/user';
import { useMutation } from '@tanstack/react-query';
import Cookies from 'js-cookie';


interface EditProfileProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
  adminData: {
    firstName: string;
    surname: string;
    email: string;
    bvn: string;
    password: string;
    image: string;
  };
}

const EditProfile = ({ isOpen, onClose, onProfileUpdated, adminData }: EditProfileProps) => {
  const [formData, setFormData] = useState({
    firstName: adminData.firstName,
    surname: adminData.surname,
    email: adminData.email,
    bvn: adminData.bvn,
    password: adminData.password,
    role: 'Admin'
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const token = Cookies.get("token");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await updateUser(formData, token || "");
    },
    onSuccess: () => {
      onProfileUpdated?.();
      onClose();
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
      alert("Failed to update profile. Please try again.");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create FormData for file upload
    const formDataPayload = new FormData();
    
    // Add form fields
    if (formData.firstName) formDataPayload.append('first_name', formData.firstName);
    if (formData.surname) formDataPayload.append('sur_name', formData.surname);
    if (formData.email) formDataPayload.append('email', formData.email);
    if (formData.bvn) formDataPayload.append('bvn', formData.bvn);
    if (formData.password) formDataPayload.append('password', formData.password);
    if (formData.role) formDataPayload.append('role', formData.role);
    
    // Add image file if selected
    if (selectedImage) {
      console.log('Adding image to FormData:', selectedImage.name, selectedImage.type, selectedImage.size);
      formDataPayload.append('profile_picture', selectedImage);
    }

    // Debug: Log FormData contents
    console.log('FormData contents:');
    for (const [key, value] of formDataPayload.entries()) {
      console.log(key, value);
    }

    updateUserMutation.mutate(formDataPayload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-brightness-50 bg-opacity-50 flex items-start justify-end z-50">
      <div 
        className="bg-white rounded-lg relative overflow-hidden"
        style={{ 
          width: '600px', 
          height: '700px',
          maxHeight: '110vh'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center cursor-pointer justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <img src={images.cross} className="w-7 h-7" alt="" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ height: 'calc(100% - 120px)' }}>
          {/* Profile Image */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  <img 
                    src={imagePreview} 
                    alt="Profile preview" 
                    className="w-full h-full object-cover"
                  />
                ) : adminData.image ? (
                  <img 
                    src={adminData.image} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${imagePreview || adminData.image ? 'hidden' : ''}`}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 16C19.3137 16 22 13.3137 22 10C22 6.68629 19.3137 4 16 4C12.6863 4 10 6.68629 10 10C10 13.3137 12.6863 16 16 16Z" fill="#9CA3AF"/>
                    <path d="M16 18C21.5228 18 26 22.4772 26 28H6C6 22.4772 10.4772 18 16 18Z" fill="#9CA3AF"/>
                  </svg>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="Enter your first name"
                className="w-full px-4 py-3 border border-[#CDCDCD] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Surname */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Surname
              </label>
              <input
                type="text"
                name="surname"
                value={formData.surname}
                onChange={handleInputChange}
                placeholder="Enter your surname"
                className="w-full px-4 py-3 border border-[#CDCDCD] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email address"
                className="w-full px-4 py-3 border border-[#CDCDCD] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* BVN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BVN
              </label>
              <input
                type="text"
                name="bvn"
                value={formData.bvn}
                onChange={handleInputChange}
                placeholder="BVN Number"
                className="w-full px-4 py-3 border border-[#CDCDCD] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter Password"
                className="w-full px-4 py-3 border border-[#CDCDCD] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 cursor-pointer">
                Role
              </label>
              <div className="relative">
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 cursor-pointer border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
                >
                  <option value="Admin">Admin</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Manager">Manager</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2 4l4 4 4-4"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-8">
              <button
                type="submit"
                disabled={updateUserMutation.isPending}
                className={`w-full bg-[#273E8E] cursor-pointer text-white py-3 rounded-full font-medium hover:bg-[#1f2f7a] transition-colors flex items-center justify-center ${
                  updateUserMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {updateUserMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Updating...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
