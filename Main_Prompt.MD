# Iconic Finance — Full Build Specification

---

## Overview

Build a complete, responsive **Progressive Web App (PWA)** called **Iconic Finance**. This is a clinic finance management system. The app name "Iconic Finance" must appear everywhere branding is shown: the browser tab title, the login screen, the sidebar, the top bar, and the PWA manifest. The app must work seamlessly on both desktop and mobile screens.

The tech stack is **React (Vite) + Tailwind CSS** on the frontend, and **Supabase** (Auth + PostgreSQL) as the backend. All Supabase queries are written in a dedicated service layer. There is no Row Level Security on the database — all access control is enforced through query-level filters in the service layer based on the logged-in user's role.

Do not hardcode any Supabase credentials. Create a `.env.example` file with two empty keys: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Initialize the Supabase client in `/src/lib/supabase.js` reading from `import.meta.env`. Once the build is complete, I will provide the credentials to connect to my database.

---

## PWA Setup

- Add a `manifest.json` with name "Iconic Finance", short_name "Iconic", `display: standalone`, and a theme color
- Add a service worker implementing the **app shell caching pattern** so the app is installable on Android and iOS home screens
- The app must be fully installable from the browser

---

## Authentication — Username + Password

Users do **not** log in with an email. They log in with a **Username** and **Password**. Under the hood, construct a synthetic email as `{username}@iconicfinance.app` and call `supabase.auth.signInWithPassword({ email, password })`. After a successful login, fetch the user's full profile from `public.users` where `id = auth.uid()` to get their `role`, `full_name`, `username`, `doctor_id`, and `is_active`. If `is_active = false`, sign them out immediately and show the message "Account disabled". Store the full user profile in a global auth context (React Context or Zustand) accessible throughout the app. All routes must be protected — unauthenticated users are redirected to the login screen.

After login, redirect based on role:
- `admin` → `/admin/dashboard`
- `doctor` → `/doctor/dashboard`
- `assistant` → `/assistant/today`

---

## Database Schema Reference

The following tables exist in Supabase. Use these exact table and column names in all queries. Never use `DATE(created_at)` in queries or indexes — always use range conditions on `created_at` like `created_at >= start AND created_at < end`.

**`doctors`**
`id`, `name`, `type` (enum: `primary` / `extern` / `custom`), `custom_percentage` (numeric, null unless type=custom), `custom_label` (text, null unless type=custom), `is_active` (boolean), `created_at`, `updated_at`

**`users`**
`id` (references auth.users), `username` (unique, used as login ID), `full_name`, `role` (enum: `admin` / `doctor` / `assistant`), `doctor_id` (nullable FK → doctors.id), `is_active` (boolean), `created_at`, `updated_at`

**`patients`**
`id`, `patient_code` (clinic-assigned ID, unique), `full_name`, `created_at`, `updated_at`

**`transactions`**
`id`, `type` (enum: `payment_in` / `expense_out`), `assistant_id` (FK → users.id), `assistant_name` (denormalized), `patient_id` (FK → patients.id, null for expense_out), `patient_name` (denormalized, null for expense_out), `doctor_id` (FK → doctors.id, null for expense_out), `payment_method` (enum: `cash` / `vodafone_cash` / `instapay`, null for expense_out), `base_amount` (numeric, null for expense_out), `final_amount` (numeric, always set — for vodafone_cash this is base×1.01, for all others equals base_amount, for expense_out equals the expense value), `has_lab_fees` (boolean, default false), `lab_fees_amount` (numeric, nullable), `lab_fees_pending` (boolean, auto-managed by DB trigger — true when has_lab_fees=true and lab_fees_amount is null), `doctor_earnings` (numeric, auto-calculated by DB trigger — 0 for primary doctors, 40% of net for extern, custom% of net for custom, where net = final_amount minus lab_fees_amount), `expense_description` (text, only for expense_out), `created_at`, `updated_at`

