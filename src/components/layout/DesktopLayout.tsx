import { ReactNode } from "react";
import { DesktopHeader } from "@/components/navigation/DesktopHeader";

interface DesktopLayoutProps {
    children: ReactNode;
    leftSidebar: ReactNode;
    rightSidebar: ReactNode;
}

export const DesktopLayout = ({ children, leftSidebar, rightSidebar }: DesktopLayoutProps) => {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <DesktopHeader />

            <main className="pt-20 max-w-[1400px] mx-auto grid grid-cols-12 gap-8 px-6">
                {/* Left Sidebar - Sticky */}
                <aside className="col-span-3 hidden lg:block sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto pr-4 custom-scrollbar">
                    {leftSidebar}
                </aside>

                {/* Center Feed - Scrollable */}
                <section className="col-span-12 lg:col-span-6 pb-20">
                    {children}
                </section>

                {/* Right Sidebar - Sticky */}
                <aside className="col-span-3 hidden lg:block sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto pl-4 custom-scrollbar">
                    {rightSidebar}
                </aside>
            </main>
        </div>
    );
};
