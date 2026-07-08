import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { API_ENDPOINTS } from "../../../apiConfig";
import { apiCall } from "../../utils/customApiCall";
import LoadingSpinner from "../../components/common/LoadingSpinner";

interface FaqRow {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

const sortFaqs = (rows: FaqRow[]) =>
  [...rows].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));

const fetchFaqs = async (token: string): Promise<FaqRow[]> => {
  const res = await apiCall(API_ENDPOINTS.ADMIN.SiteFaqsList, "GET", undefined, token);
  return sortFaqs((res?.data ?? []) as FaqRow[]);
};

const FaqsSettings = () => {
  const token = Cookies.get("token") || "";
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    question: "",
    answer: "",
    is_active: true,
  });

  const { data: faqs = [], isLoading, isError } = useQuery({
    queryKey: ["admin-site-faqs"],
    queryFn: () => fetchFaqs(token),
    enabled: !!token,
  });

  const sortedFaqs = useMemo(() => sortFaqs(faqs), [faqs]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-site-faqs"] });
  };

  const reorderMutation = useMutation({
    mutationFn: (orders: { id: number; sort_order: number }[]) =>
      apiCall(API_ENDPOINTS.ADMIN.SiteFaqReorder, "POST", { orders }, token),
    onSuccess: invalidate,
    onError: () => alert("Failed to update FAQ order."),
  });

  const applyOrder = (ordered: FaqRow[]) => {
    const payload = ordered.map((faq, idx) => ({
      id: faq.id,
      sort_order: idx + 1,
    }));
    queryClient.setQueryData<FaqRow[]>(["admin-site-faqs"], ordered);
    reorderMutation.mutate(payload);
  };

  const moveFaq = (index: number, direction: "up" | "down") => {
    const next = [...sortedFaqs];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    applyOrder(next);
  };

  const handleDragStart = (id: number) => {
    setDraggedId(id);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return;
    const next = [...sortedFaqs];
    const fromIndex = next.findIndex((f) => f.id === draggedId);
    const toIndex = next.findIndex((f) => f.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    applyOrder(next);
    setDraggedId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        is_active: form.is_active,
      };
      if (editingId) {
        return apiCall(API_ENDPOINTS.ADMIN.SiteFaqUpdate(editingId), "PUT", payload, token);
      }
      return apiCall(API_ENDPOINTS.ADMIN.SiteFaqCreate, "POST", payload, token);
    },
    onSuccess: () => {
      invalidate();
      resetForm();
    },
    onError: () => alert("Failed to save FAQ."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiCall(API_ENDPOINTS.ADMIN.SiteFaqDelete(id), "DELETE", undefined, token),
    onSuccess: invalidate,
    onError: () => alert("Failed to delete FAQ."),
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ question: "", answer: "", is_active: true });
  };

  const startEdit = (faq: FaqRow) => {
    setEditingId(faq.id);
    setForm({
      question: faq.question,
      answer: faq.answer,
      is_active: !!faq.is_active,
    });
  };

  if (isLoading) return <LoadingSpinner message="Loading FAQs..." />;
  if (isError) {
    return <p className="text-red-600">Failed to load FAQs.</p>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">FAQs</h2>
        <p className="text-sm text-gray-500 mt-1">
          These appear under <strong>More → FAQs</strong> in the customer dashboard.
          Drag a row or use the arrows to change order.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">
          {editingId ? "Edit FAQ" : "Add FAQ"}
        </h3>
        <input
          type="text"
          placeholder="Question"
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
        />
        <textarea
          placeholder="Answer"
          rows={4}
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Visible to customers
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!form.question.trim() || !form.answer.trim()) {
                alert("Question and answer are required.");
                return;
              }
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending}
            className="px-6 py-2.5 rounded-full bg-[#273E8E] text-white text-sm font-medium disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving..." : editingId ? "Update FAQ" : "Add FAQ"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {sortedFaqs.length === 0 ? (
          <p className="text-gray-500 text-sm">No FAQs yet.</p>
        ) : (
          sortedFaqs.map((faq, index) => (
            <div
              key={faq.id}
              draggable
              onDragStart={() => handleDragStart(faq.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(faq.id)}
              onDragEnd={() => setDraggedId(null)}
              className={`bg-white rounded-xl border p-5 flex gap-3 ${
                draggedId === faq.id ? "border-[#273E8E] opacity-60" : "border-gray-200"
              }`}
            >
              <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                <button
                  type="button"
                  title="Drag to reorder"
                  className="p-1 text-gray-400 cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical size={18} />
                </button>
                <button
                  type="button"
                  title="Move up"
                  disabled={index === 0 || reorderMutation.isPending}
                  onClick={() => moveFaq(index, "up")}
                  className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={index === sortedFaqs.length - 1 || reorderMutation.isPending}
                  onClick={() => moveFaq(index, "down")}
                  className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronDown size={18} />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{faq.question}</p>
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{faq.answer}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Position {index + 1} · {faq.is_active ? "Active" : "Hidden"}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0 self-start">
                <button
                  type="button"
                  onClick={() => startEdit(faq)}
                  className="px-4 py-2 text-sm rounded-full border border-[#273E8E] text-[#273E8E]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Delete this FAQ?")) {
                      deleteMutation.mutate(faq.id);
                    }
                  }}
                  className="px-4 py-2 text-sm rounded-full bg-red-600 text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FaqsSettings;
