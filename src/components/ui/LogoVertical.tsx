import { cn } from "@/lib/utils";

interface LogoVerticalProps {
  className?: string;
  hideText?: boolean;
}

export const LogoVertical = ({ className, hideText = false }: LogoVerticalProps) => (
  <svg 
    className={cn(className)} 
    viewBox="0 0 1024 1024" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="logo-v-grad-52" x1="507.3" y1="250.83" x2="448.22" y2="492.88" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#eeeeed"/>
        <stop offset="1" stopColor="#abadb3"/>
      </linearGradient>
      <linearGradient id="logo-v-grad-96" x1="344.47" y1="271.49" x2="677.24" y2="154.43" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#1944a9"/>
        <stop offset=".46" stopColor="#1843a6"/>
        <stop offset=".69" stopColor="#17409f"/>
        <stop offset=".87" stopColor="#153b91"/>
        <stop offset="1" stopColor="#143683"/>
      </linearGradient>
      <linearGradient id="logo-v-grad-93" x1="464.54" y1="133.23" x2="529.51" y2="249.99" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#164fc7"/>
        <stop offset="1" stopColor="#2d66d7"/>
      </linearGradient>
      <linearGradient id="logo-v-grad-77" x1="415.7" y1="655.05" x2="600.13" y2="405.32" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#21282a"/>
        <stop offset="1" stopColor="#828a94"/>
      </linearGradient>
      <linearGradient id="logo-v-grad-67" x1="472.35" y1="275.99" x2="588.27" y2="685.55" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#103191"/>
        <stop offset=".47" stopColor="#0f2f8e"/>
        <stop offset=".71" stopColor="#0c2987"/>
        <stop offset=".89" stopColor="#081e79"/>
        <stop offset="1" stopColor="#05156e"/>
      </linearGradient>
      <linearGradient id="logo-v-grad-60" x1="506.39" y1="222.98" x2="668.77" y2="671.04" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#173999"/>
        <stop offset="1" stopColor="#020f54"/>
      </linearGradient>
      <radialGradient id="logo-v-grad-11" cx="473.8" cy="330.23" fx="473.8" fy="330.23" r="36.56" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#0e48e1"/>
        <stop offset=".29" stopColor="#0e47de"/>
        <stop offset=".48" stopColor="#0e45d5"/>
        <stop offset=".64" stopColor="#0f41c6"/>
        <stop offset=".79" stopColor="#113bb1"/>
        <stop offset=".92" stopColor="#123496"/>
        <stop offset="1" stopColor="#143083"/>
      </radialGradient>
      <linearGradient id="logo-v-grad-44" x1="400.35" y1="439.52" x2="328.62" y2="319.2" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#050608"/>
        <stop offset=".05" stopColor="#0d1016"/>
        <stop offset=".13" stopColor="#171f29"/>
        <stop offset=".22" stopColor="#1f2936"/>
        <stop offset=".34" stopColor="#232f3e"/>
        <stop offset=".57" stopColor="#253141"/>
      </linearGradient>
      <linearGradient id="logo-v-grad-26" x1="283.42" y1="406.25" x2="393.86" y2="347.95" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#3c4252"/>
        <stop offset=".37" stopColor="#404859"/>
        <stop offset=".91" stopColor="#4d5b6d"/>
        <stop offset="1" stopColor="#505f71"/>
      </linearGradient>
    </defs>
    {/* Parrot Icon - Original Colors */}
    <g>
      <path fill="url(#logo-v-grad-52)" d="M383.95,299.33s38.29-55.22,78.88-54.47,62.03.7,94.96,27.23c32.93,26.54,32.93,49.68,34.46,75.82,1.53,26.14-13.79,55.26-47.48,76.17-33.7,20.91-89.35,5.97-127.01,69.45l-.05-98.46s-.55-36.98-19.46-48.79-14.31-46.95-14.31-46.95Z"/>
      <path fill="url(#logo-v-grad-96)" d="M505.79,207.63s27.91-2.72,63.8,5.49c35.89,8.22,113.16-42.56,88.79-112.32,0,0,.6,12.84-6.52,17.59-7.12,4.75-53.85,43.76-164.56,54.99-110.71,11.23-125.72,146.74-125.72,146.74l15.73.08s23.76-116.36,128.49-112.58Z"/>
      <path fill="url(#logo-v-grad-93)" d="M658.38,100.8s.89,37.24-146.38,44.69-171.29,136.47-164.31,158.58c0,0,24.26-5.6,29.62-4.73,0,0,6.96-97.75,91.49-116.45,0,0,45.48-11.51,89.49-12.12s112.23-51.6,100.09-69.95Z"/>
      <path fill="#545f6e" d="M341.23,445.21s-35.91-33.2-35.91-74.54,27.1-60.31,35.91-64.37,34.56-8.13,43.37-6.78c0,0-6.78,29.14,14.23,46.75,21.01,17.62,18.97,48.79,18.97,48.79l.05,47.43s-42.74,4.07-77.3-20.33c0,0-2.71,7.45.68,23.04Z"/>
      <path fill="url(#logo-v-grad-77)" d="M404.57,519.96s12.83-71.35,93.4-81.5c80.57-10.15,102.04-90.1,96.86-116.01s30.49,25.17,30.49,25.17l-68.24,189.51s-94.76,126.59-57.74,169.53c0,0-131.77-47.66-94.76-186.7Z"/>
      <path fill="url(#logo-v-grad-67)" d="M440.85,587.47s2.96-50.92,59.22-93.94c56.26-43.02,98.3-64.48,88.02-163.68,0,0,.62-51.84-70.35-77.37,0,0,72.65,7.04,97.08,65.52,24.43,58.48,4.44,163.6-41.46,209.5-45.9,45.9-101.42,142.88-74.03,179.15,0,0-73.29-41.46-58.48-119.19Z"/>
      <path fill="url(#logo-v-grad-60)" d="M679.22,177.53s-14.5,31.31-99.24,25.64c-84.75-5.67-92.22-8.13-127.2,6.12-34.97,14.25-57.68,34.57-75.47,90.04l7.29.19s39.27-61.98,95.41-54.23c52.09,7.19,77.69,17.11,113.53,65.03s13.88,135.01-20.92,177.2c-34.79,42.2-73.29,51.08-91.8,117.71-18.51,66.63,18.51,101.42,18.51,101.42,0,0-5.92-46.64,34.79-85.87,40.72-39.24,66.63-71.81,81.43-122.89,0,0,2.96,2.96,4.44,38.5,0,0,71.07-60.7,34.79-177.67,0,0,20.73,10.36,32.57,41.46,0,0,25.56-99.57-72.55-162.86,0,0,71.8-7.78,64.4-59.78Z"/>
      <circle fill="url(#logo-v-grad-11)" cx="473.8" cy="330.23" r="36.56"/>
      <path fill="url(#logo-v-grad-44)" d="M341.23,445.21s-35.91-33.2-35.91-74.54,27.1-60.31,35.91-64.37,34.56-8.13,43.37-6.78c0,0-6.78,29.14,14.23,46.75,21.01,17.62,18.97,48.79,18.97,48.79l.05,47.43s-42.74,4.07-77.3-20.33c0,0-2.71,7.45.68,23.04Z"/>
      <path fill="url(#logo-v-grad-26)" d="M339.93,424.95c.52-9.98,3.18-20.62,11.63-24.22,17.35-7.39,26.98,1.61,46.26-30.2,3.67-6.06,6.42-11.46,8.47-16.25-2.09-2.85-4.55-5.56-7.47-8-21.01-17.62-14.23-46.75-14.23-46.75-8.81-1.36-34.56,2.71-43.37,6.78-8.81,4.07-35.91,23.04-35.91,64.37s35.91,74.54,35.91,74.54c-2.2-10.14-1.83-16.82-1.29-20.26Z"/>
    </g>
    {/* Text - "NO" in blue #2465d2, "PARROT" in white */}
    {!hideText && (
      <text
        x="512"
        y="900"
        textAnchor="middle"
        style={{
          fontFamily: 'Impact, sans-serif',
          fontSize: '150px',
          letterSpacing: '0.02em',
        }}
      >
        <tspan fill="#2465d2">NO</tspan>
        <tspan fill="#ffffff">PARROT</tspan>
      </text>
    )}
  </svg>
);
