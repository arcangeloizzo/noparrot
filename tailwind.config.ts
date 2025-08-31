import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				// NOPARROT Brand Colors
				'primary-blue': 'hsl(var(--primary-blue))',
				'dark-blue': 'hsl(var(--dark-blue))',
				'light-blue': 'hsl(var(--light-blue))',
				'light-gray': 'hsl(var(--light-gray))',
				'brand-pink': 'hsl(var(--brand-pink))',
				'brand-yellow': 'hsl(var(--brand-yellow))',
				// Trust Score Colors
				'trust-low': 'hsl(var(--trust-low))',
				'trust-low-text': 'hsl(var(--trust-low-text))',
				'trust-medium': 'hsl(var(--trust-medium))',
				'trust-medium-text': 'hsl(var(--trust-medium-text))',
				'trust-high': 'hsl(var(--trust-high))',
				'trust-high-text': 'hsl(var(--trust-high-text))',
				// Custom logo colors
				'logo-no': '#bbe6e4',
				'logo-parrot': '#0a77ed',
			},
			spacing: {
				'1': 'var(--space-1)',
				'2': 'var(--space-2)',
				'3': 'var(--space-3)',
				'4': 'var(--space-4)',
				'6': 'var(--space-6)',
				'8': 'var(--space-8)',
				'safe-bottom': 'calc(var(--space-4) + var(--safe-area-bottom))',
				'280': '280px', // Custom width for buttons
			},
			width: {
				'280': '280px',
			},
			fontFamily: {
				'inter': 'var(--font-inter)',
			},
			borderRadius: {
				'sm': 'var(--radius-sm)',
				'md': 'var(--radius-md)',
				'lg': 'var(--radius-lg)',
				'full': 'var(--radius-full)',
			},
			boxShadow: {
				'card': 'var(--shadow-card)',
				'sm': 'var(--shadow-sm)',
				'md': 'var(--shadow-md)',
				'lg': 'var(--shadow-lg)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'logo-scale-in': {
					'0%': { transform: 'scale(1) translateY(0)' },
					'100%': { transform: 'scale(0.55) translateY(-40px)' }
				},
				'fade-slide-up': {
					'0%': { opacity: '0', transform: 'translateY(20px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'shake': {
					'0%, 100%': { transform: 'translateX(0)' },
					'25%': { transform: 'translateX(-4px)' },
					'75%': { transform: 'translateX(4px)' }
				},
				'bounce-check': {
					'0%': { transform: 'scale(0)' },
					'50%': { transform: 'scale(1.2)' },
					'100%': { transform: 'scale(1)' }
				},
				'mint-flash': {
					'0%': { backgroundColor: 'transparent' },
					'50%': { backgroundColor: 'rgba(72, 187, 120, 0.2)' },
					'100%': { backgroundColor: 'transparent' }
				},
				// NOPARROT Premium Animations
				'breathe': {
					'0%, 100%': { transform: 'scale(1)' },
					'50%': { transform: 'scale(1.05)' }
				},
				'glow-pulse': {
					'0%, 100%': { boxShadow: 'var(--glow-primary)' },
					'50%': { boxShadow: 'var(--glow-primary), 0 0 30px hsl(var(--primary) / 0.4)' }
				},
				'float-in': {
					'0%': { transform: 'translateY(20px) scale(0.95)', opacity: '0' },
					'100%': { transform: 'translateY(0) scale(1)', opacity: '1' }
				},
				'magnetic-hover': {
					'0%': { transform: 'translateY(0) scale(1)' },
					'100%': { transform: 'translateY(-2px) scale(1.02)' }
				},
				'nav-morph': {
					'0%': { transform: 'scale(1) rotate(0deg)' },
					'50%': { transform: 'scale(1.2) rotate(10deg)' },
					'100%': { transform: 'scale(1) rotate(0deg)' }
				},
				'card-illuminate': {
					'0%': { boxShadow: 'var(--shadow-card)' },
					'100%': { boxShadow: 'var(--shadow-card), var(--glow-primary)' }
				},
				'trust-glow': {
					'0%, 100%': { filter: 'brightness(1)' },
					'50%': { filter: 'brightness(1.2) drop-shadow(0 0 8px currentColor)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'logo-scale-in': 'logo-scale-in 900ms cubic-bezier(0.4, 0, 0.2, 1)',
				'fade-slide-up': 'fade-slide-up 700ms cubic-bezier(0.4, 0, 0.2, 1)',
				'shake': 'shake 0.3s ease-in-out',
				'bounce-check': 'bounce-check 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
				'mint-flash': 'mint-flash 0.5s ease-out',
				
				// NOPARROT Premium Animations
				'breathe': 'breathe 3s ease-in-out infinite',
				'glow-pulse': 'glow-pulse 2s ease-in-out infinite', 
				'float-in': 'float-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
				'magnetic-hover': 'magnetic-hover 0.2s ease-out',
				'nav-morph': 'nav-morph 0.3s ease-out',
				'card-illuminate': 'card-illuminate 0.3s ease-out forwards',
				'trust-glow': 'trust-glow 2s ease-in-out infinite',
			}
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		require("@tailwindcss/line-clamp")
	],
} satisfies Config;
