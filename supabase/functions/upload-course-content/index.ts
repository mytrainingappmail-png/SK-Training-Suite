// supabase/functions/upload-course-content/index.ts
//
// Server-side upload proxy for the `course-content` Storage bucket.
//
// The privileged write happens here (service_role key, a server-side secret
// that never reaches the browser) so storage quotas can be enforced and every
// file is recorded against its owning company. The caller is identified by
// their real Supabase Auth session (the bearer token that
// supabase.functions.invoke sends automatically) — never by an id passed in a
// header, which anyone who learned an employee id could have forged.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders as SHARED_CORS, HttpError, requireEmployeeCaller } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MEDIA_BUCKET = 'course-content';

const FOLDER_BY_KIND: Record<string, string> = {
  image: 'images',
  video: 'videos',
  document: 'documents',
  audio: 'audio',
};

const CORS_HEADERS = {
  ...SHARED_CORS,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Who is calling? A real, signed-in, active employee — resolved from the
    // verified session token, never from a client-supplied id.
    const employee = await requireEmployeeCaller(req, admin).catch((err) => {
      if (err instanceof HttpError) throw err;
      throw new HttpError(401, 'Invalid or inactive session.');
    });

    const formData = await req.formData();
    const file = formData.get('file');
    const kind = String(formData.get('kind') ?? '');

    if (!(file instanceof File)) {
      return json({ error: 'No file provided.' }, 400);
    }
    if (!FOLDER_BY_KIND[kind]) {
      return json({ error: 'Invalid media kind.' }, 400);
    }

    // Storage quota: refuse the upload up front if it would push the company past its plan's
    // storage allowance (or exceeds the platform's per-file limit). Limits live in the database
    // (storage_settings + subscription_plans.max_storage_gb), not in this code.
    const { data: check, error: checkError } = await admin
      .rpc('storage_check_upload', { p_company: employee.companyId, p_bytes: file.size })
      .single();
    if (checkError) {
      return json({ error: checkError.message }, 500);
    }
    if (check && !(check as { ok: boolean }).ok) {
      return json({ error: (check as { reason: string }).reason }, 413);
    }

    const folder = FOLDER_BY_KIND[kind];
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Path stays images|videos|documents/... so the Storage Manager keeps listing it; the owning
    // company is recorded in storage_file_owners for the usage report.
    const path = `${folder}/${uniquePrefix}-${safeName}`;

    const { error: uploadError } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      return json({ error: uploadError.message }, 500);
    }

    await admin.from('storage_file_owners').upsert({ bucket_id: MEDIA_BUCKET, name: path, company_id: employee.companyId, uploaded_by: employee.employeeId });

    const { data: publicUrlData } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(path);

    return json({
      url: publicUrlData.publicUrl,
      path,
      fileName: file.name,
    });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});
