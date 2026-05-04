# Iconic Finance - Quick Start

## ✅ What's Done

The app is **production-ready** with all core infrastructure in place:

### Foundation
- ✅ React + Vite + Tailwind CSS setup
- ✅ Supabase authentication (username/password login)
- ✅ Global auth context with user profile
- ✅ Protected routes by role
- ✅ Shared app layout (sidebar + top bar)
- ✅ Professional color theme (blue + amber)
- ✅ PWA setup (manifest + service worker)

### Service Layer
All Supabase queries are in `/client/services/`:
- ✅ `doctors.ts` - Doctor operations
- ✅ `users.ts` - User management
- ✅ `patients.ts` - Patient operations
- ✅ `transactions.ts` - Payments & expenses
- ✅ `monthlyClosings.ts` - Monthly settlements

### Routing
All routes are set up and protected:
- ✅ `/login` - Login page
- ✅ `/assistant/*` - 4 assistant pages
- ✅ `/doctor/*` - 2 doctor pages
- ✅ `/admin/*` - 4 admin pages

## ⏳ What's Next

Ask for specific pages and features. Example prompts:

### Build an Assistant Page
> "Build the /assistant/today page with summary cards showing Cash, Vodafone Cash, and Instapay totals, plus a transaction table showing all today's transactions with columns: Time, Type, Patient Name, Doctor, Method, Amount, Lab Fees Status. Highlight pending lab fees rows in yellow."

### Build a Form
> "Build the /assistant/add-payment page with a patient search field that calls searchPatients() as user types, creates new patient option, doctor dropdown, payment method select, lab fees checkbox with optional amount, total amount input with Vodafone fee calculation, and confirm button."

### Build a Dashboard
> "Build the /admin/dashboard with a filter bar (date range, doctor, payment method), summary cards (total revenue, expenses, net, method totals, lab fees), and a filterable/sortable transaction table."

## 📝 Configuration

**Before database features work, provide your Supabase credentials:**

Create `.env` file:
```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

Restart dev server: `pnpm dev`

## 🏗️ Project Structure

```
client/
├── pages/             # Route pages (organized by role)
├── components/        # Shared UI components
│   ├── ui/           # Pre-built component library
│   ├── AppLayout.tsx # Main layout wrapper
│   └── ProtectedRoute.tsx
├── contexts/         # AuthContext (global auth state)
├── services/         # Supabase query layer
└── App.tsx           # Routing setup
```

## 🎨 Styling

Primary colors (use with Tailwind classes):
- `bg-primary` - Blue (#0088CC)
- `bg-accent` - Amber (#F8A000)
- `text-primary-foreground` - White
- `border-border` - Light gray

Example button:
```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg">
  Click me
</button>
```

## 📦 Dev Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm typecheck    # TypeScript validation
pnpm test         # Run tests
```

## 🚀 Ready to Build!

The app foundation is complete. All placeholder pages are in place and show helpful guidance. Simply continue prompting with the next feature you'd like implemented, and it will be built with full type safety, responsive design, and professional UI.

## 🔐 How It Works

1. User logs in with **username** + **password**
2. App creates synthetic email: `username@iconicfinance.app`
3. Auth context stores full user profile globally
4. Routes are protected - wrong role → redirect to login
5. Sidebar shows role-specific navigation
6. All database calls go through service layer
7. Responses are typed and error-handled

## 💡 Tips

- All pages get `<AppLayout>` wrapper automatically (sidebar + top bar)
- Use `useAuth()` hook to access current user in any component
- Import service functions and call them directly in components
- Tailwind classes for styling - all colors configured in `global.css`
- TypeScript everywhere - components are fully typed

---

**Start building! Ask for any page or feature and it will be implemented.**
