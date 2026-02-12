import { useDailyFocus, DailyFocus } from "@/hooks/useDailyFocus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowRight } from "lucide-react";
import { useState } from "react";
import { FocusDetailSheet } from "@/components/feed/FocusDetailSheet";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export const DesktopDailyFocus = () => {
    const { data, isLoading } = useDailyFocus();
    const items = data?.items || [];
    const [selectedFocus, setSelectedFocus] = useState<DailyFocus | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    if (isLoading) {
        return (
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="px-0 space-y-4">
                    <Skeleton className="h-40 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                </CardContent>
            </Card>
        );
    }

    if (items.length === 0) return null;

    // Main featured item (first one)
    const featuredItem = items[0];
    // Other items
    const otherItems = items.slice(1);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-bold">Il Punto</h2>
                <span className="text-sm text-muted-foreground ml-auto capitalize">
                    {format(new Date(), "EEEE d MMM", { locale: it })}
                </span>
            </div>

            {/* Featured Card - Text Only for now to avoid broken images */}
            <div
                className="group relative overflow-hidden rounded-2xl cursor-pointer transition-transform hover:scale-[1.02] bg-gradient-to-br from-purple-900/50 to-slate-900/50 border border-purple-500/20"
                onClick={() => {
                    setSelectedFocus(featuredItem);
                    setDetailOpen(true);
                }}
            >
                <div className="p-5 relative z-20">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] font-bold tracking-wider uppercase text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
                            Top Story
                        </div>
                        <Sparkles className="w-4 h-4 text-purple-300" />
                    </div>

                    <h3 className="font-bold text-lg leading-tight mb-2 text-white">
                        {featuredItem.title}
                    </h3>
                    <p className="text-sm text-white/70 line-clamp-3">
                        {featuredItem.summary}
                    </p>
                </div>
            </div>

            {/* Other items list */}
            <div className="space-y-3">
                {otherItems.map((item) => (
                    <div
                        key={item.id}
                        className="flex gap-3 items-start group cursor-pointer p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                        onClick={() => {
                            setSelectedFocus(item);
                            setDetailOpen(true);
                        }}
                    >
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                                {item.title}
                            </h4>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <span>Leggi</span>
                                <ArrowRight className="w-3 h-3" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Sheet Reuse */}
            {selectedFocus && (
                <FocusDetailSheet
                    open={detailOpen}
                    onOpenChange={setDetailOpen}
                    type="daily"
                    category={selectedFocus.category}
                    title={selectedFocus.title}
                    deepContent={selectedFocus.deep_content}
                    sources={selectedFocus.sources}
                    imageUrl={selectedFocus.image_url}
                    focusId={selectedFocus.id}
                    editorialNumber={0} // Desktop doesn't track this strictly
                    reactions={selectedFocus.reactions}
                    // Handlers can be simplified or properly connected if needed
                    onLike={() => { }}
                    onShare={() => { }}
                    onComment={() => { }}
                />
            )}
        </div>
    );
};
