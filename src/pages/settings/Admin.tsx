import { useState } from "react";
import EditProfile from "./EditProfile.tsx";
import AdminDetail from "./AdminDetail.tsx";
import AddNewAdminModal from "./AddNewAdminModel.tsx";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { getAdmins, getCurrentAdmin } from "../../utils/queries/users.ts";
import LoadingSpinner from "../../components/common/LoadingSpinner.tsx";
import {
  formatUserActivityDate,
  userProfileImageUrl,
} from "../../utils/userMedia.ts";
import type { Admin as AdminRecord } from "./admin.ts";

const Admin = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"activity" | "allAdmins">(
    "activity"
  );
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    bvn: "",
    password: "",
  });

  const handleEditProfile = () => {
    setIsEditProfileOpen(true);
  };

  const handleCloseEditProfile = () => {
    setIsEditProfileOpen(false);
  };

  const handleViewDetails = (adminId: string) => {
    setSelectedAdminId(adminId);
  };

  const handleGoBack = () => {
    setSelectedAdminId(null);
  };

  const handleAddNewAdmin = () => {
    setShowAddAdminModal(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAdminAdded = () => {
    refetchAdmins();
  };

  const handleProfileUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["current-admin"] });
  };

  const token = Cookies.get("token");
  const { data: currentUserData, isLoading: isCurrentUserLoading } = useQuery({
    queryKey: ["current-admin"],
    queryFn: () => getCurrentAdmin(token || ""),
    enabled: !!token,
  });

  const { data: adminsData, isLoading: adminsLoading, isError: adminsError, refetch: refetchAdmins } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAdmins(token || ""),
    enabled: !!token && activeTab === "allAdmins",
  });

  const apiAdmins: AdminRecord[] = Array.isArray(adminsData?.data)
    ? adminsData.data.map((u: {
        id: number;
        first_name: string;
        sur_name: string;
        email: string;
        phone?: string;
        bvn?: string;
        profile_picture?: string;
        role: string;
        user_code?: string;
        refferal_code?: string;
        is_active: number;
        is_verified: number;
        created_at: string;
      }) => ({
        id: String(u.id),
        firstName: u.first_name,
        surname: u.sur_name,
        email: u.email,
        phone: u.phone || "",
        bvn: u.bvn || "",
        password: "**********",
        image: userProfileImageUrl(u.profile_picture),
        role: u.role,
        userCode: u.user_code || "",
        referralCode: u.refferal_code || "",
        isActive: u.is_active === 1,
        isVerified: u.is_verified === 1,
        dateJoined: u.created_at
          ? formatUserActivityDate(u.created_at)
          : "",
        activity: [],
      }))
    : [];

  const adminsToShow = apiAdmins.filter((admin) => {
    if (!searchTerm.trim()) {
      return true;
    }
    const term = searchTerm.toLowerCase();
    return (
      admin.firstName.toLowerCase().includes(term) ||
      admin.surname.toLowerCase().includes(term) ||
      admin.email.toLowerCase().includes(term)
    );
  });

  if (selectedAdminId) {
    return (
      <AdminDetail
        adminId={selectedAdminId}
        onGoBack={handleGoBack}
      />
    );
  }

  if (isCurrentUserLoading) {
    return (
      <div className="w-full bg-[#F5F7FF]">
        <LoadingSpinner message="Loading admin profile..." size="lg" />
      </div>
    );
  }

  const currentUser = currentUserData?.data;
  const profileImage = userProfileImageUrl(currentUser?.profile_picture);
  const activities = Array.isArray(currentUser?.activitys)
    ? currentUser.activitys.map((item: { id: number; activity: string; created_at: string }) => ({
        id: String(item.id),
        description: item.activity,
        date: formatUserActivityDate(item.created_at),
      }))
    : [];

  return (
    <div className="w-full bg-[#F5F7FF]">
      <div
        className="bg-gradient-to-r from-[#4e4376] to-[#f9d423] rounded-lg mb-6 relative"
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
                src={profileImage}
                alt="Admin Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/assets/images/profile.png";
                }}
              />
            </div>
            <h2 className="text-[#FFFFFF] text-2xl font-medium mb-2 text-center">
              {currentUser
                ? `${currentUser.sur_name ?? ""} ${currentUser.first_name ?? ""}`.trim()
                : "Admin"}
            </h2>
            <p className="text-[#FFFFFF] text-xs opacity-90 mb-20 text-center">
              {currentUser?.email ?? ""}
            </p>

            <button
              onClick={handleEditProfile}
              className="bg-white text-gray-900 px-8 py-3 rounded-full font-semibold transition-colors w-full max-w-2xl cursor-pointer"
            >
              Edit Profile
            </button>
          </div>

          <div className="flex-1 ml-12 flex justify-between">
            <div className="text-white space-y-8 flex-1">
              <div>
                <p className="text-sm opacity-75 mb-1">First Name</p>
                <p className="text-lg font-medium">{currentUser?.first_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm opacity-75 mb-1">Surname</p>
                <p className="text-lg font-medium">{currentUser?.sur_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm opacity-75 mb-1">Email Address</p>
                <p className="text-lg font-medium">{currentUser?.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm opacity-75 mb-1">Phone</p>
                <p className="text-lg font-medium">{currentUser?.phone || "N/A"}</p>
              </div>
            </div>

            <div className="text-white text-right flex flex-col justify-between">
              <div>
                <p className="text-sm opacity-75 mb-1">BVN</p>
                <p className="text-lg font-medium">{currentUser?.bvn || "N/A"}</p>
              </div>

              <button
                onClick={handleAddNewAdmin}
                className="bg-white text-[#000000] px-6 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Add new Admin
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
            <button
              onClick={() => setActiveTab("activity")}
              className={`px-5 py-2 text-sm rounded-full font-medium transition-colors flex-1 cursor-pointer ${activeTab === "activity"
                ? "bg-[#273E8E] text-white shadow-sm"
                : "text-gray-600 hover:text-gray-800"
                }`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveTab("allAdmins")}
              className={`px-5 py-2 text-sm rounded-full font-medium transition-colors flex-1 cursor-pointer ${activeTab === "allAdmins"
                ? "bg-[#273E8E] text-white shadow-sm"
                : "text-gray-600 hover:text-gray-800"
                }`}
            >
              All Admins
            </button>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button className="bg-white text-gray-600 px-6 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center space-x-2 shadow-sm cursor-pointer">
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

            {activeTab === "allAdmins" && (
              <div className="relative w-80">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-6 py-3.5 border border-[#00000080] rounded-lg text-[15px] w-[320px] focus:outline-none bg-white shadow-[0_2px_6px_rgba(0,0,0,0.05)] placeholder-gray-400"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-gray-400"
                  >
                    <path
                      d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9"
                      stroke="currentColor"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

        {activeTab === "activity" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#EBEBEB] px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="font-medium text-gray-700 text-sm">
                    Activity
                  </div>
                </div>
                <div className="font-medium text-gray-700 text-sm text-center">
                  Date
                </div>
              </div>
            </div>
            {activities.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">
                No activity recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activities.map((activity: { id: string; description: string; date: string }, index: number) => (
                  <div
                    key={activity.id}
                    className={`px-6 py-4 ${index % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"
                      } transition-colors border-b border-gray-100 last:border-b-0 hover:bg-gray-50`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-gray-800 text-sm">
                          {activity.description}
                        </span>
                      </div>
                      <div className="text-gray-600 text-sm text-center">
                        {activity.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "allAdmins" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {adminsLoading ? (
              <div className="py-8 text-center text-gray-500">Loading admins...</div>
            ) : adminsError ? (
              <div className="py-8 text-center text-red-500">Failed to load admins.</div>
            ) : adminsToShow.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No admin accounts yet. Use <strong>Add New Admin</strong> to invite staff.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#EBEBEB]">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-4 text-center text-sm font-medium text-black"
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span>Name</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-center text-sm font-medium text-black"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-center text-sm font-medium text-black"
                    >
                      Role
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-center text-sm font-medium text-black"
                    >
                      BVN
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-center text-sm font-medium text-black"
                    >
                      Date Joined
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-center text-sm font-medium text-black"
                    >
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {adminsToShow.map((admin: { id: string; firstName: string; surname: string; email: string; role: string; dateJoined: string; bvn: string }, index: number) => (
                    <tr
                      key={admin.id}
                      className={`${index % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"
                        } transition-colors border-b border-gray-100 last:border-b-0`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span>
                            {admin.firstName} {admin.surname}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black text-center">
                        {admin.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black text-center">
                        {admin.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black text-center">
                        {admin.bvn}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black text-center">
                        {admin.dateJoined}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewDetails(admin.id)}
                          className="bg-[#273E8E] text-white px-5 py-3 rounded-full text-sm hover:bg-[#1f2f7a] transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <EditProfile
        isOpen={isEditProfileOpen}
        onClose={handleCloseEditProfile}
        onProfileUpdated={handleProfileUpdated}
        adminData={{
          firstName: currentUser?.first_name ?? "",
          surname: currentUser?.sur_name ?? "",
          email: currentUser?.email ?? "",
          bvn: currentUser?.bvn ?? "",
          password: "**********",
          image: profileImage,
        }}
      />

      <AddNewAdminModal
        showAddModal={showAddAdminModal}
        setShowAddModal={setShowAddAdminModal}
        onUserAdded={handleAdminAdded}
        newUser={newUser}
        handleInputChange={handleInputChange}
      />
    </div>
  );
};

export default Admin;