**`monthly_closings`**
`id`, `month` (1–12), `year`, `doctor_id` (FK → doctors.id), `total_revenue` (sum of final_amount for this doctor's payment_in for the month), `total_lab_fees` (sum of lab_fees_amount for this doctor for the month), `doctor_gross_earnings` (sum of doctor_earnings for this doctor for the month — 0 for primary), `clinic_remaining_share` (for primary doctors: their share of the clinic remainder after expenses and extern/custom cuts — equal split among all active primary doctors), `amount_to_pay` (admin-decided payout, editable until confirmed), `comment` (nullable text), `is_confirmed` (boolean), `confirmed_by` (FK → users.id, nullable), `confirmed_at` (timestamptz, nullable), `created_at`, `updated_at`

---

## Service Layer — `/src/services/`

Build one file per domain. These functions are the only way the app communicates with Supabase.

**`doctors.js`**: `getAllDoctors()`, `getActiveDoctors()` (is_active=true only), `getDoctorById(id)`, `createDoctor(data)`, `updateDoctor(id, data)`, `deactivateDoctor(id)` (sets is_active=false)

**`users.js`**: `getAllUsers()`, `getUserById(id)`, `getUserByUsername(username)`, `createUser(data)` — creates a Supabase Auth user via the Admin API with synthetic email `{username}@iconicfinance.app` and passes `full_name`, `username`, `role`, `doctor_id` in `raw_user_meta_data`; the DB trigger auto-inserts the row into `public.users`, `updateUser(id, data)`, `deactivateUser(id)` (sets is_active=false)

**`patients.js`**: `searchPatients(query)` — ilike search on both `patient_code` and `full_name`, `getPatientById(id)`, `getPatientByCode(code)`, `createPatient({ patient_code, full_name })`, `getPatientTransactions(patientId)` — all payment_in for this patient, `getPatientTransactionsByDoctor(patientId, doctorId)`

**`transactions.js`**: `getTodayTransactions()` — created_at >= today 00:00 AND < tomorrow 00:00, `getTransactionsByDateRange(from, to)`, `getTransactionsByDoctor(doctorId, from, to)` — payment_in only, `getTransactionsByAssistant(assistantId, from, to)`, `getPendingLabFees()` — payment_in where lab_fees_pending=true, `createPaymentIn(data)`, `createExpenseOut(data)`, `updateLabFees(transactionId, labFeesAmount)` — updates lab_fees_amount and the DB trigger auto-recalculates lab_fees_pending and doctor_earnings, `getDailyTotals(date)` — returns sum of final_amount grouped by payment_method for payment_in on that day, plus sum of expense_out, `getMonthlyTotals(year, month)` — aggregated totals for the admin dashboard

**`monthlyClosings.js`**: `getClosingsByDoctor(doctorId)` — all closings for a doctor sorted by year/month desc, `getClosingsForMonth(year, month)` — all doctor closings for a given month, `getMonthlySummary(year, month)` — calls Supabase RPC `get_monthly_closing_summary(year, month)` which returns per-doctor stats and the clinic remainder split, `upsertClosing(data)` — insert or update, `confirmClosing(id, confirmedByUserId)` — sets is_confirmed=true and confirmed_by, `reopenClosing(id)` — sets is_confirmed=false (DB trigger clears confirmed_at and confirmed_by automatically)

---

## Shared App Layout

All authenticated pages share a common layout with a **sidebar** (collapsible on mobile) and a **top bar**. The sidebar shows only the navigation links relevant to the logged-in role. The top bar shows "Iconic Finance" and the logged-in user's full name. A logout button is always visible.

---

## Role: Assistant

Assistants can only record transactions (both payment_in and expense_out) and view a read-only history. They cannot edit, delete, or access any dashboard or earnings data.

### Page: `/assistant/today`
This is the assistant's home page. It shows everything for the current day.

At the top, display three summary cards showing totals for today across all assistants (not just the logged-in one):
- **Cash** — sum of final_amount for payment_in with method=cash today
- **Vodafone Cash** — sum of final_amount for payment_in with method=vodafone_cash today (this total already includes the 1% markup — show it as-is)
- **Instapay** — sum of final_amount for payment_in with method=instapay today

Below the cards show a table of all today's transactions (both payment_in and expense_out) with columns: Time, Type (Payment In / Expense Out), Patient Name (if payment_in), Doctor (if payment_in), Method, Amount, Lab Fees Status. Rows where `lab_fees_pending = true` must be visually highlighted with an amber/yellow background and a warning icon to indicate that lab fees are missing for that entry.

At the bottom of the page (or as a floating button bar on mobile) show two action buttons:
- **+ Add Payment** — navigates to `/assistant/add-payment`
- **+ Add Expense** — navigates to `/assistant/add-expense`

### Page: `/assistant/history`
A read-only table showing all transactions from the last 30 days. Columns: Date, Type, Patient Name, Patient Code, Doctor, Method, Amount, Lab Fees, Expense Description. Rows with lab_fees_pending=true show a warning indicator. There is a search bar at the top to filter by patient name or patient code. No editing or deleting is allowed from this page.

### Page: `/assistant/add-payment` — New Patient Payment (Money In)
This form is used when a patient pays after a clinic visit. Fields in order:

1. **Patient Search** — a search input that calls `searchPatients(query)` as the assistant types and shows results in a dropdown list. Each result shows patient_code + full_name. Selecting a result fills `patient_id` and `patient_name`. If no result is found, show a "Create new patient" option in the dropdown.
2. **Create New Patient** (shown only when creating new) — two fields appear: Patient Full Name and Patient Code (clinic-assigned ID like "P-0042"). These are used to call `createPatient()` on submit.
3. **Select Doctor** — dropdown populated from `getActiveDoctors()`, showing doctor name and type.
4. **Payment Method** — select one of: Cash / Vodafone Cash / Instapay.
5. **Lab Fees Checkbox** — labeled "Lab fees included?". If checked, reveal a numeric input field for the lab fees amount. This field is optional at this stage — the assistant can leave it blank and the admin can fill it in later. If left blank after checking, the entry saves with `lab_fees_pending = true` and the row will show a warning in the table.
6. **Total Amount to Be Paid** — numeric input (this is the `base_amount`). If Vodafone Cash is selected, show a live-calculated line below the field: "Total + 1% = [computed value]" and store the computed value as `final_amount`. For all other methods, `final_amount = base_amount`.
7. **Confirm** button — on submit: create the patient first if new, then insert a `payment_in` transaction. `assistant_id` and `assistant_name` are pulled from the logged-in session automatically. `created_at` is set by the database at the moment of insert.

### Page: `/assistant/add-expense` — New Expense (Money Out)
A simple form with:
1. **Expense Description** — text input, required. Free text describing what the expense was for.
2. **Payment Method** — select: Cash / Vodafone Cash / Instapay.
3. **Amount** — numeric input. Stored as both `base_amount` and `final_amount` (no markup for expenses).
4. **Confirm** button — inserts a transaction with `type = expense_out`.

---

## Role: Doctor

Doctors can only view their own data. They cannot create, edit, or delete anything.

### Page: `/doctor/dashboard`
At the top show a filter bar with a **month + year picker** (defaults to the current month) and an option to switch to a custom date range. All filters use range queries on `created_at` — never DATE().

Below the filter bar show four summary cards for the selected period, based only on this doctor's `payment_in` transactions:
- **Cash** — sum of final_amount where method=cash
- **Vodafone Cash** — show the amount after removing the 1% Vodafone fee: display value = `SUM(final_amount) / 1.01` rounded to 2 decimals. Label this clearly as "Net received (after Vodafone fee)"
- **Instapay** — sum of final_amount where method=instapay
- **Total Earnings** — sum of `doctor_earnings` for the period (this is what the doctor actually earns after lab fee deductions and percentage cuts have been applied by the DB trigger)

Below the cards show a **payments table** for the selected period showing only this doctor's payment_in transactions. Columns: Date/Time, Patient Name, Patient Code, Payment Method, Base Amount, Final Amount, Lab Fees Amount, Doctor Earnings. Rows with lab_fees_pending=true show a warning icon. The table is sortable by date.

At the bottom of the dashboard show a read-only **Confirmed Monthly Closings** section listing all confirmed monthly_closings for this doctor, sorted by most recent first. Columns: Month/Year, Total Cases, Total Revenue, Lab Fees, Gross Earnings, Amount Paid, Admin Comment. Each row shows a green "Confirmed" badge with the confirmation date.

### Page: `/doctor/patients`
A patient search page. Shows a search bar where the doctor can type a patient name or patient code. Results call `getPatientTransactionsByDoctor(patientId, doctorId)`. On selecting a patient from the results, display a table of all payment_in transactions for that patient that belong to this doctor. Columns: Date, Method, Amount, Lab Fees, Doctor Earnings.

---

## Role: Admin

Admin has full access to all data, all doctors, all users, all transactions, and all monthly closings.

### Page: `/admin/dashboard`
At the top show a filter bar with: date range picker, doctor selector (all or a specific doctor), payment method selector.

Show summary cards (all responding to the active filters):
- Total Revenue (sum of all payment_in final_amounts)
- Total Expenses (sum of all expense_out final_amounts)
- Net Clinic Income (revenue − expenses)
- Cash total, Vodafone Cash total, Instapay total (payment_in only)
- Total Lab Fees Collected

Below the cards show a full transactions table with all columns visible: Date, Type, Patient Name, Patient Code, Doctor, Method, Base Amount, Final Amount, Lab Fees, Doctor Earnings, Expense Description. Rows where `lab_fees_pending = true` are highlighted in amber. Clicking such a row opens a modal where the admin can enter the missing `lab_fees_amount`. On save, call `updateLabFees(transactionId, amount)` — the DB trigger automatically recalculates `lab_fees_pending` (sets it to false) and recalculates `doctor_earnings`. The table is sortable and filterable.

### Page: `/admin/doctors`
A management page for doctor profiles. Shows a table of all doctors with their name, type, custom percentage/label (if applicable), and active status. From this page the admin can:
- Add a new doctor — form with: name, type selector, custom_percentage (shown only if type=custom), custom_label (shown only if type=custom)
- Edit an existing doctor
- Deactivate or reactivate a doctor (toggle is_active)

### Page: `/admin/users`
A management page for all user accounts. Shows a table with: username, full_name, role, linked doctor name (if role=doctor), active status. From this page the admin can:
- **Create a new user** — form fields: Username (this is their login ID), Full Name, Password, Role (admin/doctor/assistant). If role=doctor, show a dropdown to select and link a doctor profile from the doctors table. On submit, call `createUser()` which uses the Supabase Admin API to create the auth user with synthetic email `{username}@iconicfinance.app` and passes `full_name`, `username`, `role`, and `doctor_id` in `raw_user_meta_data`. The database trigger `handle_new_auth_user` auto-inserts the row into `public.users`.
- **Edit a user** — can change full_name, role, and linked doctor
- **Deactivate / reactivate** a user (toggle is_active) — a deactivated user cannot log in

### Page: `/admin/monthly-closing`
This is the core end-of-month financial confirmation feature.

At the top show a **month and year picker**. When the admin selects a month and year, the page loads data by calling `getMonthlySummary(year, month)` (Supabase RPC) to get live-calculated stats for each doctor active that month.

Show a **clinic-wide summary section** at the top with read-only cards:
- Total Revenue for the month (all payment_in)
- Total Expenses for the month (all expense_out)
- Total earnings owed to extern + custom doctors (sum of their doctor_earnings)
- Clinic Remaining (revenue − expenses − extern/custom earnings)
- Primary Doctor Equal Share (clinic remaining ÷ number of active primary doctors)

Below that show a **per-doctor section** — one card per doctor who had activity that month. Each card shows:
- Doctor name and type (Primary / Extern / Custom)
- Number of cases that month
- Total revenue attributed to that doctor (sum of their payment_in final_amounts)
- Total lab fees for that doctor
- Gross earnings: for extern/custom this is their doctor_earnings sum; for primary doctors this is their `clinic_remaining_share` (the equal split computed by the RPC)
- **Amount to Pay** — an editable numeric input pre-filled with the gross earnings value above but the admin can override it
- **Comment** — an optional text field for notes about this closing
- **Confirm button** — calls `confirmClosing(id, adminUserId)`, sets is_confirmed=true, records confirmed_by and confirmed_at. Once confirmed: the card shows a green "Confirmed" badge with the date and confirming admin's name; Amount to Pay and Comment become read-only and locked. The doctor can now see this confirmed record in their own dashboard.
- **Re-open button** (visible only on confirmed cards) — calls `reopenClosing(id)` which sets is_confirmed=false and the DB trigger clears confirmed_at and confirmed_by automatically, unlocking the card for editing again.

**PDF / Print view per doctor:**
Each doctor card has a **"Print / Export PDF"** button. Clicking it opens a clean print-ready view (either a new browser tab or using `window.print()` with a print stylesheet that hides all navigation). This view contains:
- "Iconic Finance" as a header with the month and year
- Doctor name, type, and the selected month/year
- A full table of all that doctor's payment_in transactions for the month: Date, Patient Name, Patient Code, Payment Method, Base Amount, Final Amount, Lab Fees, Doctor Earnings
- A summary block at the bottom: Total Cases, Total Revenue, Total Lab Fees Deducted, Gross Earnings, Amount to Pay, Admin Comment
- If confirmed: Confirmation date and confirming admin's name
- The layout must be clean, white background, no sidebar, no navigation, suitable for printing or saving as PDF from the browser

---

## Payment Method Display Rules

Always display payment methods with these exact labels throughout the entire app:
- `cash` → **Cash**
- `vodafone_cash` → **Vodafone Cash**
- `instapay` → **Instapay**

---

## Doctor Earnings Logic (for reference — implemented in DB triggers)

The DB triggers handle this automatically, but the frontend must understand the logic for display:
- For `payment_in` transactions, the DB computes `doctor_earnings` as follows: deductible = lab_fees_amount if has_lab_fees=true and lab_fees_amount is not null, else 0. Net = final_amount − deductible (minimum 0). Primary doctors: earnings = 0 stored (their real payout is the monthly clinic share). Extern doctors: earnings = net × 0.40. Custom doctors: earnings = net × (custom_percentage / 100).
- For `expense_out` transactions: doctor_earnings = 0, lab_fees_pending = false always.
- When admin adds missing lab fees via `updateLabFees()`, the DB trigger automatically recalculates doctor_earnings and sets lab_fees_pending=false. No frontend calculation needed.

---

## Final Step — Connect to My Supabase Database

Once the full app is built with all pages, services, and routing complete, do not connect it to any database yet. At that point, ask me for the following two values and I will provide them:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Place them in `.env` and the app will connect to my already-configured Supabase project.