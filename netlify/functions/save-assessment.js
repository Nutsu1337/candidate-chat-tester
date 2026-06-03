exports.handler = async function(event) {
  try {
    console.log("Save assessment function started");

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      console.log("Missing SUPABASE_URL");
      return json(500, { error: "Missing SUPABASE_URL" });
    }

    if (!supabaseKey) {
      console.log("Missing SUPABASE_SECRET_KEY");
      return json(500, { error: "Missing SUPABASE_SECRET_KEY" });
    }

    const body = JSON.parse(event.body || "{}");

    const candidate_name = String(body.candidate_name || "").trim();
    const candidate_email = String(body.candidate_email || "").trim();
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];

    console.log("Candidate:", candidate_name, candidate_email);
    console.log("Transcript messages:", transcript.length);

    if (!candidate_name || !candidate_email) {
      return json(400, { error: "Missing candidate name or email" });
    }

    if (!transcript.length) {
      return json(400, { error: "Transcript is empty" });
    }

    const evaluation = {
      note: "Transcript saved. Manual review recommended.",
      overall_score: null,
      recommendation: "Manual Review"
    };

    const payload = {
      candidate_name,
      candidate_email,
      transcript,
      evaluation,
      score: null
    };

    console.log("Sending to Supabase...");

    const res = await fetch(`${supabaseUrl}/rest/v1/assessments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();

    console.log("Supabase status:", res.status);
    console.log("Supabase response:", text);

    if (!res.ok) {
      return json(500, {
        error: "Supabase insert failed",
        status: res.status,
        details: text
      });
    }

    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return json(200, {
      saved: true,
      assessment: Array.isArray(data) ? data[0] : data
    });

  } catch (err) {
    console.log("Save function error:", err.message);
    return json(500, { error: err.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}