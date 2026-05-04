# Iconic Finance - Setup & Configuration Guide

## Project Overview

**Iconic Finance** is a complete, production-ready clinic finance management system built as a Progressive Web App (PWA) with React, Vite, Tailwind CSS, and Supabase.

The app supports three user roles:
- **Admin**: Full system access, financial reporting, monthly closings
- **Doctor**: View personal earnings, patient history
- **Assistant**: Record transactions, view daily summaries

## Technology Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS 3
- **Backend**: Supabase (Auth + PostgreSQL)
- **UI Components**: Radix UI + shadcn/ui
- **Icons**: Lucide React
- **Package Manager**: pnpm

## Project Structure

```
client/
├── pages/               # Route components (organized by role)
│   ├── Login.tsx       # Username/password login page
│   ├── Placeholder.tsx # Generic placeholder for WIP pages
│   ├── assistant/      # Assistant role pages
│   ├── doctor/         # Doctor role pages
│   └── admin/          # Admin role pages
├── components/
│   ├── ui/            # Pre-built UI component library
│   ├── AppLayout.tsx   # Shared layout with sidebar & top bar
│   └── ProtectedRoute.tsx # Route protection wrapper
├── contexts/
│   └── AuthContext.tsx # Global authentication state
├── services/          # Supabase service layer
│   ├── doctors.ts     # Doctor CRUD operations
│   ├── users.ts       # User management
│   ├── patients.ts    # Patient operations
│   ├── transactions.ts # Payment & expense transactions
│   └── monthlyClosings.ts # Monthly settlement logic
├── lib/
│   └── supabase.ts    # Supabase client initialization
├── App.tsx            # Main app with routing setup
└── global.css         # Tailwind + theme configuration

public/
├── manifest.json      # PWA manifest
└── sw.js              # Service worker (app shell caching)
```

## Environment Variables

The app requires two environment variables for Supabase connection:

