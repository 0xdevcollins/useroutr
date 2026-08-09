"use client";

import { useState } from "react";
<<<<<<< Updated upstream
import { Navbar } from "@/components/v2/Navbar";
import { Hero } from "@/components/v2/Hero";
import { ProblemStrip } from "@/components/v2/ProblemStrip";
import { HowItWorks } from "@/components/v2/HowItWorks";
import { Features } from "@/components/v2/Features";
import { Developers } from "@/components/v2/Developers";
import { Trust } from "@/components/v2/Trust";
import { FinalCTA } from "@/components/v2/FinalCTA";
import { Footer } from "@/components/v2/Footer";
=======
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { TrustStrip } from "@/components/site/TrustStrip";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Differentiators } from "@/components/site/Differentiators";
import { ForDevelopers } from "@/components/site/ForDevelopers";
import { ForBusinesses } from "@/components/site/ForBusinesses";
import { PricingTeaser } from "@/components/site/PricingTeaser";
import { Security } from "@/components/site/Security";
import { FinalCTA } from "@/components/site/FinalCTA";
import { Footer } from "@/components/site/Footer";
>>>>>>> Stashed changes
import { WaitlistModal } from "@/components/site/WaitlistModal";

export default function Home() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const openWaitlist = () => setWaitlistOpen(true);

  return (
    <>
      <Navbar onWaitlistClick={openWaitlist} />
      <main>
        <Hero onWaitlistClick={openWaitlist} />
<<<<<<< Updated upstream
        <ProblemStrip />
        <HowItWorks />
        <Features />
        <Developers />
        <Trust />
=======
        <TrustStrip />
        <HowItWorks />
        <Differentiators />
        <ForDevelopers />
        <ForBusinesses onWaitlistClick={openWaitlist} />
        <PricingTeaser />
        <Security />
>>>>>>> Stashed changes
        <FinalCTA onWaitlistClick={openWaitlist} />
      </main>
      <Footer />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </>
  );
}
