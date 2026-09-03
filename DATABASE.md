Here is the full Query that was used to build the DB : 

-- ============================================================
-- ICONIC FINANCE — FULL SUPABASE DATABASE SCHEMA
-- ============================================================
-- Run this entire file in the Supabase SQL Editor.
-- Order matters — do not reorder sections.
-- ============================================================


-- ============================================================
-- SECTION 1 — EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- SECTION 2 — ENUM TYPES
-- ============================================================

CREATE TYPE doctor_type         AS ENUM ('primary', 'extern', 'custom');
CREATE TYPE user_role           AS ENUM ('admin', 'doctor', 'assistant');
CREATE TYPE transaction_type    AS ENUM ('payment_in', 'expense_out');
CREATE TYPE payment_method_type AS ENUM ('cash', 'vodafone_cash', 'instapay');


-- ============================================================
-- SECTION 3 — TABLES
-- ============================================================

-- ----------------------------------------------------------
-- 3.1  doctors
-- ----------------------------------------------------------
CREATE TABLE public.doctors (
    id                 UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    name               TEXT            NOT NULL,
    type               doctor_type     NOT NULL,
    -- custom_percentage must be set when type='custom', null otherwise
    custom_percentage  NUMERIC(5, 2)   DEFAULT NULL
        CHECK (
            (type = 'custom'  AND custom_percentage IS NOT NULL
                              AND custom_percentage >= 0
                              AND custom_percentage <= 100)
            OR
            (type <> 'custom' AND custom_percentage IS NULL)
        ),
    -- custom_label is only meaningful for type='custom'
    custom_label       TEXT            DEFAULT NULL,
    is_active          BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.doctors IS 'Clinic doctor profiles. type drives earnings calculation in triggers.';
COMMENT ON COLUMN public.doctors.custom_percentage IS 'Only set when type=custom. Percentage of net amount paid to the doctor.';
COMMENT ON COLUMN public.doctors.custom_label IS 'Optional display label for custom doctor arrangements.';


-- ----------------------------------------------------------
-- 3.2  users  (mirrors auth.users — synced via trigger)
-- ----------------------------------------------------------
CREATE TABLE public.users (
    id          UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    username    TEXT        UNIQUE NOT NULL,
    full_name   TEXT        NOT NULL,
    role        user_role   NOT NULL,
    doctor_id   UUID        REFERENCES public.doctors (id) ON DELETE SET NULL DEFAULT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.users IS 'App user profiles. id is shared with auth.users. Rows are auto-created by handle_new_auth_user trigger.';
COMMENT ON COLUMN public.users.username IS 'Used as the login identifier. Synthetic email {username}@iconicfinance.app is used in auth.users.';
COMMENT ON COLUMN public.users.doctor_id IS 'Only set when role=doctor. Links the user to their doctor profile.';


-- ----------------------------------------------------------
-- 3.3  patients
-- ----------------------------------------------------------
CREATE TABLE public.patients (
    id            UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_code  TEXT  UNIQUE NOT NULL,
    full_name     TEXT  NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.patients IS 'Clinic patient registry.';
COMMENT ON COLUMN public.patients.patient_code IS 'Clinic-assigned unique code, e.g. P-0042.';


-- ----------------------------------------------------------
-- 3.4  transactions
-- ----------------------------------------------------------
CREATE TABLE public.transactions (
    id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    type                transaction_type    NOT NULL,

    -- Who recorded this entry
    assistant_id        UUID                NOT NULL REFERENCES public.users (id),
    assistant_name      TEXT                NOT NULL,

    -- Patient info — only for payment_in
    patient_id          UUID                REFERENCES public.patients (id) ON DELETE SET NULL DEFAULT NULL,
    patient_name        TEXT                DEFAULT NULL,

    -- Doctor info — only for payment_in
    doctor_id           UUID                REFERENCES public.doctors (id) ON DELETE SET NULL DEFAULT NULL,

    -- Payment details
    payment_method      payment_method_type DEFAULT NULL,
    base_amount         NUMERIC(12, 2)      DEFAULT NULL,
    -- final_amount: for vodafone_cash = base × 1.01 (computed by frontend before insert)
    -- for all other payment_in = base_amount; for expense_out = expense value
    final_amount        NUMERIC(12, 2)      NOT NULL,

    -- Lab fees
    has_lab_fees        BOOLEAN             NOT NULL DEFAULT FALSE,
    lab_fees_amount     NUMERIC(12, 2)      DEFAULT NULL,
    -- Auto-managed by trigger: TRUE when has_lab_fees=TRUE and lab_fees_amount IS NULL
    lab_fees_pending    BOOLEAN             NOT NULL DEFAULT FALSE,

    -- Auto-calculated by trigger based on doctor type and net amount
    doctor_earnings     NUMERIC(12, 2)      NOT NULL DEFAULT 0,

    -- Only for expense_out
    expense_description TEXT                DEFAULT NULL,

    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    -- Referential integrity per type
    CONSTRAINT chk_payment_in_required_fields CHECK (
        type <> 'payment_in'
        OR (
            patient_id     IS NOT NULL AND
            doctor_id      IS NOT NULL AND
            payment_method IS NOT NULL AND
            base_amount    IS NOT NULL
        )
    ),
    CONSTRAINT chk_expense_out_required_fields CHECK (
        type <> 'expense_out'
        OR (
            expense_description IS NOT NULL AND
            patient_id          IS NULL     AND
            doctor_id           IS NULL
        )
    ),
    CONSTRAINT chk_final_amount_positive CHECK (final_amount >= 0),
    CONSTRAINT chk_base_amount_positive  CHECK (base_amount IS NULL OR base_amount >= 0),
    CONSTRAINT chk_lab_fees_positive     CHECK (lab_fees_amount IS NULL OR lab_fees_amount >= 0)
);

COMMENT ON TABLE  public.transactions IS 'All financial entries: patient payments (payment_in) and clinic expenses (expense_out).';
COMMENT ON COLUMN public.transactions.final_amount   IS 'Stored value after any surcharge. Frontend computes vodafone_cash as base×1.01.';
COMMENT ON COLUMN public.transactions.lab_fees_pending IS 'Auto-set by trigger. TRUE when has_lab_fees=TRUE but lab_fees_amount is still NULL.';
COMMENT ON COLUMN public.transactions.doctor_earnings IS 'Auto-calculated by trigger: 0 for primary, 40% net for extern, custom% net for custom.';


-- ----------------------------------------------------------
-- 3.5  monthly_closings
-- ----------------------------------------------------------
CREATE TABLE public.monthly_closings (
    id                     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    month                  INTEGER      NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                   INTEGER      NOT NULL CHECK (year >= 2000),
    doctor_id              UUID         NOT NULL REFERENCES public.doctors (id) ON DELETE RESTRICT,

    -- Aggregated from transactions for this doctor + month (populated when admin creates/upserts)
    total_revenue          NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_lab_fees         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    -- For extern/custom: sum of doctor_earnings. For primary: their share of clinic_remaining.
    doctor_gross_earnings  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    -- Only meaningful for primary doctors: equal share of clinic remainder
    clinic_remaining_share NUMERIC(12, 2) DEFAULT NULL,

    -- Admin-editable payout fields
    amount_to_pay          NUMERIC(12, 2) DEFAULT NULL,
    comment                TEXT           DEFAULT NULL,

    -- Confirmation workflow
    is_confirmed           BOOLEAN        NOT NULL DEFAULT FALSE,
    confirmed_by           UUID           REFERENCES public.users (id) ON DELETE SET NULL DEFAULT NULL,
    confirmed_at           TIMESTAMPTZ    DEFAULT NULL,

    created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    -- One closing record per doctor per calendar month
    UNIQUE (month, year, doctor_id)
);

COMMENT ON TABLE  public.monthly_closings IS 'End-of-month payout records per doctor. Confirmed records are visible to the doctor.';
COMMENT ON COLUMN public.monthly_closings.doctor_gross_earnings IS 'For extern/custom: sum of transaction doctor_earnings. For primary: clinic_remaining ÷ active primary count.';
COMMENT ON COLUMN public.monthly_closings.amount_to_pay IS 'Admin override of gross earnings. Editable until confirmed.';
COMMENT ON COLUMN public.monthly_closings.confirmed_at IS 'Set automatically by trigger when is_confirmed flips to TRUE.';
COMMENT ON COLUMN public.monthly_closings.confirmed_by IS 'Cleared automatically by trigger when is_confirmed flips to FALSE.';


-- ============================================================
-- SECTION 4 — INDEXES
-- ============================================================

-- transactions — range queries never use DATE(), only created_at ranges
CREATE INDEX idx_transactions_created_at       ON public.transactions (created_at);
CREATE INDEX idx_transactions_type_created     ON public.transactions (type, created_at);
CREATE INDEX idx_transactions_doctor_created   ON public.transactions (doctor_id, created_at);
CREATE INDEX idx_transactions_assistant_id     ON public.transactions (assistant_id);
CREATE INDEX idx_transactions_patient_id       ON public.transactions (patient_id);
CREATE INDEX idx_transactions_payment_method   ON public.transactions (payment_method);
-- Partial index for pending lab fees — used by getPendingLabFees()
CREATE INDEX idx_transactions_lab_pending      ON public.transactions (created_at)
    WHERE lab_fees_pending = TRUE;

-- monthly_closings
CREATE INDEX idx_closings_doctor_id            ON public.monthly_closings (doctor_id);
CREATE INDEX idx_closings_year_month           ON public.monthly_closings (year, month);
CREATE INDEX idx_closings_confirmed            ON public.monthly_closings (is_confirmed);

-- patients
CREATE INDEX idx_patients_full_name_trgm       ON public.patients USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_patients_patient_code         ON public.patients (patient_code);

-- users
CREATE INDEX idx_users_role                    ON public.users (role);
CREATE INDEX idx_users_doctor_id               ON public.users (doctor_id);
CREATE INDEX idx_users_is_active               ON public.users (is_active);


-- ============================================================
-- SECTION 5 — TRIGRAM EXTENSION (for patient ilike search)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ============================================================
-- SECTION 6 — SHARED updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_doctors_updated_at
    BEFORE UPDATE ON public.doctors
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_monthly_closings_updated_at
    BEFORE UPDATE ON public.monthly_closings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- SECTION 7 — AUTH USER SYNC TRIGGER
-- Auto-inserts a public.users row whenever the Admin API creates
-- a new auth.users row with the required raw_user_meta_data keys:
--   username, full_name, role, doctor_id (optional)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username   TEXT;
    v_full_name  TEXT;
    v_role       user_role;
    v_doctor_id  UUID;
BEGIN
    v_username  := NEW.raw_user_meta_data ->> 'username';
    v_full_name := NEW.raw_user_meta_data ->> 'full_name';
    v_role      := (NEW.raw_user_meta_data ->> 'role')::user_role;

    -- doctor_id is optional; guard against empty string from JSON
    v_doctor_id := NULLIF(TRIM(NEW.raw_user_meta_data ->> 'doctor_id'), '')::UUID;

    -- Only insert if the required metadata is present
    IF v_username IS NOT NULL AND v_full_name IS NOT NULL AND v_role IS NOT NULL THEN
        INSERT INTO public.users (id, username, full_name, role, doctor_id, is_active)
        VALUES (NEW.id, v_username, v_full_name, v_role, v_doctor_id, TRUE)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach to auth.users (Supabase internal schema)
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ============================================================
-- SECTION 8 — TRANSACTION CALCULATIONS TRIGGER
-- Fires BEFORE INSERT OR UPDATE on transactions.
-- Manages:
--   • lab_fees_pending  — TRUE when has_lab_fees=TRUE and lab_fees_amount IS NULL
--   • doctor_earnings   — based on doctor type and net amount after lab fee deduction
-- The frontend never needs to calculate these values.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_transaction_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_doctor      public.doctors%ROWTYPE;
    v_deductible  NUMERIC(12, 2);
    v_net         NUMERIC(12, 2);
BEGIN
    -- -------------------------------------------------------
    -- expense_out: zero all earnings/lab fields unconditionally
    -- -------------------------------------------------------
    IF NEW.type = 'expense_out' THEN
        NEW.doctor_earnings  := 0;
        NEW.lab_fees_pending := FALSE;
        NEW.has_lab_fees     := FALSE;
        NEW.lab_fees_amount  := NULL;
        NEW.doctor_id        := NULL;
        NEW.patient_id       := NULL;
        NEW.patient_name     := NULL;
        NEW.payment_method   := NEW.payment_method; -- keep as-is (allowed for expense tracking)
        RETURN NEW;
    END IF;

    -- -------------------------------------------------------
    -- payment_in: manage lab_fees_pending
    -- pending = true only when fees are expected but not yet entered
    -- -------------------------------------------------------
    IF NEW.has_lab_fees = TRUE
       AND (NEW.lab_fees_amount IS NULL OR NEW.lab_fees_amount <= 0)
    THEN
        NEW.lab_fees_pending := TRUE;
    ELSE
        NEW.lab_fees_pending := FALSE;
    END IF;

    -- -------------------------------------------------------
    -- payment_in: calculate doctor_earnings
    -- -------------------------------------------------------
    IF NEW.doctor_id IS NULL THEN
        NEW.doctor_earnings := 0;
        RETURN NEW;
    END IF;

    SELECT * INTO v_doctor
    FROM public.doctors
    WHERE id = NEW.doctor_id;

    IF NOT FOUND THEN
        NEW.doctor_earnings := 0;
        RETURN NEW;
    END IF;

    -- Net = final_amount minus lab fees (if entered), floored at 0
    IF NEW.has_lab_fees = TRUE
       AND NEW.lab_fees_amount IS NOT NULL
       AND NEW.lab_fees_amount > 0
    THEN
        v_deductible := NEW.lab_fees_amount;
    ELSE
        v_deductible := 0;
    END IF;

    v_net := GREATEST(0, NEW.final_amount - v_deductible);

    CASE v_doctor.type
        WHEN 'primary' THEN
            -- Primary doctors earn nothing per-transaction.
            -- Their real payout is calculated monthly from the clinic remainder.
            NEW.doctor_earnings := 0;

        WHEN 'extern' THEN
            NEW.doctor_earnings := ROUND(v_net * 0.40, 2);

        WHEN 'custom' THEN
            NEW.doctor_earnings := ROUND(
                v_net * (COALESCE(v_doctor.custom_percentage, 0) / 100.0),
                2
            );

        ELSE
            NEW.doctor_earnings := 0;
    END CASE;

    RETURN NEW;
END;
$$;

-- Must be BEFORE so we can modify NEW
CREATE TRIGGER trg_transaction_calculations
    BEFORE INSERT OR UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.calculate_transaction_fields();


-- ============================================================
-- SECTION 9 — MONTHLY CLOSING LIFECYCLE TRIGGERS
-- ============================================================

-- ----------------------------------------------------------
-- 9.1  Stamp confirmed_at when is_confirmed flips TRUE
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_closing_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (OLD.is_confirmed IS DISTINCT FROM TRUE) AND NEW.is_confirmed = TRUE THEN
        NEW.confirmed_at := NOW();
        -- confirmed_by must be set by the caller (service layer passes it)
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_closing_confirm
    BEFORE UPDATE ON public.monthly_closings
    FOR EACH ROW EXECUTE FUNCTION public.handle_closing_confirm();


-- ----------------------------------------------------------
-- 9.2  Clear confirmed_at / confirmed_by when re-opened
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_closing_reopen()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_confirmed = TRUE AND NEW.is_confirmed = FALSE THEN
        NEW.confirmed_at := NULL;
        NEW.confirmed_by := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_closing_reopen
    BEFORE UPDATE ON public.monthly_closings
    FOR EACH ROW EXECUTE FUNCTION public.handle_closing_reopen();


-- ============================================================
-- SECTION 10 — RPC: get_monthly_closing_summary(year, month)
-- Called by the Admin monthly-closing page.
-- Returns one row per doctor who had payment_in activity
-- in the given month, plus clinic-wide aggregate columns
-- on every row for convenience.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_monthly_closing_summary(
    p_year  INTEGER,
    p_month INTEGER
)
RETURNS TABLE (
    -- Per-doctor fields
    doctor_id               UUID,
    doctor_name             TEXT,
    doctor_type             doctor_type,
    custom_percentage       NUMERIC,
    custom_label            TEXT,
    case_count              BIGINT,
    total_revenue           NUMERIC,
    total_lab_fees          NUMERIC,
    doctor_gross_earnings   NUMERIC,   -- actual take-home (share for primary, sum for others)

    -- Clinic-wide fields (same on every row — denormalised for frontend convenience)
    clinic_total_revenue        NUMERIC,
    clinic_total_expenses       NUMERIC,
    clinic_extern_custom_cut    NUMERIC,   -- total owed to extern + custom doctors
    clinic_remaining            NUMERIC,   -- after expenses and extern/custom cuts
    primary_doctor_count        BIGINT,    -- how many primary doctors had cases this month
    primary_doctor_share        NUMERIC    -- clinic_remaining ÷ primary_doctor_count
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_range_start           TIMESTAMPTZ;
    v_range_end             TIMESTAMPTZ;
    v_clinic_revenue        NUMERIC(14, 4);
    v_clinic_expenses       NUMERIC(14, 4);
    v_extern_custom_cut     NUMERIC(14, 4);
    v_clinic_remaining      NUMERIC(14, 4);
    v_primary_count         BIGINT;
    v_primary_share         NUMERIC(14, 4);
BEGIN
    -- Build month boundaries (no DATE() usage — spec requirement)
    v_range_start := DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1))::TIMESTAMPTZ AT TIME ZONE 'UTC';
    v_range_end   := v_range_start + INTERVAL '1 month';

    -- -------------------------------------------------------
    -- Clinic-wide revenue (all payment_in)
    -- -------------------------------------------------------
    SELECT COALESCE(SUM(t.final_amount), 0)
    INTO   v_clinic_revenue
    FROM   public.transactions t
    WHERE  t.type        = 'payment_in'
      AND  t.created_at >= v_range_start
      AND  t.created_at  < v_range_end;

    -- -------------------------------------------------------
    -- Clinic-wide expenses (all expense_out)
    -- -------------------------------------------------------
    SELECT COALESCE(SUM(t.final_amount), 0)
    INTO   v_clinic_expenses
    FROM   public.transactions t
    WHERE  t.type        = 'expense_out'
      AND  t.created_at >= v_range_start
      AND  t.created_at  < v_range_end;

    -- -------------------------------------------------------
    -- Total earnings already owed to extern + custom doctors
    -- (pre-calculated per-transaction by the trigger)
    -- -------------------------------------------------------
    SELECT COALESCE(SUM(t.doctor_earnings), 0)
    INTO   v_extern_custom_cut
    FROM   public.transactions t
    JOIN   public.doctors      d ON d.id = t.doctor_id
    WHERE  t.type         = 'payment_in'
      AND  t.created_at  >= v_range_start
      AND  t.created_at   < v_range_end
      AND  d.type         IN ('extern', 'custom');

    -- -------------------------------------------------------
    -- Clinic remainder after expenses + extern/custom payouts
    -- -------------------------------------------------------
    v_clinic_remaining := GREATEST(0, v_clinic_revenue - v_clinic_expenses - v_extern_custom_cut);

    -- -------------------------------------------------------
    -- Count primary doctors with activity this month
    -- -------------------------------------------------------
    SELECT COUNT(DISTINCT t.doctor_id)
    INTO   v_primary_count
    FROM   public.transactions t
    JOIN   public.doctors      d ON d.id = t.doctor_id
    WHERE  t.type         = 'payment_in'
      AND  t.created_at  >= v_range_start
      AND  t.created_at   < v_range_end
      AND  d.type         = 'primary'
      AND  d.is_active    = TRUE;

    IF v_primary_count > 0 THEN
        v_primary_share := ROUND(v_clinic_remaining / v_primary_count, 2);
    ELSE
        v_primary_share := 0;
    END IF;

    -- -------------------------------------------------------
    -- Per-doctor results
    -- -------------------------------------------------------
    RETURN QUERY
    SELECT
        d.id                                            AS doctor_id,
        d.name                                          AS doctor_name,
        d.type                                          AS doctor_type,
        d.custom_percentage,
        d.custom_label,
        COUNT(t.id)                                     AS case_count,
        ROUND(COALESCE(SUM(t.final_amount),    0), 2)  AS total_revenue,
        ROUND(COALESCE(SUM(t.lab_fees_amount), 0), 2)  AS total_lab_fees,

        -- Gross earnings: primary gets equal share of remainder; others get their trigger-sum
        CASE
            WHEN d.type = 'primary'
            THEN v_primary_share
            ELSE ROUND(COALESCE(SUM(t.doctor_earnings), 0), 2)
        END                                             AS doctor_gross_earnings,

        -- Clinic-wide columns (same on every row)
        ROUND(v_clinic_revenue,    2)                  AS clinic_total_revenue,
        ROUND(v_clinic_expenses,   2)                  AS clinic_total_expenses,
        ROUND(v_extern_custom_cut, 2)                  AS clinic_extern_custom_cut,
        ROUND(v_clinic_remaining,  2)                  AS clinic_remaining,
        v_primary_count                                AS primary_doctor_count,
        ROUND(v_primary_share,     2)                  AS primary_doctor_share

    FROM   public.transactions t
    JOIN   public.doctors      d ON d.id = t.doctor_id
    WHERE  t.type         = 'payment_in'
      AND  t.created_at  >= v_range_start
      AND  t.created_at   < v_range_end
    GROUP BY d.id, d.name, d.type, d.custom_percentage, d.custom_label
    ORDER BY d.name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_monthly_closing_summary IS
    'Returns per-doctor monthly stats and clinic-wide aggregates for the Admin monthly-closing page. Uses range conditions on created_at — never DATE().';


-- ============================================================
-- SECTION 11 — HELPER RPC: get_daily_totals(date)
-- Used by the assistant Today page and admin dashboard.
-- Returns totals grouped by payment method + expense total.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_daily_totals(p_date DATE)
RETURNS TABLE (
    cash_total           NUMERIC,
    vodafone_cash_total  NUMERIC,
    instapay_total       NUMERIC,
    expense_total        NUMERIC,
    payment_in_count     BIGINT,
    expense_out_count    BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_day_start  TIMESTAMPTZ;
    v_day_end    TIMESTAMPTZ;
BEGIN
    v_day_start := p_date::TIMESTAMPTZ AT TIME ZONE 'UTC';
    v_day_end   := v_day_start + INTERVAL '1 day';

    RETURN QUERY
    SELECT
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in' AND payment_method = 'cash'          THEN final_amount END), 0), 2),
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in' AND payment_method = 'vodafone_cash' THEN final_amount END), 0), 2),
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in' AND payment_method = 'instapay'      THEN final_amount END), 0), 2),
        ROUND(COALESCE(SUM(CASE WHEN type = 'expense_out'                                     THEN final_amount END), 0), 2),
        COUNT(CASE WHEN type = 'payment_in'  THEN 1 END),
        COUNT(CASE WHEN type = 'expense_out' THEN 1 END)
    FROM public.transactions
    WHERE created_at >= v_day_start
      AND created_at  < v_day_end;
END;
$$;


-- ============================================================
-- SECTION 12 — HELPER RPC: get_monthly_totals(year, month)
-- Aggregated stats for the admin dashboard summary cards.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_monthly_totals(p_year INTEGER, p_month INTEGER)
RETURNS TABLE (
    total_revenue        NUMERIC,
    total_expenses       NUMERIC,
    net_clinic_income    NUMERIC,
    cash_total           NUMERIC,
    vodafone_cash_total  NUMERIC,
    instapay_total       NUMERIC,
    total_lab_fees       NUMERIC,
    payment_in_count     BIGINT,
    expense_out_count    BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_range_start  TIMESTAMPTZ;
    v_range_end    TIMESTAMPTZ;
BEGIN
    v_range_start := DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1))::TIMESTAMPTZ AT TIME ZONE 'UTC';
    v_range_end   := v_range_start + INTERVAL '1 month';

    RETURN QUERY
    SELECT
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in'                                                     THEN final_amount     END), 0), 2) AS total_revenue,
        ROUND(COALESCE(SUM(CASE WHEN type = 'expense_out'                                                    THEN final_amount     END), 0), 2) AS total_expenses,
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in'  THEN  final_amount ELSE -final_amount END),        0), 2)                              AS net_clinic_income,
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in'  AND payment_method = 'cash'          THEN final_amount END), 0), 2) AS cash_total,
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in'  AND payment_method = 'vodafone_cash' THEN final_amount END), 0), 2) AS vodafone_cash_total,
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in'  AND payment_method = 'instapay'      THEN final_amount END), 0), 2) AS instapay_total,
        ROUND(COALESCE(SUM(CASE WHEN type = 'payment_in'                                       THEN lab_fees_amount END), 0), 2) AS total_lab_fees,
        COUNT(CASE WHEN type = 'payment_in'  THEN 1 END)                                                                        AS payment_in_count,
        COUNT(CASE WHEN type = 'expense_out' THEN 1 END)                                                                        AS expense_out_count
    FROM public.transactions
    WHERE created_at >= v_range_start
      AND created_at  < v_range_end;
END;
$$;


-- ============================================================
-- SECTION 13 — ROW LEVEL SECURITY
-- Per spec: No RLS. All access control is handled at the
-- service layer in the frontend. RLS is disabled on all tables.
-- ============================================================

ALTER TABLE public.doctors          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_closings DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECTION 14 — GRANTS
-- Grant the authenticated Supabase role access to all app tables
-- and functions. The anon role gets no access.
-- ============================================================

-- Tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_closings TO authenticated;

-- RPCs
GRANT EXECUTE ON FUNCTION public.get_monthly_closing_summary(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_totals(DATE)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_totals(INTEGER, INTEGER)          TO authenticated;

-- Sequences (uuid_generate_v4 uses no sequences, but guard for future serial columns)
-- No serial columns currently used.


-- ============================================================
-- SECTION 15 — SEED DATA (optional — safe to skip in production)
-- Creates one default admin user via auth.users.
-- Replace the password with a strong one before running.
-- The handle_new_auth_user trigger auto-creates the public.users row.
--
-- To create users in production, use the Supabase Admin API
-- or the createUser() service function in the frontend.
--
-- Uncomment the block below only if you need a bootstrap admin:
-- ============================================================

/*
SELECT auth.create_user(
    '{
        "email":      "admin@iconicfinance.app",
        "password":   "CHANGE_ME_STRONG_PASSWORD",
        "email_confirm": true,
        "user_metadata": {
            "username":  "admin",
            "full_name": "System Admin",
            "role":      "admin",
            "doctor_id": ""
        }
    }'::jsonb
);
*/


-- ============================================================
-- SCHEMA COMPLETE
-- ============================================================
-- Tables created:    doctors, users, patients, transactions, monthly_closings
-- Triggers created:  set_updated_at (×5), handle_new_auth_user,
--                    calculate_transaction_fields,
--                    handle_closing_confirm, handle_closing_reopen
-- RPCs created:      get_monthly_closing_summary, get_daily_totals,
--                    get_monthly_totals
-- ============================================================


-- ============================================================
-- SECTION 16 — PATIENT BALANCE: ATOMIC RPCs (added later)
-- ============================================================
-- NOTE: public.patient_balance and public.patient_balance_events
-- were added to the live database after this master file was
-- originally written, so their CREATE TABLE statements are not
-- above. For reference, their columns (as used by the app) are:
--
--   patient_balance (
--     id UUID PK, patient_id UUID, doctor_id UUID,
--     total_due NUMERIC, total_paid NUMERIC, is_settled BOOLEAN,
--     notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
--     UNIQUE (patient_id, doctor_id)   -- required for the upserts below
--   )
--   patient_balance_events (
--     id UUID PK, patient_id UUID, doctor_id UUID,
--     event_type TEXT,  -- 'balance_created' | 'total_updated' | 'payment'
--     old_total NUMERIC, new_total NUMERIC, payment_amount NUMERIC,
--     new_remaining NUMERIC, transaction_id UUID, notes TEXT,
--     created_at TIMESTAMPTZ
--   )
--
-- WHY THIS SECTION EXISTS:
-- The app used to read a patient's balance into the browser,
-- compute total_paid + newPayment in JavaScript, then write the
-- whole new number back (a classic read-modify-write). That's a
-- race condition: if the balance was still loading when Save was
-- clicked, or if two staff members touched the same patient's
-- balance around the same time, a payment could be recorded as a
-- transaction but never actually credited to the balance — silently.
-- This happened in production (Aug 2026) for at least two patients.
--
-- These functions move the read-modify-write into a single atomic
-- Postgres statement per balance row, so there is no window for a
-- slow network or a second concurrent user to cause a lost update.
-- ============================================================

-- ----------------------------------------------------------
-- 16.1  credit_patient_balance
-- Atomically creates or updates a patient_balance row (crediting
-- a payment and/or changing total_due) and logs the matching
-- patient_balance_events row in the same statement/transaction.
-- Used by: Add Payment (assistant + admin), Edit Transaction's
-- "Total Clinical" / "Change total" actions.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_patient_balance(
    p_patient_id     UUID,
    p_doctor_id      UUID,
    p_amount         NUMERIC,      -- amount to credit toward total_paid (0 if only changing total)
    p_new_total_due  NUMERIC,      -- NULL = leave total_due unchanged; required when no balance exists yet
    p_transaction_id UUID,
    p_notes          TEXT DEFAULT NULL,
    p_reset          BOOLEAN DEFAULT FALSE  -- true = start a fresh cycle: total_paid becomes p_amount,
                                             -- not existing total_paid + p_amount. Use this whenever the
                                             -- caller found no *active* (unsettled) balance client-side —
                                             -- the row may still physically exist from a prior, fully-paid
                                             -- cycle, and its stale total_paid must not carry forward.
)
RETURNS public.patient_balance
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance    public.patient_balance%ROWTYPE;
    v_existed    BOOLEAN;
    v_old_total  NUMERIC;
    v_event_type TEXT;
BEGIN
    IF p_patient_id IS NULL OR p_doctor_id IS NULL THEN
        RAISE EXCEPTION 'patient_id and doctor_id are required';
    END IF;

    SELECT total_due INTO v_old_total
    FROM public.patient_balance
    WHERE patient_id = p_patient_id AND doctor_id = p_doctor_id;
    v_existed := FOUND;

    IF (NOT v_existed OR p_reset) AND p_new_total_due IS NULL THEN
        RAISE EXCEPTION 'new_total_due is required when creating or resetting a balance';
    END IF;

    -- Atomic upsert: the increment happens against whatever total_paid
    -- is at the moment this statement runs, not a value read earlier —
    -- concurrent callers for the same (patient_id, doctor_id) serialize
    -- on this row instead of overwriting each other. When p_reset is
    -- true, total_paid is overwritten instead of incremented, since a
    -- fresh cycle must not inherit a prior (already-settled) cycle's
    -- total_paid still sitting on the row.
    INSERT INTO public.patient_balance (patient_id, doctor_id, total_due, total_paid, is_settled)
    VALUES (
        p_patient_id, p_doctor_id,
        COALESCE(p_new_total_due, 0),
        COALESCE(p_amount, 0),
        COALESCE(p_amount, 0) >= COALESCE(p_new_total_due, 0)
    )
    ON CONFLICT (patient_id, doctor_id) DO UPDATE
    SET total_paid = CASE WHEN p_reset
                          THEN COALESCE(p_amount, 0)
                          ELSE public.patient_balance.total_paid + COALESCE(p_amount, 0)
                     END,
        total_due  = COALESCE(p_new_total_due, public.patient_balance.total_due),
        is_settled = (CASE WHEN p_reset
                          THEN COALESCE(p_amount, 0)
                          ELSE public.patient_balance.total_paid + COALESCE(p_amount, 0)
                     END) >= COALESCE(p_new_total_due, public.patient_balance.total_due),
        updated_at = now()
    RETURNING * INTO v_balance;

    v_event_type := CASE
        WHEN NOT v_existed OR p_reset THEN 'balance_created'
        WHEN p_new_total_due IS NOT NULL AND p_new_total_due <> v_old_total THEN 'total_updated'
        ELSE 'payment'
    END;

    INSERT INTO public.patient_balance_events (
        patient_id, doctor_id, event_type, old_total, new_total,
        payment_amount, new_remaining, transaction_id, notes
    ) VALUES (
        p_patient_id, p_doctor_id, v_event_type,
        CASE WHEN p_reset THEN NULL ELSE v_old_total END, v_balance.total_due,
        p_amount, GREATEST(v_balance.total_due - v_balance.total_paid, 0),
        p_transaction_id, p_notes
    );

    RETURN v_balance;
END;
$$;

-- ----------------------------------------------------------
-- 16.2  recompute_patient_balance
-- Atomically re-derives total_due/total_paid for one balance by
-- replaying its patient_balance_events history in a single
-- statement (no client round-trip in between reading events and
-- writing the result). Deletes the balance row if the replay
-- shows nothing outstanding. Used after a linked transaction is
-- edited or deleted.
--
-- IMPORTANT: total_paid is scoped to events *since the most recent
-- balance_created event*, not all history — the same (patient_id,
-- doctor_id) row is reused across separate treatment cycles (a new
-- cycle starts once a prior one is fully settled), and a prior
-- cycle's payments must not bleed into the current cycle's total.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_patient_balance(
    p_patient_id UUID,
    p_doctor_id  UUID
)
RETURNS public.patient_balance
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance          public.patient_balance%ROWTYPE;
    v_total_due        NUMERIC;
    v_cycle_started_at TIMESTAMPTZ;
    v_cycle_opening    NUMERIC;
    v_payments_since   NUMERIC;
    v_total_paid       NUMERIC;
BEGIN
    SELECT * INTO v_balance
    FROM public.patient_balance
    WHERE patient_id = p_patient_id AND doctor_id = p_doctor_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT new_total INTO v_total_due
    FROM public.patient_balance_events
    WHERE patient_id = p_patient_id AND doctor_id = p_doctor_id
      AND event_type IN ('balance_created', 'total_updated')
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    -- Scope total_paid to the current cycle: its opening balance_created
    -- credit, plus any 'payment' events logged after that cycle began.
    SELECT created_at, payment_amount INTO v_cycle_started_at, v_cycle_opening
    FROM public.patient_balance_events
    WHERE patient_id = p_patient_id AND doctor_id = p_doctor_id
      AND event_type = 'balance_created'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF v_cycle_started_at IS NULL THEN
        v_total_paid := 0;
    ELSE
        SELECT COALESCE(SUM(payment_amount), 0) INTO v_payments_since
        FROM public.patient_balance_events
        WHERE patient_id = p_patient_id AND doctor_id = p_doctor_id
          AND event_type = 'payment'
          AND created_at > v_cycle_started_at;
        v_total_paid := COALESCE(v_cycle_opening, 0) + COALESCE(v_payments_since, 0);
    END IF;

    v_total_due  := COALESCE(v_total_due, 0);
    v_total_paid := GREATEST(0, LEAST(v_total_paid, v_total_due));

    IF v_total_due <= 0 AND v_total_paid <= 0 THEN
        DELETE FROM public.patient_balance WHERE id = v_balance.id;
        RETURN NULL;
    END IF;

    UPDATE public.patient_balance
    SET total_due  = v_total_due,
        total_paid = v_total_paid,
        is_settled = v_total_paid >= v_total_due,
        updated_at = now()
    WHERE id = v_balance.id
    RETURNING * INTO v_balance;

    RETURN v_balance;
END;
$$;

-- ----------------------------------------------------------
-- 16.3  reconcile_transaction_balance
-- Atomic replacement for the old reconcileBalanceForEditedTransaction
-- client logic: patches the payment_amount (and patient/doctor, if
-- the transaction was reassigned) on whichever patient_balance_events
-- row is tied to this transaction, then recomputes the affected
-- balance(s). No-ops if the transaction was never linked to a
-- balance event in the first place (nothing to reconcile).
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_transaction_balance(
    p_transaction_id    UUID,
    p_before_patient_id UUID,
    p_before_doctor_id  UUID,
    p_after_patient_id  UUID,
    p_after_doctor_id   UUID,
    p_credited_amount   NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_moved      BOOLEAN;
    v_has_events BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.patient_balance_events WHERE transaction_id = p_transaction_id
    ) INTO v_has_events;

    IF NOT v_has_events THEN
        RETURN;
    END IF;

    v_moved := (p_before_patient_id IS DISTINCT FROM p_after_patient_id)
            OR (p_before_doctor_id  IS DISTINCT FROM p_after_doctor_id);

    UPDATE public.patient_balance_events
    SET payment_amount = p_credited_amount,
        patient_id = CASE WHEN v_moved THEN p_after_patient_id ELSE patient_id END,
        doctor_id  = CASE WHEN v_moved THEN p_after_doctor_id  ELSE doctor_id  END
    WHERE transaction_id = p_transaction_id
      AND event_type IN ('payment', 'balance_created');

    IF p_before_patient_id IS NOT NULL AND p_before_doctor_id IS NOT NULL THEN
        PERFORM public.recompute_patient_balance(p_before_patient_id, p_before_doctor_id);
    END IF;

    IF v_moved AND p_after_patient_id IS NOT NULL AND p_after_doctor_id IS NOT NULL THEN
        INSERT INTO public.patient_balance (patient_id, doctor_id, total_due, total_paid, is_settled)
        VALUES (p_after_patient_id, p_after_doctor_id, 0, 0, true)
        ON CONFLICT (patient_id, doctor_id) DO NOTHING;

        PERFORM public.recompute_patient_balance(p_after_patient_id, p_after_doctor_id);
    END IF;
END;
$$;

-- ----------------------------------------------------------
-- 16.4  remove_transaction_balance
-- Atomic replacement for deleteTransaction's balance cleanup:
-- deletes whichever patient_balance_events rows are tied to this
-- transaction, then recomputes the affected balance.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_transaction_balance(
    p_transaction_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT patient_id, doctor_id
        FROM public.patient_balance_events
        WHERE transaction_id = p_transaction_id
    LOOP
        DELETE FROM public.patient_balance_events
        WHERE transaction_id = p_transaction_id
          AND patient_id = r.patient_id AND doctor_id = r.doctor_id;
        PERFORM public.recompute_patient_balance(r.patient_id, r.doctor_id);
    END LOOP;
END;
$$;

-- ----------------------------------------------------------
-- 16.5  Grants
-- ----------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.credit_patient_balance(UUID, UUID, NUMERIC, NUMERIC, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_patient_balance(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_transaction_balance(UUID, UUID, UUID, UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_transaction_balance(UUID) TO authenticated;