"use client";

import { useState } from "react";
import { Navbar } from "@/components/v2/Navbar";
import { Hero } from "@/components/v2/Hero";
import { ProblemStrip } from "@/components/v2/ProblemStrip";
import { HowItWorks } from "@/components/v2/HowItWorks";
import { Features } from "@/components/v2/Features";
import { Developers } from "@/components/v2/Developers";
import { Trust } from "@/components/v2/Trust";
import { FinalCTA } from "@/components/v2/FinalCTA";
import { Footer } from "@/components/v2/Footer";
import { WaitlistModal } from "@/components/site/WaitlistModal";

export default function Home() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const openWaitlist = () => setWaitlistOpen(true);

  return (
    <>
      <Navbar onWaitlistClick={openWaitlist} />
      <main>
        <Hero onWaitlistClick={openWaitlist} />
        <ProblemStrip />
        <HowItWorks />
        <Features />
        <Developers />
        <Trust />
        <FinalCTA onWaitlistClick={openWaitlist} />
      </main>
      <Footer />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </>
  );
}
