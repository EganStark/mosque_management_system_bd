import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { Clock, Heart } from "lucide-react";
import { useLang } from "@/lib/i18n";
import img1 from "@/assets/mosque-1.jpg";
import img2 from "@/assets/mosque-2.jpg";
import img3 from "@/assets/mosque-3.jpg";

const slides = [
  { img: img1, captionKey: "carousel.1" },
  { img: img2, captionKey: "carousel.2" },
  { img: img3, captionKey: "carousel.3" },
];

export function HeroCarousel() {
  const { t } = useLang();
  const [emblaRef, embla] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    const id = setInterval(() => embla.scrollNext(), 5000);
    return () => {
      clearInterval(id);
      embla.off("select", onSelect);
    };
  }, [embla]);

  return (
    <section
      id="home"
      className="relative h-[92svh] min-h-[620px] w-full overflow-hidden bg-[#071827]"
    >
      <div ref={emblaRef} className="overflow-hidden h-full">
        <div className="flex h-full">
          {slides.map((s, i) => (
            <div key={i} className="relative flex-[0_0_100%] h-full">
              <img
                src={s.img}
                alt={t(s.captionKey)}
                className="absolute inset-0 w-full h-full object-cover"
                {...(i === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
              />
              <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(4,15,29,.92)_0%,rgba(7,43,48,.68)_46%,rgba(5,18,31,.3)_72%,rgba(4,12,23,.8)_100%)]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06111f]/90 via-transparent to-[#06111f]/35" />
            </div>
          ))}
        </div>
      </div>

      {/* Overlay content */}
      <div className="absolute inset-0 flex items-center pointer-events-none">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-20">
          <div className="max-w-3xl pointer-events-auto rounded-[2rem] border border-white/10 bg-black/10 p-5 backdrop-blur-[2px] sm:p-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/15 border border-gold/45 backdrop-blur-md text-gold mb-6 animate-fade-in shadow-lg shadow-black/10">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse-soft" />
              <span className="text-xs font-medium tracking-wider uppercase">
                {t("brand.name")}
              </span>
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.08] text-white drop-shadow-sm animate-fade-in sm:text-5xl md:text-7xl lg:text-[5.2rem]">
              {t("hero.title")}
            </h1>
            <p className="mb-8 mt-6 max-w-2xl text-base leading-relaxed text-white/78 animate-fade-in sm:text-xl">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-3 animate-fade-in">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-primary px-6 text-primary-foreground shadow-elegant hover:bg-primary/90"
              >
                <a href="#prayer">
                  <Clock className="w-4 h-4 mr-2" />
                  {t("hero.cta.prayer")}
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/30 bg-white/8 px-6 text-white backdrop-blur-md hover:bg-white/16 hover:text-white"
              >
                <a href="#donate">
                  <Heart className="w-4 h-4 mr-2" />
                  {t("hero.cta.donate")}
                </a>
              </Button>
            </div>
            <p className="mt-6 text-sm text-white/70 italic animate-fade-in">
              {t(slides[selected].captionKey)}
            </p>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => embla?.scrollTo(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === selected ? "w-10 bg-gold" : "w-2 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
