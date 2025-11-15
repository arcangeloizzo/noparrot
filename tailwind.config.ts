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
				// NOPARROT Brand Colors dal Logo
				brand: {
					blue: '#2563EB',
					'blue-light': '#3B82F6',
					navy: '#1E293B',
					slate: '#475569',
					gray: '#F1F5F9',
				},
				'background-dark': '#0F172A',
				// NOPARROT Brand Colors (legacy)
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
				// Cognitive System
				'cognitive': {
					blue: '#2F7FEF',
					'bg-top': '#1B2024',
					'bg-bottom': '#14181C',
					'text-primary': '#F4F7FA',
					'text-secondary': '#9AA3AB',
				},
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
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
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
				'apple-spring': {
					'0%': { transform: 'scale(1)' },
					'50%': { transform: 'scale(0.98)' },
					'100%': { transform: 'scale(1)' }
				},
				'gentle-float': {
					'0%': { transform: 'translateY(0px)' },
					'100%': { transform: 'translateY(-2px)' }
				},
				'subtle-glow': {
					'0%, 100%': { opacity: '0.6' },
					'50%': { opacity: '0.8' }
				},
				'glass-blur': {
					'0%': { backdropFilter: 'blur(20px)' },
					'100%': { backdropFilter: 'blur(30px)' }
				},
				'focus-ring': {
					'0%': { boxShadow: '0 0 0 0 rgba(10, 122, 255, 0.4)' },
					'100%': { boxShadow: '0 0 0 4px rgba(10, 122, 255, 0.2)' }
				},
				'scale-bounce': {
					'0%': { transform: 'scale(1)' },
					'50%': { transform: 'scale(1.2)' },
					'100%': { transform: 'scale(1)' }
				},
				'blink-parrot': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.3' }
				},
				'typing-dot': {
					'0%, 60%, 100%': { opacity: '0.3', transform: 'translateY(0)' },
					'30%': { opacity: '1', transform: 'translateY(-4px)' }
				},
				'slide-up-blur': {
					'0%': { transform: 'translateY(100%)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'pulse-subtle': {
					'0%, 100%': { transform: 'scale(1)', opacity: '1' },
					'50%': { transform: 'scale(1.05)', opacity: '0.8' }
				},
				'brand-glow': {
					'0%, 100%': { 
						boxShadow: '0 0 20px rgba(37, 99, 235, 0.3)' 
					},
					'50%': { 
						boxShadow: '0 0 30px rgba(37, 99, 235, 0.5)' 
					},
				},
				'brand-pulse': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'logo-scale-in': 'logo-scale-in 900ms cubic-bezier(0.4, 0, 0.2, 1)',
				'fade-slide-up': 'fade-slide-up 700ms cubic-bezier(0.4, 0, 0.2, 1)',
				'fade-in': 'fade-in 0.3s ease-out',
				'shake': 'shake 0.3s ease-in-out',
				'bounce-check': 'bounce-check 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
				'mint-flash': 'mint-flash 0.5s ease-out',
				
				// Apple-style Premium Animations
				'apple-spring': 'apple-spring 0.2s ease-out',
				'gentle-float': 'gentle-float 0.3s ease-out',
				'subtle-glow': 'subtle-glow 3s ease-in-out infinite',
				'glass-blur': 'glass-blur 0.3s ease-out',
				'focus-ring': 'focus-ring 0.3s ease-out',
				
				// New UX Update Animations
				'scale-bounce': 'scale-bounce 0.3s ease-in-out',
				'blink-parrot': 'blink-parrot 0.3s ease-in-out',
				'typing-dot': 'typing-dot 1.4s ease-in-out infinite',
				'slide-up-blur': 'slide-up-blur 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
				'pulse-subtle': 'pulse-subtle 1s ease-in-out'
			}
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		require("@tailwindcss/line-clamp")
	],
} satisfies Config;
