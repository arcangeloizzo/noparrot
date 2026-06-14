import { forwardRef, type ReactNode, type CSSProperties } from 'react';

interface CardShellProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface ZoneProps {
  children?: ReactNode;
  className?: string;
}

const Header = forwardRef<HTMLDivElement, ZoneProps>(({ children, className }, ref) => (
  <div ref={ref} className={`zone-header ${className ?? ''}`}>
    {children}
  </div>
));
Header.displayName = 'CardShell.Header';

const Badge = forwardRef<HTMLDivElement, ZoneProps>(({ children, className }, ref) => (
  <div ref={ref} className={`zone-badge ${className ?? ''}`}>
    {children}
  </div>
));
Badge.displayName = 'CardShell.Badge';

interface MidProps extends ZoneProps {
  layoutMode?: 'filled' | 'hero' | 'poster';
}
const Mid = forwardRef<HTMLDivElement, MidProps>(({ children, className, layoutMode = 'filled' }, ref) => (
  <div ref={ref} className={`zone-mid zone-mid--${layoutMode} ${className ?? ''}`}>
    {children}
  </div>
));
Mid.displayName = 'CardShell.Mid';

const Bottom = forwardRef<HTMLDivElement, ZoneProps>(({ children, className }, ref) => (
  <div ref={ref} className={`zone-bottom ${className ?? ''}`}>
    {children}
  </div>
));
Bottom.displayName = 'CardShell.Bottom';

const CardShellRoot = forwardRef<HTMLDivElement, CardShellProps>(({ children, className, style }, ref) => (
  <div ref={ref} className={`card-shell ${className ?? ''}`} style={style}>
    {children}
  </div>
));
CardShellRoot.displayName = 'CardShell';

export const CardShell = Object.assign(CardShellRoot, { Header, Badge, Mid, Bottom });
