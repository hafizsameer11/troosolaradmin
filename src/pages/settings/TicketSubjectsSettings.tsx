import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { API_ENDPOINTS } from "../../../apiConfig";
import { apiCall } from "../../utils/customApiCall";
import LoadingSpinner from "../../components/common/LoadingSpinner";

interface SubjectRow {
  id: number;
  title: string;
  sort_order: number;
  is_active: boolean;
}

const fetchSubjects = async (token: string): Promise<SubjectRow[]> => {
  const res = await apiCall(
    API_ENDPOINTS.ADMIN.TicketSubjectsList,
    "GET",
    undefined,
    token
  );
  return (res?.data ?? []) as SubjectRow[];
};

const TicketSubjectsSettings = () => {
  const token = Cookies.get("token") || "";
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    sort_order: 0,
    is_active: true,
  });

  const { data: subjects = [], isLoading, isError } = useQuery({
    queryKey: ["admin-ticket-subjects"],
    queryFn: () => fetchSubjects(token),
    enabled: !!token,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-ticket-subjects"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (editingId) {
        return apiCall(
          API_ENDPOINTS.ADMIN.TicketSubjectUpdate(editingId),
          "PUT",
          payload,
          token
        );
      }
      return apiCall(API_ENDPOINTS.ADMIN.TicketSubjectCreate, "POST", payload, token);
    },
    onSuccess: () => {
      invalidate();
      resetForm();
    },
    onError: () => alert("Failed to save ticket subject."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiCall(API_ENDPOINTS.ADMIN.TicketSubjectDelete(id), "DELETE", undefined, token),
    onSuccess: invalidate,
    onError: () => alert("Failed to delete ticket subject."),
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: "", sort_order: 0, is_active: true });
  };

  const startEdit = (row: SubjectRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      sort_order: row.sort_order ?? 0,
      is_active: !!row.is_active,
    });
  };

  if (isLoading) return <LoadingSpinner message="Loading ticket subjects..." />;
  if (isError) {
    return <p className="text-red-600">Failed to load ticket subjects.</p>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Support ticket subjects</h2>
        <p className="text-sm text-gray-500 mt-1">
          Customers choose one of these when creating a ticket under{" "}
          <strong>More → Support</strong>.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">
          {editingId ? "Edit subject" : "Add subject"}
        </h3>
        <input
          type="text"
          placeholder="Subject title (e.g. Order & delivery)"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
        />
        <div className="flex flex-wrap gap-4 items-center">
          <label className="text-sm text-gray-700">
            Sort order{" "}
            <input
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) =>
                setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
              }
              className="ml-2 w-20 border border-gray-300 rounded-lg px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Available in dropdown
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!form.title.trim()) {
                alert("Subject title is required.");
                return;
              }
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending}
            className="px-6 py-2.5 rounded-full bg-[#273E8E] text-white text-sm font-medium disabled:opacity-50"
          >
            {saveMutation.isPending
              ? "Saving..."
              : editingId
                ? "Update subject"
                : "Add subject"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#EBEBEB]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Subject</th>
              <th className="px-4 py-3 text-center font-medium w-24">Order</th>
              <th className="px-4 py-3 text-center font-medium w-24">Status</th>
              <th className="px-4 py-3 text-right font-medium w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No subjects yet.
                </td>
              </tr>
            ) : (
              subjects.map((row, idx) => (
                <tr
                  key={row.id}
                  className={idx % 2 === 0 ? "bg-[#F8F8F8]" : "bg-white"}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{row.sort_order}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        row.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {row.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="text-[#273E8E] font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Delete this subject?")) {
                          deleteMutation.mutate(row.id);
                        }
                      }}
                      className="text-red-600 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TicketSubjectsSettings;
