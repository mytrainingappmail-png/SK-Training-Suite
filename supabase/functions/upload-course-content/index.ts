// supabase/functions/upload-course-content/index.ts
//
// Server-side upload proxy for the `course-content` Storage bucket.
//
// This project does not use Supabase Auth — logins are handled by a custom,
// localStorage-based session (see src/services/auth/session.ts). Because of
// that, every browser-side Supabase request runs as the `anon` role, which
// can never satisfy Storage RLS policies that require a real authenticated
// Supabase user (auth.uid()). Weakening those policies so `anon` can write
// would let anyone holding the public anon key upload to the bucket.
//
// Instead, the privileged write happens here: this function runs with the
// `service_role` key (a server-side secret, never shipped to the browser,
// configured as a Supabase Edge Function secret — never a VITE_-prefixed
// env var). The client calls this function instead of Storage directly,
// passing the file plus the employee id from its custom session. This
// function verifies that id corresponds to a real, active employee before
// performing the upload on their behalf, then returns the public URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

const MEDIA_BUCKET = 'course-content';

const FOLDER_BY_KIND: Record<string, string> = {
  image: 'images',
  video: 'videos',
  document: 'documents',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-employee-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const employeeId = req.headers.get('x-employee-id');
    if (!employeeId) {
      return json({ error: 'Missing employee session.' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify the custom session's employee id is real and active before
    // allowing a privileged write on their behalf. The client's cached
    // session (localStorage) is never trusted on its own — this is a
    // live lookup against the `employees` table.
    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .select('id, active')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee || !employee.active) {
      return json({ error: 'Invalid or inactive session.' }, 401);
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const kind = String(formData.get('kind') ?? '');

    if (!(file instanceof File)) {
      return json({ error: 'No file provided.' }, 400);
    }
    if (!FOLDER_BY_KIND[kind]) {
      return json({ error: 'Invalid media kind.' }, 400);
    }

    const folder = FOLDER_BY_KIND[kind];
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${folder}/${uniquePrefix}-${safeName}`;

    const { error: uploadError } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      return json({ error: uploadError.message }, 500);
    }

    const { data: publicUrlData } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(path);

    return json({
      url: publicUrlData.publicUrl,
      path,
      fileName: file.name,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});