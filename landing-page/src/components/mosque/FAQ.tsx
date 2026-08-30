import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search } from "lucide-react";
import { useLang } from "@/lib/i18n";
import apiService from "@/lib/api";

type FaqItem = {
  id?: number;
  question_bn?: string;
  question_en?: string;
  answer_bn?: string;
  answer_en?: string;
};

const DEFAULT_FAQS = [
  {
    question_bn: "আমি কীভাবে সদস্য হতে পারি?",
    question_en: "How do I become a member?",
    answer_bn:
      "মসজিদ অফিসে এসে অথবা যোগাযোগ ফর্ম পূরণ করে আবেদন করতে পারেন। ফি ও বিস্তারিত প্রশাসকের কাছে জানতে পারবেন।",
    answer_en:
      "Visit the mosque office or submit the contact form. Our administrator will share fees and details.",
  },
  {
    question_bn: "আমি কি অনুষ্ঠানের জন্য মসজিদ ভাড়া নিতে পারি?",
    question_en: "Can I rent the mosque for events?",
    answer_bn:
      "হ্যাঁ, বিবাহ, আকীকা ও অন্যান্য আয়োজনের জন্য মিলনায়তন বুকিং করা যায়। বিস্তারিত যোগাযোগ ফর্মে জানান।",
    answer_en:
      "Yes, our hall is available for weddings, aqiqah, and community events. Use the contact form for booking details.",
  },
  {
    question_bn: "আমি কীভাবে স্বেচ্ছাসেবক হতে পারি?",
    question_en: "How can I volunteer?",
    answer_bn:
      "শিক্ষা, ইফতার আয়োজন, পরিচ্ছন্নতা সহ বিভিন্ন বিভাগে আমাদের স্বেচ্ছাসেবকদের প্রয়োজন। যোগাযোগ করুন।",
    answer_en:
      "We always welcome volunteers for education, iftar arrangements, cleaning, and more. Reach out to us.",
  },
  {
    question_bn: "নামাজের সময় কোথায় পাব?",
    question_en: "Where can I find prayer times?",
    answer_bn:
      "এই পেইজের 'নামাজের সময়' সেকশনে সকল ওয়াক্তের সময় এবং পরবর্তী নামাজের কাউন্টডাউন দেখানো হয়।",
    answer_en:
      "Check the Prayer Times section above for all five daily prayers and a live countdown to the next prayer.",
  },
  {
    question_bn: "দান কীভাবে ব্যবহার করা হয়?",
    question_en: "How are donations used?",
    answer_bn:
      "১০০% দান মসজিদ রক্ষণাবেক্ষণ, শিক্ষা এবং সম্প্রদায়িক সেবায় ব্যবহৃত হয়। স্বচ্ছতার জন্য মাসিক হিসাব প্রকাশিত হয়।",
    answer_en:
      "100% of donations support mosque maintenance, education, and community services. Monthly transparency reports are published.",
  },
  {
    question_bn: "যাকাত কি গ্রহণ করা হয়?",
    question_en: "Are zakat donations accepted?",
    answer_bn:
      "হ্যাঁ, আমরা শরিয়াহ অনুযায়ী যাকাত গ্রহণ ও বিতরণ করি। দান ফর্মে 'যাকাত' সিলেক্ট করুন।",
    answer_en:
      "Yes, we accept and distribute zakat in accordance with Shariah. Select 'Zakat' in the donation form.",
  },
];

export function FAQ() {
  const { t, lang } = useLang();
  const [q, setQ] = useState("");
  const [faqs, setFaqs] = useState<FaqItem[]>(DEFAULT_FAQS);

  useEffect(() => {
    apiService
      .getFAQs("all")
      .then((res) => {
        if (res && res.faqs && res.faqs.length > 0) {
          setFaqs(res.faqs);
        }
      })
      .catch((err) => console.error("Failed to fetch FAQs:", err));
  }, []);

  const filtered = faqs.filter((f) => {
    const question = lang === "bn" ? f.question_bn : f.question_en;
    const answer = lang === "bn" ? f.answer_bn : f.answer_en;
    return (
      question?.toLowerCase().includes(q.toLowerCase()) ||
      answer?.toLowerCase().includes(q.toLowerCase())
    );
  });

  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 grid items-end gap-5 md:grid-cols-[1fr_.7fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Helpful answers
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("faq.title")}</h2>
          </div>
          <p className="text-sm leading-7 text-muted-foreground md:justify-self-end">
            Find clear answers about membership, prayer, donations and community services.
          </p>
        </div>
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("faq.search")}
            className="h-14 rounded-2xl border-border/70 bg-card pl-11 shadow-sm"
          />
        </div>
        <Accordion type="single" collapsible className="grid gap-3 md:grid-cols-2 md:items-start">
          {filtered.map((f, i) => {
            const question = lang === "bn" ? f.question_bn : f.question_en;
            const answer = lang === "bn" ? f.answer_bn : f.answer_en;
            return (
              <AccordionItem
                key={f.id || i}
                value={`i-${i}`}
                className="rounded-2xl border border-border/70 bg-card px-5 shadow-sm transition data-[state=open]:border-primary/40 data-[state=open]:shadow-card"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
