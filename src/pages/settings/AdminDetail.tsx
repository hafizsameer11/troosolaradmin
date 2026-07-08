import { useState } from "react";
import EditProfile from "./EditProfile.tsx";
import { useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { getSingleUser } from "../../utils/queries/users.ts";
import LoadingSpinner from "../../components/common/LoadingSpinner.tsx";
import {
  formatUserActivityDate,
  userProfileImageUrl,
} from "../../utils/userMedia.ts";

interface AdminDetailProps {
  adminId: string;
  onGoBack: () => void;
}

const AdminDetail = ({ adminId, onGoBack }: AdminDetailProps) => {
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const token = Cookies.get("token");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-detail", adminId],
    queryFn: () => getSingleUser(adminId, token || ""),
    enabled: !!token && !!adminId,
  });

  const apiUser = data?.data;

  if (isLoading) {
    return (
      <div className="w-full bg-[#F5F7FF]">
        <LoadingSpinner message="Loading admin details..." size="lg" />
      </div>
    );
  }

  if (isError || !apiUser) {
    return (
      <div className="w-full p-8">
        <div className="text-center">
          <p className="text-gray-500">Admin not found</p>
          <button
            onClick={onGoBack}
            className="mt-4 bg-[#273E8E] text-white px-6 py-2 rounded-lg hover:bg-[#1f2f7a] transition-colors cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const admin = {
    id: String(apiUser.id),
    firstName: apiUser.first_name ?? "",
    surname: apiUser.sur_name ?? "",
    email: apiUser.email ?? "",
    phone: apiUser.phone ?? "",
    bvn: apiUser.bvn ?? "",
    password: "**********",
    image: userProfileImageUrl(apiUser.profile_picture),
    role: apiUser.role ?? "",
    userCode: apiUser.user_code ?? "",
    referralCode: apiUser.refferal_code ?? "",
    isActive: apiUser.is_active === 1,
    isVerified: apiUser.is_verified === 1,
    activity: Array.isArray(apiUser.activitys)
      ? apiUser.activitys.map((item: { id: number; activity: string; created_at: string }) => ({
          id: String(item.id),
          description: item.activity,
          date: formatUserActivityDate(item.created_at),
        }))
      : [],
  };

  const handleEditProfile = () => {
    setIsEditProfileOpen(true);
  };

  const handleCloseEditProfile = () => {
    setIsEditProfileOpen(false);
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Admin {admin.surname}
        </h1>
        <button
          onClick={onGoBack}
          className="text-[#273E8E] text-sm hover:underline flex items-center space-x-1"
        >
          <span>Go back</span>
        </button>
      </div>

      <div
        className="bg-gradient-to-r from-[#4e4376]  to-[#f9d423] rounded-lg mb-6 relative"
        style={{
          width: "100%",
          maxWidth: "1209px",
          height: "491px",
          margin: "0 auto",
        }}
      >
        <div className="absolute inset-0 p-12 flex">
          <div
            className="bg-gradient-to-br from-[#5D72C2] to-[#FFA50080] bg-opacity-20 border border-[#FFA126] border-opacity-30 rounded-lg p-8 flex flex-col items-center justify-center"
            style={{ width: "310px", height: "100%" }}
          >
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white mb-6">
              <img
                src={admin.image}
                alt="Admin Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/assets/images/profile.png";
                }}
              />
            </div>
            <h2 className="text-[#FFFFFF] text-2xl font-medium mb-2 text-center">
              {admin.surname} {admin.firstName}
            </h2>
            <p className="text-[#FFFFFF] text-xs opacity-90 mb-20 text-center">
              {admin.email}
            </p>

            <button
              onClick={handleEditProfile}
              className="bg-white text-gray-800 px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors w-full max-w-2xl cursor-pointer"
            >
              Edit Profile
            </button>
          </div>

          <div className="flex-1 ml-12 flex justify-between">
            <div className="text-white space-y-8 flex-1">
              <div>
                <p className="text-sm opacity-75 mb-1">First Name</p>
                <p className="text-lg font-medium">{admin.firstName}</p>
              </div>
              <div>
                <p className="text-sm opacity-75 mb-1">Surname</p>
                <p className="text-lg font-medium">{admin.surname}</p>
              </div>
              <div>
                <p className="text-sm opacity-75 mb-1">Email Address</p>
                <p className="text-lg font-medium">{admin.email}</p>
              </div>
              <div>
                <p className="text-sm opacity-75 mb-1">Phone Number</p>
                <p className="text-lg font-medium">{admin.phone || "N/A"}</p>
              </div>
            </div>

            <div className="text-white text-right flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <p className="text-sm opacity-75 mb-1">User Code</p>
                  <p className="text-lg font-medium">{admin.userCode || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm opacity-75 mb-1">Referral Code</p>
                  <p className="text-lg font-medium">{admin.referralCode || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm opacity-75 mb-1">Status</p>
                  <p className="text-lg font-medium">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      admin.isActive ? "bg-green-500" : "bg-red-500"
                    }`}>
                      {admin.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
              </div>

              <button className="bg-[#FFFFFF] text-black px-6 py-3 rounded-full font-semibold hover:bg-[#FFFFFF] transition-colors cursor-pointer">
                Delete Admin
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 px-2">
        <div className="mb-8">
          <div
            className="bg-white rounded-full p-2 shadow-sm border border-[#CDCDCD] flex"
            style={{ width: "235px", height: "60px" }}
          >
            <button className="px-5 py-2 text-md rounded-full font-medium transition-colors flex-1 bg-[#273E8E] text-white shadow-sm cursor-pointer">
              Activity
            </button>
            <button className="px-5 py-2 text-sm rounded-full font-medium transition-colors flex-1 text-gray-600 hover:text-gray-800 cursor-pointer">
              All Admins
            </button>
          </div>

          <div className="mt-4">
            <button className="bg-white text-gray-600 px-6 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center space-x-2 shadow-sm">
              <span>More Actions</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#EBEBEB]">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-sm font-medium text-black"
                >
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span>Activity</span>
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-right text-sm font-medium text-black"
                >
                  Date
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {admin.activity.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-gray-500 text-sm">
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                admin.activity.map((activity: { id: string; description: string; date: string }, index: number) => (
                  <tr
                    key={activity.id}
                    className={`${
                      index % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"
                    } transition-colors border-b border-gray-100 last:border-b-0`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-800">
                      <div className="flex items-center space-x-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span>{activity.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">
                      {activity.date}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditProfile
        isOpen={isEditProfileOpen}
        onClose={handleCloseEditProfile}
        adminData={admin}
      />
    </div>
  );
};

export default AdminDetail;
