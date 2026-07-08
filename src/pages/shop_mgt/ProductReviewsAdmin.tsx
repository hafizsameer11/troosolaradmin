import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { API_ENDPOINTS } from "../../../apiConfig";
import { apiCall } from "../../utils/customApiCall";
import LoadingSpinner from "../../components/common/LoadingSpinner";

interface ApiReviewUser {
  id?: number;
  first_name?: string;
  sur_name?: string;
  name?: string;
}

interface ApiReviewProduct {
  id: number;
  title?: string;
}

interface ApiReviewBundle {
  id: number;
  title?: string;
}

export interface ApiReview {
  id: number;
  review?: string;
  comment?: string;
  rating?: number | string;
  admin_reply?: string | null;
  admin_replied_at?: string | null;
  created_at?: string;
  product_id?: number | null;
  bundle_id?: number | null;
  user?: ApiReviewUser;
  user_name?: string;
  name?: string;
  product?: ApiReviewProduct | null;
  bundle?: ApiReviewBundle | null;
}

const normalizeReviewRating = (r: ApiReview): number => {
  const n = Number(r.rating);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 5;
};

const reviewerName = (review: ApiReview): string =>
  review.user_name ||
  review.name ||
  review.user?.name ||
  [review.user?.first_name, review.user?.sur_name].filter(Boolean).join(" ") ||
  "Anonymous";

const itemLabel = (review: ApiReview): string => {
  if (review.bundle_id && review.bundle?.title) {
    return `Bundle: ${review.bundle.title}`;
  }
  if (review.product_id && review.product?.title) {
    return `Product: ${review.product.title}`;
  }
  if (review.bundle_id) return `Bundle #${review.bundle_id}`;
  if (review.product_id) return `Product #${review.product_id}`;
  return "Unknown item";
};

const fetchAllReviews = async (token: string): Promise<ApiReview[]> => {
  const res = await apiCall(
    API_ENDPOINTS.ADMIN.ProductReviewsAdminList(),
    "GET",
    undefined,
    token
  );
  return (res?.data ?? []) as ApiReview[];
};

