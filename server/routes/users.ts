import { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

export const handleCreateUser: RequestHandler = async (req, res) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({
      error:
        "Server is missing SUPABASE_SERVICE_KEY. Add it to .env (get it from Supabase → Project Settings → API → service_role key).",
    });
    return;
  }

  const { username, full_name, password, role, doctor_id } = req.body;

  if (!username || !full_name || !password || !role) {
    res.status(400).json({ error: "username, full_name, password, and role are required." });
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `${username}@iconicfinance.app`;

  // Create the auth user — the DB trigger handle_new_auth_user auto-inserts public.users
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name,
      role,
      doctor_id: doctor_id || null,
    },
  });

  if (authError) {
    res.status(400).json({ error: authError.message });
    return;
  }

  // Wait briefly for the DB trigger to fire, then fetch the public.users row
  await new Promise((r) => setTimeout(r, 500));

  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    // Auth user was created but profile fetch failed — still return success with minimal data
    res.status(201).json({
      id: authData.user.id,
      username,
      full_name,
      role,
      doctor_id: doctor_id || null,
      is_active: true,
      created_at: authData.user.created_at,
      updated_at: authData.user.created_at,
    });
    return;
  }

  res.status(201).json(profile);
};
