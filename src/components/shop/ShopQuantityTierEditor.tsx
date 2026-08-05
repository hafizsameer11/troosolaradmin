import React from "react";

export type QuantityFeeTier = {
  min: number;
  max: number | null;
  amount: number;
};

type ShopQuantityFeeTierMap = Record<string, QuantityFeeTier[]>;

type Props = {
  title: string;
  description?: string;
  tiers: QuantityFeeTier[];
  onChange: (tiers: QuantityFeeTier[]) => void;
  allowAdd?: boolean;
};

export const ShopQuantityTierEditor: React.FC<Props> = ({
  title,
  description,
  tiers,
  onChange,
  allowAdd = true,
}) => {
  const updateTier = (index: number, patch: Partial<QuantityFeeTier>) => {
    const next = tiers.map((tier, i) =>
      i === index ? { ...tier, ...patch } : tier
    );
    onChange(next);
  };

  const removeTier = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const nextMin = last
      ? (last.max != null && last.max > 0 ? last.max + 1 : last.min + 1)
      : 1;
    onChange([...tiers, { min: nextMin, max: null, amount: 0 }]);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-[#273E8E]">{title}</p>
        {description ? (
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        {tiers.map((tier, index) => (
          <div
            key={`${title}-${index}`}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
          >
            <label className="block">
              <span className="text-xs font-medium text-gray-700">From (qty)</span>
              <input
                type="number"
                min={1}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={tier.min ?? ""}
                onChange={(e) =>
                  updateTier(index, { min: Number(e.target.value) || 1 })
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">
                To (qty) — blank = and above
              </span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={tier.max ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  updateTier(index, {
                    max: raw === "" ? null : Number(raw) || null,
                  });
                }}
                placeholder="and above"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Amount (₦)</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={tier.amount ?? ""}
                onChange={(e) =>
                  updateTier(index, { amount: Number(e.target.value) || 0 })
                }
              />
            </label>
            {allowAdd && tiers.length > 1 ? (
              <button
                type="button"
                onClick={() => removeTier(index)}
                className="text-xs text-red-600 hover:text-red-800 px-2 py-2"
              >
                Remove
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>

      {allowAdd ? (
        <button
          type="button"
          onClick={addTier}
          className="text-xs font-medium text-[#273E8E] hover:underline"
        >
          + Add tier
        </button>
      ) : null}
    </div>
  );
};

export const SHOP_TIER_SECTIONS: {
  key: string;
  title: string;
  description: string;
}[] = [
  {
    key: "panel_delivery",
    title: "Solar panel delivery fees",
    description:
      "By total panel count in cart (standalone panels, solar bundles, streetlights). Example: 1–4, 5–14, 15–24, 25+.",
  },
  {
    key: "inverter_delivery",
    title: "Inverter delivery fees",
    description:
      "By total inverter count (individual inverters and inverters inside inverter bundles).",
  },
  {
    key: "battery_delivery",
    title: "Battery delivery fees",
    description:
      "By total battery count (individual batteries and batteries inside bundles).",
  },
  {
    key: "panel_installation",
    title: "Solar panel installation fees",
    description:
      "By total panel count. Use even ranges (e.g. 1–2, 3–4, 5–6). Add more rows as needed.",
  },
  {
    key: "inverter_installation",
    title: "Inverter installation fees",
    description:
      "By inverter count: 1, 2, 3, 4, 4 and above. Added to panel and battery installation.",
  },
  {
    key: "battery_installation",
    title: "Battery installation fees",
    description:
      "By battery count: 1, 2, 3, 4, 4 and above. If cart has 4 batteries + 1 inverter, billing uses 3 batteries.",
  },
];

export type { ShopQuantityFeeTierMap };

export const defaultShopTierMap = (): ShopQuantityFeeTierMap => ({
  panel_delivery: [
    { min: 1, max: 4, amount: 0 },
    { min: 5, max: 14, amount: 0 },
    { min: 15, max: 24, amount: 0 },
    { min: 25, max: null, amount: 0 },
  ],
  inverter_delivery: [
    { min: 1, max: 4, amount: 0 },
    { min: 5, max: 14, amount: 0 },
    { min: 15, max: 24, amount: 0 },
    { min: 25, max: null, amount: 0 },
  ],
  battery_delivery: [
    { min: 1, max: 4, amount: 0 },
    { min: 5, max: 14, amount: 0 },
    { min: 15, max: 24, amount: 0 },
    { min: 25, max: null, amount: 0 },
  ],
  panel_installation: [
    ...Array.from({ length: 16 }, (_, i): QuantityFeeTier => {
      const start = i * 2 + 1;
      return { min: start, max: start + 1, amount: 0 };
    }),
    { min: 33, max: null, amount: 0 },
  ],
  inverter_installation: [
    { min: 1, max: 1, amount: 0 },
    { min: 2, max: 2, amount: 0 },
    { min: 3, max: 3, amount: 0 },
    { min: 4, max: null, amount: 0 },
  ],
  battery_installation: [
    { min: 1, max: 1, amount: 0 },
    { min: 2, max: 2, amount: 0 },
    { min: 3, max: 3, amount: 0 },
    { min: 4, max: null, amount: 0 },
  ],
});

export const mergeShopTierMap = (
  incoming?: ShopQuantityFeeTierMap | null
): ShopQuantityFeeTierMap => {
  const defaults = defaultShopTierMap();
  if (!incoming) return defaults;
  const out: ShopQuantityFeeTierMap = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (Array.isArray(incoming[key]) && incoming[key].length > 0) {
      out[key] = incoming[key].map((t) => ({
        min: Number(t.min) || 1,
        max: t.max == null || t.max === 0 ? null : Number(t.max),
        amount: Number(t.amount) || 0,
      }));
    }
  }
  return out;
};
