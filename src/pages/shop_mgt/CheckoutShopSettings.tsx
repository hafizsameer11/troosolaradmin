import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { getCheckoutSettings } from "../../utils/queries/checkoutSettings";
import {
  updateCheckoutSettings,
  type CheckoutSettingsPayload,
} from "../../utils/mutations/checkoutSettings";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const CheckoutShopSettings = () => {
  const token = Cookies.get("token") || "";
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["checkout-settings"],
    queryFn: () => getCheckoutSettings(token),
    enabled: !!token,
  });

  const settings = data?.data;
  const preview = settings?.preview;

  const [form, setForm] = useState<CheckoutSettingsPayload>({});

  React.useEffect(() => {
    if (!settings) return;
    setForm({
      delivery_fee: settings.delivery_fee,
      category_delivery_fees: settings.category_delivery_fees || {},
      delivery_min_working_days: settings.delivery_min_working_days,
      delivery_max_working_days: settings.delivery_max_working_days,
      insurance_fee: settings.insurance_fee,
      vat_percentage: settings.vat_percentage ?? 7.5,
      insurance_fee_percentage: settings.insurance_fee_percentage ?? 3,
      installation_flat_addon: settings.installation_flat_addon ?? 0,
      installation_schedule_working_days:
        settings.installation_schedule_working_days,
      installation_description: settings.installation_description ?? "",
    });
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (payload: CheckoutSettingsPayload) =>
      updateCheckoutSettings(payload, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["checkout-settings"] });
      alert("Checkout settings saved.");
    },
    onError: () => {
      alert("Failed to save settings.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  if (!token) {
    return (
      <p className="text-sm text-gray-600">Please sign in to manage checkout.</p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <p className="text-sm text-red-600">
        Could not load checkout settings. Check your connection and try again.
      </p>
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-600 mb-6">
        These values drive cart checkout and Buy Now / BNPL flows: VAT %, delivery
        fees (global default and per product category), delivery window, insurance
        as a % of (items + installation) when installation is selected, optional
        flat shop add-on on top of per-product installation, installation lead time,
        and the installation notice shown in the cart.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">
              Default delivery fee (₦) — shop cart &amp; fallback when a category fee is not set
            </span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.delivery_fee ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  delivery_fee: Number(e.target.value),
                }))
              }
            />
          </label>
        </div>

        <div className="rounded-xl border border-[#273E8E]/15 bg-[#F5F7FF] p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">
            Buy Now / BNPL delivery fee by product category
          </p>
          <p className="text-xs text-gray-600">
            Set a delivery fee for each solution type (e.g. full solar kit vs battery only).
            Used when the bundle has no embedded delivery fee and no state/location override applies.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {(settings.product_categories || []).map(
              (cat: { key: string; label: string }) => (
                <label key={cat.key} className="block">
                  <span className="text-sm font-medium text-gray-700">
                    {cat.label}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={
                      form.category_delivery_fees?.[cat.key] ??
                      settings.category_delivery_fees?.[cat.key] ??
                      ""
                    }
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        category_delivery_fees: {
                          ...(f.category_delivery_fees ||
                            settings.category_delivery_fees ||
                            {}),
                          [cat.key]: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              VAT (%)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.vat_percentage ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  vat_percentage: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Insurance when installation is selected (% of items + installation)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.insurance_fee_percentage ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  insurance_fee_percentage: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">
              Installation flat add-on (₦, optional — added to per-product installation in cart)
            </span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.installation_flat_addon ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  installation_flat_addon: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Min delivery (working days)
            </span>
            <input
              type="number"
              min={1}
              max={90}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.delivery_min_working_days ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  delivery_min_working_days: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Max delivery (working days)
            </span>
            <input
              type="number"
              min={1}
              max={90}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.delivery_max_working_days ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  delivery_max_working_days: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">
              Installation schedule reference (working days from today)
            </span>
            <input
              type="number"
              min={1}
              max={90}
              className="mt-1 w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.installation_schedule_working_days ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  installation_schedule_working_days: Number(e.target.value),
                }))
              }
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Installation notice (shown in cart)
          </span>
          <textarea
            rows={4}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.installation_description ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                installation_description: e.target.value,
              }))
            }
          />
        </label>

        {preview && settings && (
          <div className="rounded-xl bg-[#F5F7FF] border border-[#273E8E]/20 p-4 text-sm">
            <p className="font-medium text-gray-900 mb-2">
              Live preview (matches cart checkout API)
            </p>
            <ul className="space-y-1 text-gray-700">
              <li>
                Default delivery fee:{" "}
                <strong>
                  ₦
                  {Number(
                    form.delivery_fee ?? settings.delivery_fee ?? 0
                  ).toLocaleString()}
                </strong>
              </li>
              {(settings.product_categories || []).map(
                (cat: { key: string; label: string }) => (
                  <li key={cat.key}>
                    {cat.label}:{" "}
                    <strong>
                      ₦
                      {Number(
                        form.category_delivery_fees?.[cat.key] ??
                          settings.category_delivery_fees?.[cat.key] ??
                          form.delivery_fee ??
                          settings.delivery_fee ??
                          0
                      ).toLocaleString()}
                    </strong>
                  </li>
                )
              )}
              <li>
                VAT rate:{" "}
                <strong>
                  {form.vat_percentage ?? settings.vat_percentage ?? 7.5}%
                </strong>
              </li>
              <li>
                Insurance (when installation selected):{" "}
                <strong>
                  {form.insurance_fee_percentage ??
                    settings.insurance_fee_percentage ??
                    3}
                  %
                </strong>{" "}
                of (items subtotal + installation total)
              </li>
              <li>
                Installation flat add-on:{" "}
                <strong>
                  ₦
                  {Number(
                    form.installation_flat_addon ??
                      settings.installation_flat_addon ??
                      0
                  ).toLocaleString()}
                </strong>
              </li>
              <li>
                Delivery label:{" "}
                <strong>{preview.delivery_estimate_label}</strong>
              </li>
              <li>
                Delivery window: {preview.delivery_estimated_from} →{" "}
                {preview.delivery_estimated_to}
              </li>
              <li>
                Installation reference date:{" "}
                {preview.installation_estimated_date}
              </li>
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-[#273E8E] text-white px-8 py-3 rounded-full text-sm font-medium disabled:opacity-60"
        >
          {mutation.isPending ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
};

export default CheckoutShopSettings;
