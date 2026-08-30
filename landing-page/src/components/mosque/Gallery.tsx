import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n";
import apiService, { backendAssetUrl } from "@/lib/api";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import img1 from "@/assets/mosque-1.jpg";
import img2 from "@/assets/mosque-2.jpg";
import img3 from "@/assets/mosque-3.jpg";

const cats = ["All", "Prayer", "Events", "Building", "Education", "Charity"];
type GalleryItem = {
  id?: number;
  image_path?: string;
  category: string;
  title_bn?: string;
  title_en?: string;
};

const DEFAULT_ITEMS = [
  {
    image_path: img1,
    category: "Building",
    title_bn: "মসজিদের সম্মুখ",
    title_en: "Mosque Exterior",
  },
  { image_path: img2, category: "Prayer", title_bn: "নামাজের হল", title_en: "Prayer Hall" },
  { image_path: img3, category: "Events", title_bn: "ইফতার আয়োজন", title_en: "Iftar Gathering" },
  { image_path: img1, category: "Building", title_bn: "মিনার", title_en: "Minaret View" },
  { image_path: img2, category: "Prayer", title_bn: "মিহরাব", title_en: "Mihrab" },
  { image_path: img3, category: "Charity", title_bn: "খাদ্য বিতরণ", title_en: "Food Distribution" },
  { image_path: img1, category: "Education", title_bn: "কুরআন ক্লাস", title_en: "Quran Class" },
  { image_path: img2, category: "Events", title_bn: "ঈদ জামাত", title_en: "Eid Congregation" },
];
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#e8efec"/><path d="M250 340h300v35H250zm40-25V205h220v110h-45v-75H335v75zm85-110v-45h50v45z" fill="#6d8980"/><circle cx="400" cy="135" r="20" fill="#b8924b"/></svg>',
  );

export function Gallery() {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState("All");
  const [items, setItems] = useState<GalleryItem[]>(DEFAULT_ITEMS);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  useEffect(() => {
    apiService
      .getGalleryImages("all", 12)
      .then((res) => {
        if (res && res.images && res.images.length > 0) {
          setItems(res.images);
        }
      })
      .catch((err) => console.error("Failed to fetch gallery images:", err));
  }, []);

  const filtered = filter === "All" ? items : items.filter((i) => i.category === filter);
  const selectedIndex = selected
    ? filtered.findIndex((item) =>
        selected.id != null ? item.id === selected.id : item === selected,
      )
    : -1;
  const selectRelative = (direction: number) => {
    if (!filtered.length) return;
    const current = selectedIndex >= 0 ? selectedIndex : 0;
    setSelected(filtered[(current + direction + filtered.length) % filtered.length]);
  };
  const openViewer = (item?: GalleryItem) => {
    setSelected(item || filtered[0] || items[0] || null);
    setViewerOpen(true);
  };

  useEffect(() => {
    if (!viewerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") selectRelative(-1);
      if (event.key === "ArrowRight") selectRelative(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <section id="gallery" className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 grid items-end gap-5 md:grid-cols-[1fr_.7fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Stories in pictures
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("gal.title")}</h2>
          </div>
          <p className="text-sm leading-7 text-muted-foreground md:justify-self-end">
            {t("gal.subtitle")}
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                filter === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent text-foreground/70"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid auto-rows-[160px] grid-cols-2 gap-3 sm:auto-rows-[220px] md:grid-cols-4">
          {filtered.map((it, i) => {
            const label = lang === "bn" ? it.title_bn : it.title_en;
            const imageUrl = backendAssetUrl(it.image_path) || "/static/img/placeholder.png";

            return (
              <div
                key={it.id || i}
                role="button"
                tabIndex={0}
                onClick={() => openViewer(it)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") openViewer(it);
                }}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 shadow-card outline-none first:col-span-2 first:row-span-2 hover:ring-2 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary [&:nth-child(4)]:md:col-span-2"
              >
                <img
                  src={imageUrl}
                  alt={label}
                  loading="lazy"
                  onError={(event) => {
                    if (event.currentTarget.src !== IMAGE_PLACEHOLDER) {
                      event.currentTarget.src = IMAGE_PLACEHOLDER;
                    }
                  }}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent p-4 opacity-80 transition-opacity group-hover:opacity-100 sm:p-5">
                  <span className="text-xs text-gold font-semibold uppercase tracking-wider">
                    {it.category}
                  </span>
                  <p className="text-white font-semibold">{label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <button
            type="button"
            onClick={() => openViewer()}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-5 py-2.5 font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            <Images className="h-4 w-4" />
            {t("gal.viewall")} →
          </button>
        </div>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border/70 px-5 py-4 pr-12">
            <DialogTitle>
              {lang === "bn" ? "সম্পূর্ণ ছবি গ্যালারি" : "Complete photo gallery"}
            </DialogTitle>
            <DialogDescription>
              {lang === "bn"
                ? `${filtered.length}টি ছবি · তীর চিহ্ন ব্যবহার করে ছবি পরিবর্তন করুন`
                : `${filtered.length} photos · Use arrow keys to navigate`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[78vh] overflow-y-auto p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {cats.map((category) => (
                <button
                  key={`viewer-${category}`}
                  type="button"
                  onClick={() => {
                    setFilter(category);
                    const nextItems =
                      category === "All"
                        ? items
                        : items.filter((item) => item.category === category);
                    setSelected(nextItems[0] || null);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {selected ? (
              <>
                <div className="relative overflow-hidden rounded-2xl bg-slate-950">
                  <img
                    src={backendAssetUrl(selected.image_path) || IMAGE_PLACEHOLDER}
                    alt={lang === "bn" ? selected.title_bn : selected.title_en}
                    onError={(event) => {
                      if (event.currentTarget.src !== IMAGE_PLACEHOLDER) {
                        event.currentTarget.src = IMAGE_PLACEHOLDER;
                      }
                    }}
                    className="h-[48vh] min-h-[280px] w-full object-contain"
                  />
                  {filtered.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => selectRelative(-1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-3 text-white backdrop-blur transition hover:bg-black/80"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => selectRelative(1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-3 text-white backdrop-blur transition hover:bg-black/80"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-5 pb-4 pt-12 text-white">
                    <p className="text-xs font-bold uppercase tracking-wider text-gold">
                      {selected.category}
                    </p>
                    <p className="text-lg font-semibold">
                      {lang === "bn" ? selected.title_bn : selected.title_en}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                  {filtered.map((item, index) => (
                    <button
                      type="button"
                      key={`thumb-${item.id || index}`}
                      onClick={() => setSelected(item)}
                      className={`aspect-[4/3] overflow-hidden rounded-lg border-2 transition ${
                        index === selectedIndex
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={backendAssetUrl(item.image_path) || IMAGE_PLACEHOLDER}
                        alt={lang === "bn" ? item.title_bn : item.title_en}
                        onError={(event) => {
                          if (event.currentTarget.src !== IMAGE_PLACEHOLDER) {
                            event.currentTarget.src = IMAGE_PLACEHOLDER;
                          }
                        }}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-16 text-center text-muted-foreground">
                {lang === "bn" ? "এই বিভাগে কোনো ছবি নেই।" : "No photos in this category."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
