"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { GenerateNew } from "@/components/GenerateNew";
import { GenerateVideo } from "@/components/GenerateVideo";
import { GenerateAstra } from "@/components/GenerateAstra";
import { RetrieveOld } from "@/components/RetrieveOld";

// "Generate New" renamed to "Generate Image" — label only, per CLAUDE3.md §1
// rule 1. No behavior/endpoint/logic change results from the rename.
const TABS = [
  { id: "generate-image", label: "Generate Image" },
  { id: "generate-video", label: "Generate Video" },
  { id: "generate-astra", label: "Generate using Astra" },
  { id: "retrieve", label: "Retrieve Old" },
];

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState("generate-image");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">BuildMyHome</h1>

      <Tabs tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

      {activeTab === "generate-image" && <GenerateNew />}
      {activeTab === "generate-video" && <GenerateVideo />}
      {activeTab === "generate-astra" && <GenerateAstra />}
      {activeTab === "retrieve" && <RetrieveOld />}
    </main>
  );
}
