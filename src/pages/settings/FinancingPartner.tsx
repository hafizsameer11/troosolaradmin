import { useState, useEffect } from "react";
import AddPartner from "./AddPartner";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import LoadingSpinner from "../../components/common/LoadingSpinner";

//Code Related to Integration
import { deletePartnerFinancing, updatePartnerFinancing } from "../../utils/mutations/finance";
import { getAllFinance } from "../../utils/queries/finance";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import Cookies from "js-cookie";

interface Partner {
  id: string;
  name: string;
  partnerEmail?: string;
  numberOfLoans: number;
  amount: string;
  dateCreated: string;
  status: "Active" | "Inactive";
  isTroosolar?: boolean;
}

const FinancingPartner = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isAddPartnerModalOpen, setIsAddPartnerModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partner | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const [apiMessage, setApiMessage] = useState<string>("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch partners from API
  const token = Cookies.get("token");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["all-finance-partners"],
    queryFn: () => getAllFinance(token || ""),
    enabled: !!token,
  });

  // Set partners when API data changes
  // This replaces the onSuccess option
  useEffect(() => {
    if (data?.status === "success" && Array.isArray(data.data)) {
      setPartners(
        data.data.map((p: any) => ({
          id: String(p.id), // Use API id
          name: p["Partner name"] || "",
          partnerEmail: p["Email"] || "",
          numberOfLoans: p["No of Loans"] ?? 0,
          amount: `N${p["Amount"] ?? 0}`,
          dateCreated: p["Date Created"]
            ? new Date(p["Date Created"]).toLocaleString()
            : "",
          status:
            p["Status"] === "active" || p["Status"] === "Active"
              ? "Active"
              : "Inactive",
          isTroosolar: !!(p.is_troosolar || String(p.slug || "").toLowerCase() === "troosolar"),
        }))
      );
      setApiMessage(data.message || "");
    } else if (data?.message) {
      setApiMessage(data.message);
    }
  }, [data]);

  const handleAddNewPartner = () => {
    setEditMode(false);
    setEditData(null);
    setIsAddPartnerModalOpen(true);
  };

  const handleEditCategory = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (partner) {
      setEditMode(true);
      setEditData(partner);
      setIsAddPartnerModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsAddPartnerModalOpen(false);
    setEditMode(false);
    setEditData(null);
  };

  const handleSavePartner = (_partnerData: any) => {
    refetch();
  };

  // Delete partner mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePartnerFinancing(id, token || ""),
    onSuccess: () => {
      refetch();
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (partner: Partner) =>
      updatePartnerFinancing(
        partner.id,
        {
          name: partner.name,
          email: partner.partnerEmail || "",
          status: partner.status === "Active" ? "Inactive" : "Active",
        },
        token || ""
      ),
    onSuccess: () => {
      refetch();
    },
  });

  const handleToggleStatus = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (partner) {
      toggleStatusMutation.mutate(partner);
    }
  };

  const handleDelete = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (partner?.isTroosolar) {
      setApiMessage("Troosolar cannot be deleted. Set status to Inactive to hide it from the customer BNPL list.");
      return;
    }
    if (partner) {
      setPartnerToDelete(partner);
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = () => {
    if (partnerToDelete) {
      deleteMutation.mutate(partnerToDelete.id);
      setShowDeleteModal(false);
      setPartnerToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPartnerToDelete(null);
  };

  // Pagination logic
  const totalPages = Math.ceil(partners.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPartners = partners.slice(startIndex, endIndex);

  return (
    <div className="w-full">
      {/* Add New Partner Button */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <p className="text-sm text-gray-600 max-w-2xl">
          Active financing options (including <span className="font-medium">Troosolar</span>) appear on the customer BNPL Final Application list.
          Set status to Inactive to hide an option without deleting it.
        </p>
        <button
          onClick={handleAddNewPartner}
          className="bg-[#273E8E] text-white px-6 py-3 rounded-full font-medium hover:bg-[#273E8E] transition-colors cursor-pointer whitespace-nowrap"
        >
          Add New Partner
        </button>
      </div>

      {/* Backend message display */}
      {apiMessage && (
        <div className="mb-4 px-4 py-3 rounded bg-blue-50 text-blue-700 border border-blue-100">
          {apiMessage}
        </div>
      )}

      {/* Partners Table */}
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Loading partners..." />
        ) : isError ? (
          <div className="py-16 text-center text-red-500 text-lg">
            Failed to load partners.
          </div>
        ) : (
          <table className="min-w-full">
            {/* Table Header */}
            <thead className="bg-[#EBEBEB]">
              <tr>
                <th className="px-6 py-4 ">
                  <div className="flex justify-center items-center space-x-1">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="font-medium text-black text-sm">
                      Partner Name
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center">
                  <span className="font-medium text-black text-sm">
                    No of loans
                  </span>
                </th>
                <th className="px-6 py-4 text-center">
                  <span className="font-medium text-black text-sm">Amount</span>
                </th>
                <th className="px-6 py-4 text-center">
                  <span className="font-medium text-black text-sm">
                    Date Created
                  </span>
                </th>
                <th className="px-6 py-4 text-center">
                  <span className="font-medium text-black text-sm">Status</span>
                </th>
                <th className="px-6 py-4 text-center">
                  <span className="font-medium text-black text-sm">Action</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100">
              {currentPartners.map((partner, index) => (
                <tr
                  key={partner.id}
                  className={`${index % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"
                    } transition-colors border-b border-gray-100 last:border-b-0 px-6 py-4 `}
                >
                  <td className="px-8 py-4 text-center">
                    <div className="flex justify-center items-center space-x-1">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-[#273E8E] border-gray-300 rounded focus:ring-[#273E8E]"
                      />
                      <span className="text-gray-800 text-sm font-medium">
                        {partner.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-gray-600 text-sm">
                      {partner.numberOfLoans}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-gray-600 text-sm">
                      {partner.amount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-gray-600 text-sm">
                      {partner.dateCreated}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${partner.status === "Active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                          }`}
                      >
                        {partner.status}
                      </span>
                      {partner.isTroosolar ? (
                        <span className="text-[10px] uppercase tracking-wide text-[#273E8E]">Internal</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center flex-wrap gap-2">
                      <button
                        onClick={() => handleToggleStatus(partner.id)}
                        disabled={toggleStatusMutation.isPending}
                        className={`px-5 py-3 rounded-full text-sm font-xs transition-colors cursor-pointer ${
                          partner.status === "Active"
                            ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                            : "bg-green-100 text-green-900 hover:bg-green-200"
                        }`}
                      >
                        {partner.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleEditCategory(partner.id)}
                        className="bg-[#273E8E] text-white px-5 py-3 rounded-full text-sm font-xs hover:bg-[#1f2f7a] transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      {!partner.isTroosolar ? (
                        <button
                          onClick={() => handleDelete(partner.id)}
                          className="bg-[#FF0000] text-white px-8 py-3 rounded-full text-sm font-xs hover:bg-[#FF0000] transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing {startIndex + 1} to {Math.min(endIndex, partners.length)} of {partners.length} results
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Previous Button */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-2 text-sm font-medium rounded-md border ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer'
                }`}
              >
                Previous
              </button>
              
              {/* Page Numbers */}
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
                          ? 'bg-[#273E8E] text-white border-[#273E8E]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
              
              {/* Next Button */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 text-sm font-medium rounded-md border ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Partner Modal */}
      <AddPartner
        isOpen={isAddPartnerModalOpen}
        onClose={handleCloseModal}
        onSave={handleSavePartner}
        editMode={editMode}
        editData={editData}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        message="Are you sure you want to delete this partner?"
      />
    </div>
  );
};

export default FinancingPartner;