const ProductReviewsAdmin = () => {
  const token = Cookies.get("token") || "";
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "product" | "bundle">("all");
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editReviewText, setEditReviewText] = useState("");
  const [editReviewRating, setEditReviewRating] = useState(5);
  const [replyingToReviewId, setReplyingToReviewId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const { data: reviews = [], isLoading, isError } = useQuery({
    queryKey: ["admin-all-reviews"],
    queryFn: () => fetchAllReviews(token),
    enabled: !!token,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-all-reviews"] });
    void queryClient.invalidateQueries({ queryKey: ["singleProduct"] });
  };

  const updateReviewMutation = useMutation({
    mutationFn: async ({
      reviewId,
      review,
      rating,
    }: {
      reviewId: number;
      review: string;
      rating: number;
    }) =>
      apiCall(
        API_ENDPOINTS.ADMIN.ProductReviewAdminUpdate(reviewId),
        "PUT",
        { review, rating },
        token
      ),
    onSuccess: invalidate,
    onError: () => alert("Failed to update review."),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: number) =>
      apiCall(API_ENDPOINTS.ADMIN.ProductReviewAdminDelete(reviewId), "DELETE", undefined, token),
    onSuccess: invalidate,
    onError: () => alert("Failed to delete review."),
  });

  const saveAdminReplyMutation = useMutation({
    mutationFn: async ({ reviewId, admin_reply }: { reviewId: number; admin_reply: string }) =>
      apiCall(
        API_ENDPOINTS.ADMIN.ProductReviewAdminReply(reviewId),
        "PUT",
        { admin_reply },
        token
      ),
    onSuccess: () => {
      invalidate();
      setReplyingToReviewId(null);
      setReplyDraft("");
    },
    onError: () => alert("Failed to save reply."),
  });

  const filteredReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reviews.filter((review) => {
      if (typeFilter === "product" && !review.product_id) return false;
      if (typeFilter === "bundle" && !review.bundle_id) return false;
      if (!q) return true;
      const haystack = [
        reviewerName(review),
        itemLabel(review),
        review.review,
        review.comment,
        review.admin_reply,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [reviews, searchQuery, typeFilter]);

  const beginEditReview = (review: ApiReview) => {
    setReplyingToReviewId(null);
    setReplyDraft("");
    setEditingReviewId(review.id);
    setEditReviewText(String(review.review || review.comment || ""));
    setEditReviewRating(normalizeReviewRating(review));
  };

  const beginAdminReply = (review: ApiReview) => {
    setEditingReviewId(null);
    setReplyingToReviewId(review.id);
    setReplyDraft(
      review.admin_reply != null && review.admin_reply !== "" ? String(review.admin_reply) : ""
    );
  };

  const handleSaveReviewEdit = () => {
    if (!editingReviewId) return;
    if (editReviewRating < 1 || editReviewRating > 5) {
      alert("Rating must be between 1 and 5.");
      return;
    }
    updateReviewMutation.mutate({
      reviewId: editingReviewId,
      review: editReviewText.trim(),
      rating: editReviewRating,
    });
    setEditingReviewId(null);
    setEditReviewText("");
    setEditReviewRating(5);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading reviews..." />;
  }

  if (isError) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-red-500">
        Failed to load reviews. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer Reviews</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage product and bundle reviews — edit text, reply publicly, or remove inappropriate content.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | "product" | "bundle")}
            className="border border-[#CDCDCD] rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#273E8E]"
          >
            <option value="all">All types</option>
            <option value="product">Products only</option>
            <option value="bundle">Bundles only</option>
          </select>
          <input
            type="text"
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-4 pr-4 py-2.5 border border-[#00000080] rounded-lg text-sm w-full sm:w-[280px] focus:outline-none bg-white"
          />
        </div>
      </div>

      {filteredReviews.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-gray-500">
          {reviews.length === 0 ? "No reviews yet." : "No reviews match your filters."}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => {
            const rid = review.id;
            const reviewText =
              (review.review || review.comment || "").trim() ||
              "No written comment (rating only)";

            return (
              <div
                key={rid}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#273E8E] text-white flex items-center justify-center font-semibold shrink-0">
                      {reviewerName(review).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{reviewerName(review)}</p>
                      <p className="text-sm text-[#273E8E] font-medium">{itemLabel(review)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`w-4 h-4 ${
                              star <= normalizeReviewRating(review)
                                ? "text-[#273E8E]"
                                : "text-[#D9D9D9]"
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      {review.created_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(review.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => beginEditReview(review)}
                      className="px-4 py-2 text-sm font-medium rounded-full border border-[#273E8E] text-[#273E8E] hover:bg-[#273E8E] hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => beginAdminReply(review)}
                      className="px-4 py-2 text-sm font-medium rounded-full bg-[#273E8E] text-white hover:bg-[#1e3270] transition-colors"
                    >
                      {review.admin_reply?.trim() ? "Edit reply" : "Reply"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Delete this review?")) {
                          deleteReviewMutation.mutate(rid);
                        }
                      }}
                      disabled={deleteReviewMutation.isPending}
                      className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm text-gray-800 whitespace-pre-wrap">{reviewText}</p>

                {review.admin_reply?.trim() && replyingToReviewId !== rid && (
                  <div className="mt-4 rounded-lg bg-[#f0f4ff] border border-[#bfdbfe] p-4">
                    <p className="text-xs font-semibold text-[#273E8E] uppercase tracking-wide mb-1">
                      Troosolar reply
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{review.admin_reply}</p>
                    {review.admin_replied_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(review.admin_replied_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {editingReviewId === rid && (
                  <div className="mt-4 rounded-lg border border-gray-200 p-4 bg-gray-50 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                      <select
                        value={editReviewRating}
                        onChange={(e) => setEditReviewRating(Number(e.target.value))}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-[120px]"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} star{n !== 1 ? "s" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={editReviewText}
                      onChange={(e) => setEditReviewText(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Review text"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingReviewId(null)}
                        className="px-4 py-2 text-sm text-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveReviewEdit}
                        disabled={updateReviewMutation.isPending}
                        className="px-5 py-2 text-sm font-medium rounded-full bg-[#273E8E] text-white disabled:opacity-50"
                      >
                        {updateReviewMutation.isPending ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </div>
                )}

                {replyingToReviewId === rid && (
                  <div className="mt-4 rounded-lg border border-gray-200 p-4 bg-gray-50 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Public admin reply
                    </label>
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Write a reply visible to customers..."
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToReviewId(null);
                          setReplyDraft("");
                        }}
                        className="px-4 py-2 text-sm text-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveAdminReplyMutation.mutate({
                            reviewId: rid,
                            admin_reply: replyDraft.trim(),
                          })
                        }
                        disabled={saveAdminReplyMutation.isPending}
                        className="px-5 py-2 text-sm font-medium rounded-full bg-[#273E8E] text-white disabled:opacity-50"
                      >
                        {saveAdminReplyMutation.isPending ? "Saving..." : "Save reply"}
                      </button>
                      {review.admin_reply?.trim() && (
                        <button
                          type="button"
                          onClick={() =>
                            saveAdminReplyMutation.mutate({ reviewId: rid, admin_reply: "" })
                          }
                          disabled={saveAdminReplyMutation.isPending}
                          className="px-4 py-2 text-sm text-red-600"
                        >
                          Remove reply
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductReviewsAdmin;
