"use client";

import { useState } from "react";
import { AnnouncementBar } from "@/components/v2/AnnouncementBar";
import { Navbar } from "@/components/v2/Navbar";
import { Hero } from "@/components/v2/Hero";
import { TrustStrip } from "@/components/v2/TrustStrip";
import { Features } from "@/components/v2/Features";
import { Pricing } from "@/components/v2/Pricing";
import { Solutions } from "@/components/v2/Solutions";
import { Developers } from "@/components/v2/Developers";
import { Testimonials } from "@/components/v2/Testimonials";
import { FinalCTA } from "@/components/v2/FinalCTA";
import { Footer } from "@/components/v2/Footer";
import { WaitlistModal } from "@/components/site/WaitlistModal";

export default function Home() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const openWaitlist = () => setWaitlistOpen(true);

  return (
    <>
      <AnnouncementBar onAction={openWaitlist} />
      <Navbar onWaitlistClick={openWaitlist} />
      <main>
        <Hero onWaitlistClick={openWaitlist} />
        <TrustStrip />
        <Features />
        <Solutions />
        <Developers />
        <Pricing onWaitlistClick={openWaitlist} />
        <Testimonials />
        <FinalCTA onWaitlistClick={openWaitlist} />
      </main>
      <Footer />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </>
  );
}
