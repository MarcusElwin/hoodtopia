# Hoodtopia - AI-Powered E-commerce Demo

> An AI-powered hoodie e-commerce application demonstrating AI in E-commerce, Agentic Commerce, and Generative UX for the **LangChain Stockholm Meetup**.

[![CI](https://github.com/your-username/hoodtopia/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/hoodtopia/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

**Hoodtopia** is a demo e-commerce application that showcases three key concepts:

1. **AI in E-commerce** - LLM-powered shopping assistance using OpenAI
2. **Agentic Commerce** - Proactive AI agents guiding the shopping experience
3. **Generative UX** - Dynamic, personalized UI that adapts in real-time

### Features

- AI-powered chat assistant for product recommendations
- Smart product search with natural language understanding
- Multi-currency support (USD, SEK, JPY, GBP, EUR)
- AI-generated product images using Google Gemini
- Responsive dark-themed design
- Full shopping cart functionality

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router + Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4, shadcn/ui |
| **Database** | SQLite with Drizzle ORM |
| **API Layer** | tRPC with React Query |
| **AI Chat** | OpenAI GPT-4 |
| **Image Gen** | Google Gemini 3 Pro |
| **Testing** | Vitest |

## Quick Start

### Prerequisites

- Node.js 20+ (check `.nvmrc`)
- npm or yarn
- OpenAI API key
- Google AI API key (for image generation)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/hoodtopia.git
cd hoodtopia

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Add your API keys to .env.local
# OPENAI_API_KEY=sk-...
# GOOGLE_AI_API_KEY=...

# Push database schema
npm run db:push

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests with Vitest (watch mode) |
| `npm run test:run` | Run tests once (CI mode) |
| `npm run ci` | Run full CI pipeline locally |
| `npm run db:push` | Push schema changes to database |
| `npm run db:seed` | Seed database with products |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run generate:images` | Generate all hoodie images with Gemini |
| `npm run generate:accessories` | Generate all accessory images |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Homepage
│   ├── products/          # Product listing & details
│   ├── cart/              # Shopping cart
│   ├── faq/               # FAQ page
│   └── api/trpc/          # tRPC API handler
│
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Header, Footer
│   ├── home/              # Homepage sections
│   ├── products/          # Product cards & grids
│   └── ai/                # AI chat components
│
├── server/
│   ├── trpc.ts            # tRPC setup
│   └── routers/           # API routers (products, cart, ai)
│
├── services/
│   └── ai.ts              # OpenAI integration
│
├── db/
│   ├── schema.ts          # Drizzle schema
│   ├── index.ts           # DB connection
│   └── seed.ts            # Seed script
│
├── scripts/
│   ├── generate-images.ts          # Hoodie image generation
│   └── generate-accessory-images.ts # Accessory image generation
│
└── lib/
    ├── utils.ts           # Utility functions
    ├── trpc.ts            # tRPC client
    └── currency.tsx       # Currency context
```

## Database

The app uses SQLite with Drizzle ORM. The schema includes:

- **products** - 19 products (6 hoodies + 13 accessories)
- **productVariants** - 301 variants (colors/sizes)
- **carts** - Shopping cart sessions
- **cartItems** - Items in carts

### Product Categories

**Hoodies:**
- Classic Comfort Hoodie ($59.99)
- Tech Fleece Pro ($89.99)
- Athletic Performance Hoodie ($79.99)
- Oversized Street Hoodie ($69.99)
- Premium Zip-Up ($99.99)
- Heavyweight Winter Hoodie ($109.99)

**Accessories:**
- Stickers, pins, patches
- Mini hoodie keychain
- Cozy club socks
- Canvas tote bag
- Hoodie care kit
- Hoodie shaped mug

## AI Features

### Chat Assistant

The AI chat assistant helps customers find products by understanding natural language queries:

```
User: "I need a warm hoodie for winter running"
AI: Recommends Athletic Performance or Heavyweight Winter Hoodie
```

### Product Recommendations

Get AI-powered recommendations based on preferences:

```
Input: "casual everyday wear, earth tones"
Output: Classic Comfort Hoodie (high confidence)
```

## Environment Variables

Create a `.env.local` file with:

```env
# Required
OPENAI_API_KEY=sk-...

# Required for image generation
GOOGLE_AI_API_KEY=...

# Optional
DATABASE_URL=./db/hoodtopia.db
```

## Image Generation

Product images are generated using Google Gemini 3 Pro:

```bash
# Generate all hoodie images (48 total: 6 products × 8 colors)
npm run generate:images

# Generate all accessory images (13 total)
npm run generate:accessories

# Test with single image
npm run generate:images:test
npm run generate:accessories:test
```

## Development

### Type Checking

```bash
# Run TypeScript compiler
npx tsc --noEmit
```

### Database Management

```bash
# View database in browser
npm run db:studio

# Reset and re-seed
rm db/hoodtopia.db
npm run db:push
npm run db:seed
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built for the **LangChain Stockholm Meetup**
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

*This is a demo application. No real transactions are processed.*
