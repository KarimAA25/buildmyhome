"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { GenerateNew } from "@/components/GenerateNew";
import { RetrieveOld } from "@/components/RetrieveOld";

const TABS = [
  { id: "generate", label: "Generate New" },
  { id: "retrieve", label: "Retrieve Old" },
];

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState("generate");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">BuildMyHome</h1>

      <Tabs tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

      {activeTab === "generate" ? <GenerateNew /> : <RetrieveOld />}
    </main>
  );
}