**`.env` (create this file after you have your Supabase credentials)**
```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**`.env.example`** (reference file, already created)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Authentication Flow

1. User enters **username** and **password** on login page
2. App constructs synthetic email: `{username}@iconicfinance.app`
3. Calls Supabase auth: `signInWithPassword({ email, password })`
4. On successful login, fetches user profile from `public.users` table
5. Stores full user profile in **AuthContext** (global state)
6. Checks `is_active` flag - if false, signs out immediately with "Account disabled" message
7. Redirects to role-specific dashboard:
   - Admin → `/admin/dashboard`
   - Doctor → `/doctor/dashboard`
   - Assistant → `/assistant/today`

## Service Layer Architecture

All Supabase queries are encapsulated in the `/client/services/` directory. Each file exports functions that:
- Accept clean parameters
- Handle errors gracefully
- Return typed data
- Use range queries on `created_at` (never `DATE()`)

### Services Available

**`doctors.ts`**
- `getAllDoctors()` - All doctors
- `getActiveDoctors()` - Only active doctors
- `getDoctorById(id)` - Single doctor
- `createDoctor(data)` - Create new doctor
- `updateDoctor(id, data)` - Update doctor
- `deactivateDoctor(id)` - Soft delete

**`users.ts`**
- `getAllUsers()` - All users
- `getUserById(id)` - Single user
- `getUserByUsername(username)` - User lookup
- `createUser(data)` - Create with Auth via Admin API
- `updateUser(id, data)` - Update user
- `deactivateUser(id)` - Disable account

**`patients.ts`**
- `searchPatients(query)` - ilike search on code & name
- `getPatientById(id)` - Single patient
- `getPatientByCode(code)` - Lookup by clinic code
- `createPatient(data)` - New patient
- `getPatientTransactions(patientId)` - All payments
- `getPatientTransactionsByDoctor(patientId, doctorId)` - Filtered payments

**`transactions.ts`**
- `getTodayTransactions()` - Today's all transactions
- `getTransactionsByDateRange(from, to)` - Date range
- `getTransactionsByDoctor(doctorId, from, to)` - Doctor payments
- `getTransactionsByAssistant(assistantId, from, to)` - Assistant records
- `getPendingLabFees()` - Lab fees not yet paid
- `createPaymentIn(data)` - Record patient payment
- `createExpenseOut(data)` - Record expense
- `updateLabFees(transactionId, amount)` - Add missing lab fees
- `getDailyTotals(date)` - Aggregated daily summary
- `getMonthlyTotals(year, month)` - Monthly aggregates

**`monthlyClosings.ts`**
- `getClosingsByDoctor(doctorId)` - Doctor's closings
- `getClosingsForMonth(year, month)` - All closings for a month
- `getMonthlySummary(year, month)` - RPC call to summary data
- `upsertClosing(data)` - Insert or update closing
- `confirmClosing(id, adminId)` - Mark as confirmed
- `reopenClosing(id)` - Unconfirm for editing

## Pages Structure

### Assistant Routes
- `/assistant/today` - Daily transaction summary with cards & table
- `/assistant/add-payment` - Patient payment form with patient search
- `/assistant/add-expense` - Expense form
- `/assistant/history` - 30-day transaction history

### Doctor Routes
- `/doctor/dashboard` - Performance metrics & payments table
- `/doctor/patients` - Patient search & transaction history

### Admin Routes
- `/admin/dashboard` - Full financial view with filters & tables
- `/admin/doctors` - Doctor management (CRUD)
- `/admin/users` - User management (CRUD)
- `/admin/monthly-closing` - End-of-month settlements & confirmations

## Current Status

✅ **Phase 1: Foundation - COMPLETE**
- Supabase client setup
- Authentication context with username/password login
- Service layer for all database operations
- Protected routes & role-based access control
- Shared AppLayout with sidebar navigation
- Professional color theme (Blue primary, Amber accent)
- PWA setup (manifest.json + service worker)
- All placeholder pages created and routing configured

⏳ **Phase 2: Core Pages - READY FOR BUILD**
- Each role has placeholder pages ready
- Placeholder components show guidance text
- All routes are protected and accessible
- Navigation is fully functional

## Next Steps

To complete the app, continue prompting for:

1. **Assistant Pages** (highest priority)
   - Today view with summary cards & transaction table
   - Add Payment form with patient search & lab fees
   - Add Expense form
   - History view with filters

2. **Doctor Pages**
   - Dashboard with date filter & earnings cards
   - Payments table with sorting
   - Confirmed monthly closings section
   - Patients page with search & transaction details

3. **Admin Pages**
   - Dashboard with comprehensive filters & analytics
   - Doctor management forms
   - User management forms
   - Monthly closing with per-doctor cards and print/PDF export

## Theme & Styling

### Color Palette
- **Primary**: Blue (#0088CC) - Main brand color
- **Secondary**: Light Blue (#3399DD) - Accents
- **Accent**: Amber (#F8A000) - Call-to-action buttons
- **Background**: White (#FFFFFF)
- **Text**: Dark Gray (#1a1a1a)

### CSS Variables (Tailwind HSL format)
All colors use HSL format in `client/global.css`:
```css
--primary: 200 100% 41%;      /* Blue */
--secondary: 200 89% 57%;     /* Light Blue */
--accent: 45 93% 47%;         /* Amber */
--border: 210 11% 88%;        /* Light Gray */
--muted: 210 11% 89%;         /* Very Light Gray */
```

Use these with Tailwind classes:
```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Primary Button
</button>
```

## PWA Features

✅ **App Shell Caching** (`public/sw.js`)
- Service worker caches HTML, CSS on install
- Network-first for API calls
- Cache-first for static assets
- Graceful offline fallback

✅ **Manifest** (`public/manifest.json`)
- Name: "Iconic Finance"
- Short name: "Iconic"
- Display: standalone
- Installable on Android & iOS home screens

✅ **Icons**
- Auto-generated SVG icons in manifest
- Blue (#0088CC) brand color
- Supports maskable icons for dynamic island

## Database Connection

**Once you have your Supabase credentials:**

1. Create `.env` file in project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Restart dev server:
   ```bash
   pnpm dev
   ```

3. App will automatically connect and authentication will work

## Development Commands

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm typecheck

# Run tests
pnpm test

# Format code
pnpm format.fix
```

## Notes

- All routes are protected - unauthenticated users redirect to `/login`
- Authentication state is global via AuthContext - accessible throughout app
- Service layer handles all Supabase access - no direct queries from components
- Placeholder pages show helpful messages guiding next steps
- Modern, professional UI using Radix UI primitives + Tailwind
- Fully responsive design (works on desktop & mobile)
- TypeScript for type safety throughout
- Hot reload on file changes during development

## Support

For features not yet implemented, continue prompting with specific requirements and the page will be built. The foundation is complete and ready for rapid feature development.
