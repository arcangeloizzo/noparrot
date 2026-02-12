import { ReactNode } from "react";
import { useIsDesktop } from "@/hooks/use-desktop";
import { DesktopLayout } from "@/components/layout/DesktopLayout";
import { DesktopLeftSidebar } from "@/components/layout/DesktopLeftSidebar";
import { DesktopDailyFocus } from "@/components/feed/DesktopDailyFocus";

interface DesktopPageWrapperProps {
    children: ReactNode;
    /* Optional: override sidebars if a specific page needs specific tools */
    leftSidebar?: ReactNode;
    rightSidebar?: ReactNode;
    /* If true, it just renders children without desktop layout on desktop (rare) */
    disableDesktopLayout?: boolean;
}

export const DesktopPageWrapper = ({
    children,
    leftSidebar,
    rightSidebar,
    disableDesktopLayout = false
}: DesktopPageWrapperProps) => {
    const isDesktop = useIsDesktop();

    if (isDesktop && !disableDesktopLayout) {
        return (
            <DesktopLayout
                leftSidebar={leftSidebar || <DesktopLeftSidebar />}
                rightSidebar={rightSidebar || <DesktopDailyFocus />}
            >
                {children}
            </DesktopLayout>
        );
    }

    // Mobile behavior: just render children (pages usually handle their own mobile shell)
    return <>{children}</>;
};
