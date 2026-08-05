import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dashboard } from "@/components/metabolic/Dashboard";
import { Onboarding } from "@/components/metabolic/Onboarding";
import { readSavedSession, useMetabolismSimulation } from "@/hooks/useMetabolismSimulation";

const TITLE = "Metabolic Gauge — Real-Time Metabolism Simulator";
const DESCRIPTION =
  "Simulate glycogen, fat, ketosis and autophagy in real time. Feed, move and fast-forward the clock to watch your energy gauge respond.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const sim = useMetabolismSimulation();
  const [savedAvailable, setSavedAvailable] = useState(false);

  useEffect(() => {
    setSavedAvailable(!!readSavedSession());
  }, []);

  if (!sim.profile || !sim.state) {
    return (
      <Onboarding
        onStart={(input) => sim.start(input)}
        savedAvailable={savedAvailable}
        onResume={() => {
          const saved = readSavedSession();
          if (saved) sim.start(saved.profileInput, saved);
        }}
      />
    );
  }

  return <Dashboard sim={sim} />;
}
