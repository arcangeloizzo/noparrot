import { cn } from "@/lib/utils";
import { LOGO_BASE, LOGO_EXTENDED, LOGO_WHITE, LOGO_WHITE_EXTENDED } from "@/config/brand";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "wordmark" | "extended" | "white" | "white-extended";
  dark?: boolean;
  id?: string;
  onClick?: () => void;
}

export const Logo = ({ className, size = "md", variant = "icon", dark = false, id, onClick }: LogoProps) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  const heightClasses = {
    sm: "h-4",
    md: "h-6", 
    lg: "h-8",
    xl: "h-10"
  };

  const clickableClasses = onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : "";

  const fontSizes = {
    sm: "16px",
    md: "24px",
    lg: "32px",
    xl: "40px"
  };

  if (variant === "icon") {
    return (
      <img 
        id={id}
        src={LOGO_BASE} 
        alt="NOPARROT" 
        className={cn(sizeClasses[size], clickableClasses, className)}
        onClick={onClick}
      />
    );
  }

  if (variant === "wordmark") {
    return (
      <div 
        className={cn("uppercase", clickableClasses, className)}
        style={{
          fontFamily: 'Impact, sans-serif',
          fontSize: fontSizes[size],
          lineHeight: 0.92,
          letterSpacing: '0.02em',
        }}
        onClick={onClick}
      >
        <span className="text-[#2465d2]">NO</span>
        <span className="text-foreground dark:text-white">PARROT</span>
      </div>
    );
  }

  if (variant === "extended") {
    return (
      <div 
        id={id}
        className={cn("flex items-center gap-1.5 uppercase", clickableClasses, className)}
        style={{
          fontFamily: 'Impact, sans-serif',
          fontSize: fontSizes[size],
          lineHeight: 0.92,
          letterSpacing: '0.02em',
        }}
        onClick={onClick}
      >
        <img 
          src={LOGO_BASE} 
          alt="" 
          className={cn(heightClasses[size], "w-auto")}
        />
        <div>
          <span className="text-[#2465d2]">NO</span>
          <span className="text-foreground dark:text-white">PARROT</span>
        </div>
      </div>
    );
  }

  if (variant === "white") {
    return (
      <img 
        id={id}
        src={LOGO_WHITE} 
        alt="NOPARROT" 
        className={cn(sizeClasses[size], clickableClasses, className)}
        onClick={onClick}
      />
    );
  }

  if (variant === "white-extended") {
    return (
      <div 
        id={id}
        className={cn("flex items-center gap-1.5 uppercase", clickableClasses, className)}
        style={{
          fontFamily: 'Impact, sans-serif',
          fontSize: fontSizes[size],
          lineHeight: 0.92,
          letterSpacing: '0.02em',
        }}
        onClick={onClick}
      >
        <img 
          src={LOGO_WHITE} 
          alt="" 
          className={cn(heightClasses[size], "w-auto")}
        />
        <div>
          <span className="text-white">NO</span>
          <span className="text-white">PARROT</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("flex items-center gap-1.5 uppercase", clickableClasses, className)}
      style={{
        fontFamily: 'Impact, sans-serif',
        fontSize: fontSizes[size],
        lineHeight: 0.92,
        letterSpacing: '0.02em',
      }}
      onClick={onClick}
    >
      <img 
        src={LOGO_BASE} 
        alt="NOPARROT" 
        className={sizeClasses[size]}
      />
      <div>
        <span className="text-[#2465d2]">NO</span>
        <span className="text-foreground dark:text-white">PARROT</span>
      </div>
    </div>
  );
};