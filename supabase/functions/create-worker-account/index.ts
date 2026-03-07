import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with caller's JWT to verify role
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await supabaseClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has admin or district_head role
    const { data: callerRole } = await supabaseClient.rpc("get_user_role", { _user_id: caller.id });
    if (!callerRole || !["admin", "district_head"].includes(callerRole)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, phone, district, booth_assignment, constituency, skills, experience_level, status } = await req.json();

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "Email and full name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client to create auth user
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Generate a temporary password
    const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";

    // Create the auth user
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name, role: "volunteer" },
    });

    if (authError) {
      // If user already exists, try to find them
      if (authError.message?.includes("already been registered")) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find((u: any) => u.email === email);

        if (existingUser) {
          // Create worker linked to existing user
          const { data: worker, error: workerError } = await supabaseAdmin
            .from("workers")
            .insert({
              full_name,
              email,
              phone: phone || null,
              district: district || null,
              booth_assignment: booth_assignment || null,
              constituency: constituency || null,
              skills: skills || [],
              experience_level: experience_level || 1,
              status: status || "active",
              created_by: caller.id,
              user_id: existingUser.id,
            })
            .select()
            .single();

          if (workerError) {
            return new Response(JSON.stringify({ error: workerError.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(
            JSON.stringify({ worker, message: "Worker linked to existing account", accountCreated: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the worker record linked to the new auth user
    const { data: worker, error: workerError } = await supabaseAdmin
      .from("workers")
      .insert({
        full_name,
        email,
        phone: phone || null,
        district: district || null,
        booth_assignment: booth_assignment || null,
        constituency: constituency || null,
        skills: skills || [],
        experience_level: experience_level || 1,
        status: status || "active",
        created_by: caller.id,
        user_id: newUser.user.id,
      })
      .select()
      .single();

    if (workerError) {
      // Clean up the auth user if worker creation fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: workerError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send password reset email so worker can set their own password
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    return new Response(
      JSON.stringify({
        worker,
        message: `Account created for ${email}. A password reset email has been sent.`,
        accountCreated: true,
        tempPassword,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
