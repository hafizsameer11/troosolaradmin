import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Admin from "./Admin.tsx";
import Header from "../../component/Header.tsx";
import FinancingPartner from "./FinancingPartner.tsx";
import Tools from "./Tools.tsx";
import Notifications from "./Notifications.tsx";
import Product from "./Product.tsx";
import CalculatorSettings from "./CalculatorSettings.tsx";
import PricingRewardsSettings from "./PricingRewardsSettings.tsx";
import ProductFinancingSettings from "./ProductFinancingSettings.tsx";
import FaqsSettings from "./FaqsSettings.tsx";
import TicketSubjectsSettings from "./TicketSubjectsSettings.tsx";



const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as "admins" | "tools" | "calculator" | "pricing-rewards" | "product" | "product-financing" | "financing" | "notifications" | "faqs" | "support" | null;
  const isInternalUpdate = useRef(false);
  
  // Initialize activeTab from URL or default to "admins"
  const [activeTab, setActiveTab] = useState<
    "admins" | "tools" | "calculator" | "pricing-rewards" | "product" | "product-financing" | "financing" | "notifications" | "faqs" | "support"
  >(() => {
    if (tabFromUrl && ["admins", "tools", "calculator", "pricing-rewards", "product", "product-financing", "financing", "notifications", "faqs", "support"].includes(tabFromUrl)) {
      return tabFromUrl;
    }
    return "admins";
  });

  // Update URL when tab changes (user clicks a tab)
  useEffect(() => {
    const currentTabFromUrl = searchParams.get("tab");
    if (activeTab && currentTabFromUrl !== activeTab) {
      isInternalUpdate.current = true;
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, setSearchParams, searchParams]);

  // Update tab when URL changes (browser back/forward or direct navigation)
  // Only update if the change came from outside (not from our own update)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (tabFromUrl && ["admins", "tools", "calculator", "pricing-rewards", "product", "product-financing", "financing", "notifications", "faqs", "support"].includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  const tabs = [
    { id: "admins", label: "Admins" },
    { id: "tools", label: "Tools" },
    { id: "calculator", label: "Calculator" },
    { id: "pricing-rewards", label: "Pricing & Rewards" },
    { id: "product", label: "Product" },
    { id: "product-financing", label: "Product Financing" },
    { id: "financing", label: "Financing Partner" },
    { id: "notifications", label: "Notifications" },
    { id: "faqs", label: "FAQs" },
    { id: "support", label: "Support subjects" },
  ];

  return (
    <div className="min-[#F5F7FF]  bg-[#F5F7FF]">
      {/* Header */}
      <Header />

      <div className="p-6">
        <h1 className="text-3xl font-semibold mb-8">Settings</h1>

        {/* Tab Navigation */}
        <div className="flex gap-8 border-b border-gray-200 text-md mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2 cursor-pointer relative ${activeTab === tab.id
                ? "text-black font-semibold"
                : "text-[#00000080]"
                }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#273E8E] rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className={activeTab === "admins" ? "" : "px-6"}>
          {activeTab === "admins" && <Admin />}
          {activeTab === "tools" && <Tools />}
          {activeTab === "calculator" && <CalculatorSettings />}
          {activeTab === "pricing-rewards" && <PricingRewardsSettings />}
          {activeTab === "product" && <Product />}
          {activeTab === "product-financing" && <ProductFinancingSettings />}
          {activeTab === "financing" && <FinancingPartner />}
          {activeTab === "notifications" && <Notifications />}
          {activeTab === "faqs" && <FaqsSettings />}
          {activeTab === "support" && <TicketSubjectsSettings />}
        </div>
      </div>
    </div>
  );
};

export default Settings;
