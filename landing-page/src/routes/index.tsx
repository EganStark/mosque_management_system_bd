import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n";
import { Navbar } from "@/components/mosque/Navbar";
import { HeroCarousel } from "@/components/mosque/HeroCarousel";
import { LiveStats } from "@/components/mosque/LiveStats";
import { PrayerTimes } from "@/components/mosque/PrayerTimes";
import { Finance } from "@/components/mosque/Finance";
import { Donations } from "@/components/mosque/Donations";
import { Events } from "@/components/mosque/Events";
import { Announcements } from "@/components/mosque/Announcements";
import { DonateForm } from "@/components/mosque/DonateForm";
import { Community } from "@/components/mosque/Community";
import { Gallery } from "@/components/mosque/Gallery";
import { Staff } from "@/components/mosque/Staff";
import { FAQ } from "@/components/mosque/FAQ";
import { Janaza } from "@/components/mosque/Janaza";
import { Contact } from "@/components/mosque/Contact";
import { Footer } from "@/components/mosque/Footer";
import { ThemeProvider } from "@/lib/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "নূর কমিউনিটি মসজিদ — Noor Community Mosque" },
      {
        name: "description",
        content:
          "Prayer times, donations, events and community programs at Noor Community Mosque. A sanctuary of peace and faith.",
      },
      { property: "og:title", content: "Noor Community Mosque" },
      {
        property: "og:description",
        content: "A Sanctuary of Peace & Faith — prayer times, donations, events and community.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <main className="landing-shell min-h-screen bg-background overflow-x-hidden">
          <Navbar />
          <HeroCarousel />
          <PrayerTimes />
          <Announcements />
          <LiveStats />
          <Events />
          <Finance />
          <DonateForm />
          <Donations />
          <Community />
          <Gallery />
          <Staff />
          <FAQ />
          <Janaza />
          <Contact />
          <Footer />
        </main>
        <Toaster position="top-right" />
      </LanguageProvider>
    </ThemeProvider>
  );
}
