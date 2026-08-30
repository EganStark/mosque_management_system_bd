import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

type Dict = Record<string, { bn: string; en: string }>;

export const dict: Dict = {
  // Nav
  "nav.home": { bn: "হোম", en: "Home" },
  "nav.prayer": { bn: "নামাজের সময়", en: "Prayer Times" },
  "nav.donate": { bn: "দান করুন", en: "Donate" },
  "nav.notices": { bn: "ঘোষণা", en: "Notices" },
  "nav.gallery": { bn: "গ্যালারি", en: "Gallery" },
  "nav.contact": { bn: "যোগাযোগ", en: "Contact" },
  "nav.events": { bn: "অনুষ্ঠান", en: "Events" },

  // Brand
  "brand.name": { bn: "বায়তুর রহমান জামে মসজিদ", en: "Baitur Rahman Jame Mosjid" },
  "brand.tagline": { bn: "শান্তি ও বিশ্বাসের আশ্রয়", en: "A Sanctuary of Peace & Faith" },

  // Hero
  "hero.title": { bn: "শান্তি ও বিশ্বাসের আশ্রয়", en: "A Sanctuary of Peace & Faith" },
  "hero.subtitle": {
    bn: "ইবাদত, শিক্ষা ও সেবা — আমাদের সম্প্রদায়ের কেন্দ্রবিন্দু",
    en: "Worship, learning, and service at the heart of our community",
  },
  "hero.cta.prayer": { bn: "নামাজের সময় দেখুন", en: "View Prayer Times" },
  "hero.cta.donate": { bn: "এখনই দান করুন", en: "Donate Now" },

  // Carousel captions
  "carousel.1": { bn: "আমাদের মসজিদের সম্মুখ দৃশ্য", en: "Our beautiful mosque exterior" },
  "carousel.2": { bn: "নামাজের প্রধান হল", en: "Main prayer hall" },
  "carousel.3": { bn: "সম্প্রদায়িক ইফতার আয়োজন", en: "Community iftar gathering" },

  // Stats
  "stats.title": { bn: "আমাদের সম্প্রদায়", en: "Our Community" },
  "stats.members": { bn: "মোট সদস্য", en: "Total Members" },
  "stats.active": { bn: "সক্রিয় সদস্য", en: "Active" },
  "stats.male": { bn: "পুরুষ", en: "Male" },
  "stats.female": { bn: "মহিলা", en: "Female" },
  "stats.strong": { bn: "সদস্য সমৃদ্ধ সম্প্রদায়", en: "Members Strong" },
  "stats.prayers": { bn: "দৈনিক নামাজ", en: "Daily Prayers" },
  "stats.programs": { bn: "সাপ্তাহিক প্রোগ্রাম", en: "Weekly Programs" },

  // Prayer
  "prayer.title": { bn: "নামাজের সময়সূচি", en: "Prayer Times" },
  "prayer.next": { bn: "পরবর্তী নামাজ", en: "Next Prayer" },
  "prayer.fajr": { bn: "ফজর", en: "Fajr" },
  "prayer.dhuhr": { bn: "যোহর", en: "Dhuhr" },
  "prayer.asr": { bn: "আসর", en: "Asr" },
  "prayer.maghrib": { bn: "মাগরিব", en: "Maghrib" },
  "prayer.isha": { bn: "এশা", en: "Isha" },
  "prayer.in": { bn: "শুরু হবে", en: "Starts in" },

  // Finance
  "fin.title": { bn: "সম্পূর্ণ স্বচ্ছতা", en: "Full Transparency" },
  "fin.subtitle": {
    bn: "যাচাইকৃত আয় এবং অনুমোদিত ব্যয় শুধুমাত্র",
    en: "Verified collections and approved expenses only",
  },
  "fin.collections": { bn: "এই মাসের মোট আয়", en: "Collections This Month" },
  "fin.expenses": { bn: "এই মাসের মোট ব্যয়", en: "Expenses This Month" },
  "fin.balance": { bn: "বর্তমান উপলব্ধ ব্যালেন্স", en: "Current Balance Available" },
  "fin.updated": { bn: "সর্বশেষ আপডেট", en: "Last updated" },

  // Donations list
  "don.title": { bn: "সাম্প্রতিক যাচাইকৃত দান", en: "Recent Verified Donations" },
  "don.subtitle": { bn: "আমাদের উদার দাতাদের ধন্যবাদ", en: "Thank you to our generous donors" },
  "don.viewall": { bn: "সব দান দেখুন", en: "View All Donations" },
  "don.verified": { bn: "যাচাইকৃত", en: "Verified" },
  "don.anonymous": { bn: "নাম প্রকাশে অনিচ্ছুক", en: "Anonymous" },
  "don.type.general": { bn: "সাধারণ দান", en: "General Donation" },
  "don.type.zakat": { bn: "যাকাত", en: "Zakat" },
  "don.type.monthly": { bn: "মাসিক ফি", en: "Monthly Fee" },
  "don.type.special": { bn: "বিশেষ তহবিল", en: "Special Fund" },

  // Events
  "ev.title": { bn: "আগামী অনুষ্ঠানসমূহ", en: "Upcoming Events & Programs" },
  "ev.subtitle": { bn: "সব নাগরিকদের জন্য উন্মুক্ত", en: "Open to all community members" },
  "ev.viewfull": { bn: "সম্পূর্ণ ক্যালেন্ডার", en: "View Full Calendar" },
  "ev.register": { bn: "নিবন্ধন করুন", en: "Register" },

  // Announcements
  "ann.title": { bn: "সর্বশেষ ঘোষণা", en: "Latest Announcements" },
  "ann.all": { bn: "সব", en: "All" },
  "ann.events": { bn: "অনুষ্ঠান", en: "Events" },
  "ann.emergency": { bn: "জরুরি", en: "Emergency" },
  "ann.meetings": { bn: "সভা", en: "Meetings" },
  "ann.details": { bn: "বিস্তারিত", en: "Details" },

  // Donate form
  "form.title": { bn: "একটি দান করুন", en: "Make a Donation" },
  "form.subtitle": {
    bn: "আপনার উদার অবদান আমাদের সম্প্রদায়, শিক্ষা ও দাতব্য উদ্যোগে সহায়তা করে",
    en: "Your generous contributions support our community, education, and charitable initiatives",
  },
  "form.step1": { bn: "ধরন ও পরিমাণ", en: "Type & Amount" },
  "form.step2": { bn: "পেমেন্ট পদ্ধতি", en: "Payment Method" },
  "form.step3": { bn: "দাতার তথ্য", en: "Donor Information" },
  "form.step4": { bn: "নিশ্চিতকরণ", en: "Confirmation" },
  "form.next": { bn: "পরবর্তী", en: "Next" },
  "form.back": { bn: "পূর্ববর্তী", en: "Back" },
  "form.submit": { bn: "দান জমা দিন", en: "Submit Donation" },
  "form.custom": { bn: "অথবা কাস্টম পরিমাণ লিখুন", en: "Or enter custom amount" },
  "form.name": { bn: "পূর্ণ নাম", en: "Full Name" },
  "form.phone": { bn: "ফোন নম্বর", en: "Phone Number" },
  "form.email": { bn: "ইমেইল (ঐচ্ছিক)", en: "Email (optional)" },
  "form.tid": { bn: "লেনদেন আইডি (TID)", en: "Transaction ID (TID)" },
  "form.tidHelp": { bn: "পেমেন্ট থেকে TID পেস্ট করুন", en: "Paste the TID from your payment" },
  "form.anonymous": { bn: "নাম প্রকাশে অনিচ্ছুক হিসেবে দান করুন", en: "Donate anonymously" },
  "form.summary": { bn: "দানের সারসংক্ষেপ", en: "Donation Summary" },
  "form.success": {
    bn: "ধন্যবাদ! আপনার দান যাচাইয়ের জন্য জমা হয়েছে।",
    en: "Thank you! Your donation has been submitted for verification.",
  },

  // Community
  "comm.title": { bn: "আমাদের সম্প্রদায়", en: "Our Community" },
  "comm.tagline": {
    bn: "ইবাদত, শিক্ষা ও সম্প্রদায়ের কেন্দ্র",
    en: "A Center for Worship, Learning, and Community",
  },
  "comm.prayers.title": { bn: "দৈনিক নামাজ", en: "Daily Prayers" },
  "comm.prayers.desc": {
    bn: "পাঁচ ওয়াক্ত নামাজের জামাত সঠিক সময়ে অনুষ্ঠিত হয়",
    en: "Five daily prayers held in congregation on time",
  },
  "comm.support.title": { bn: "সম্প্রদায়িক সহায়তা", en: "Community Support" },
  "comm.support.desc": {
    bn: "সকল সদস্যের জন্য আর্থিক ও সামাজিক সাহায্য",
    en: "Financial and social aid for all community members",
  },
  "comm.learning.title": { bn: "ইসলামিক শিক্ষা", en: "Islamic Learning" },
  "comm.learning.desc": {
    bn: "শিশু ও প্রাপ্তবয়স্কদের জন্য কুরআন ও দ্বীনি ক্লাস",
    en: "Quran and religious classes for children and adults",
  },

  // Gallery
  "gal.title": { bn: "মসজিদ গ্যালারি", en: "Mosque Gallery" },
  "gal.subtitle": {
    bn: "আমাদের সম্প্রদায়ের স্মরণীয় মুহূর্ত",
    en: "Memorable moments from our community",
  },
  "gal.viewall": { bn: "সব ছবি দেখুন", en: "View All Photos" },

  // Staff
  "staff.title": { bn: "আমাদের টিম", en: "Meet Our Team" },
  "staff.subtitle": { bn: "নেতৃত্ব ও স্বেচ্ছাসেবক", en: "Leadership & Community Volunteers" },

  // FAQ
  "faq.title": { bn: "প্রায়শই জিজ্ঞাসিত প্রশ্ন", en: "Frequently Asked Questions" },
  "faq.search": { bn: "প্রশ্ন খুঁজুন...", en: "Search questions..." },

  // Janaza
  "jan.title": { bn: "জানাজা ও মৃত্যু সংবাদ", en: "Janaza & Death Notices" },
  "jan.subtitle": {
    bn: "আল্লাহ তাদেরকে জান্নাতুল ফিরদাউস দান করুন",
    en: "May Allah (SWT) grant them Jannatul Firdaus",
  },
  "jan.viewall": { bn: "সব জানাজা দেখুন", en: "View All Janaza Notices" },

  // Contact
  "contact.title": { bn: "যোগাযোগ করুন", en: "Get in Touch" },
  "contact.subtitle": { bn: "আমরা আপনার সাথে কথা বলতে আগ্রহী", en: "We'd love to hear from you" },
  "contact.send": { bn: "বার্তা পাঠান", en: "Send Message" },
  "contact.subject": { bn: "বিষয়", en: "Subject" },
  "contact.message": { bn: "বার্তা", en: "Message" },
  "contact.hours": { bn: "অফিস সময়", en: "Office Hours" },

  // Footer
  "footer.about": {
    bn: "২০১০ সাল থেকে বিশ্বাস, ঐক্য ও স্বচ্ছতার সাথে আমাদের সম্প্রদায়ের সেবা।",
    en: "Serving our community with faith, unity, and transparency since 2010.",
  },
  "footer.quick": { bn: "দ্রুত লিঙ্ক", en: "Quick Links" },
  "footer.info": { bn: "তথ্য", en: "Information" },
  "footer.donate": { bn: "দান", en: "Donate" },
  "footer.social": { bn: "সোশ্যাল ও যোগাযোগ", en: "Social & Contact" },
  "footer.rights": { bn: "সর্বস্বত্ব সংরক্ষিত", en: "All rights reserved" },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dict | string) => string;
}

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "bn" || saved === "en") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (key: string) => {
    const entry = dict[key];
    if (!entry) return key;
    return entry[lang];
  };

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

// Bengali numeral conversion
const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export function toBnNumber(n: number | string, lang: Lang): string {
  const s = String(n);
  if (lang === "en") return s;
  return s.replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
}

export function formatTaka(n: number, lang: Lang): string {
  return `৳${toBnNumber(n.toLocaleString("en-US"), lang)}`;
}
