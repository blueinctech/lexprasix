// Checks the external services without printing any secret values:
//   - Neon/Postgres: connects, reports server version and whether migrations ran
//   - S3: writes, reads and deletes a small test object in both buckets; checks
//     the public media URL serves it
//   - SES: account sending status, quota, and whether the sender is verified
// Sends no email unless --send-test you@example.com is given.
//
//   ENV_FILE=.env.production.local npm run check:services
//   ENV_FILE=.env.production.local npm run check:services -- --send-test you@example.com
import { config } from "dotenv";

config({ path: process.env.ENV_FILE || ".env.local", quiet: true });
config({ quiet: true });

const args = process.argv.slice(2);
const testTo = args.includes("--send-test") ? args[args.indexOf("--send-test") + 1] : null;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => console.log(`  ✗ ${m}`);
const has = (...keys: string[]) => keys.filter((k) => !process.env[k]);
let failures = 0;

console.log(`Using ${process.env.ENV_FILE || ".env.local"}\n`);

// ---------------------------------------------------------------- database
console.log("Database");
{
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    bad("DATABASE_URL is not set");
    failures++;
  } else {
    const host = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "(unparseable URL)";
      }
    })();
    try {
      const postgres = (await import("postgres")).default;
      const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
      const [{ version }] = await sql`select version()`;
      ok(`connected to ${host} — ${String(version).split(" ").slice(0, 2).join(" ")}`);
      const [{ exists }] = await sql`select to_regclass('public.posts') is not null as exists`;
      if (exists) {
        const [{ n }] = await sql`select count(*)::int as n from posts`;
        ok(`schema present (${n} posts)`);
      } else console.log("  • schema not created yet — run: ENV_FILE=… npm run db:migrate");
      if (process.env.DATABASE_URL && process.env.DATABASE_URL_UNPOOLED) ok("pooled and direct URLs both set");
      else console.log("  • tip: set both DATABASE_URL (pooled, -pooler host) and DATABASE_URL_UNPOOLED (direct)");
      await sql.end();
    } catch (err) {
      bad(`could not connect to ${host}: ${(err as Error).message}`);
      failures++;
    }
  }
}

// ---------------------------------------------------------------- storage
console.log("\nS3 storage");
{
  const missing = has("S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_MEDIA_BUCKET", "S3_UPLOADS_BUCKET", "S3_REGION");
  if (missing.length) {
    bad(`missing: ${missing.join(", ")}`);
    failures++;
  } else {
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
    });
    const key = `healthcheck/${Date.now()}.txt`;
    for (const [label, bucket] of [
      ["media (public)", process.env.S3_MEDIA_BUCKET!],
      ["uploads (private)", process.env.S3_UPLOADS_BUCKET!],
    ] as const) {
      try {
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "ok", ContentType: "text/plain" }));
        const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = await got.Body!.transformToString();
        if (body !== "ok") throw new Error("read-back mismatch");
        if (label.startsWith("media")) {
          const base = (process.env.NEXT_PUBLIC_MEDIA_URL || "").replace(/\/$/, "");
          if (!base.startsWith("http")) console.log("  • NEXT_PUBLIC_MEDIA_URL not set to the bucket's public URL");
          else {
            const pub = await fetch(`${base}/${key}`);
            if (pub.ok) ok(`${label}: public URL serves files (${new URL(base).host})`);
            else {
              bad(`${label}: ${base}/… returned ${pub.status} — make the bucket (or a CloudFront distribution) publicly readable`);
              failures++;
            }
          }
        } else {
          // The private bucket must NOT be publicly readable.
          const region = process.env.S3_REGION;
          const pub = await fetch(`https://${bucket}.s3.${region}.amazonaws.com/${key}`).catch(() => null);
          if (pub && pub.ok) {
            bad(`${label}: files are PUBLICLY readable — block public access on this bucket`);
            failures++;
          } else ok(`${label}: not publicly readable`);
        }
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        ok(`${label} "${bucket}": write, read and delete work`);
      } catch (err) {
        const e = err as { name?: string; message?: string };
        bad(`${label} "${bucket}": ${e.name ?? "error"} — ${e.message ?? ""}`);
        failures++;
      }
    }
    console.log("  • remember CORS on both buckets: allow PUT from https://lexpraxisng.com (and preview URLs) with header Content-Type");
  }
}

// ---------------------------------------------------------------- email
console.log("\nAmazon SES");
{
  // One AWS key can serve both S3 and SES: SES_* falls back to S3_*.
  const sesKey = process.env.SES_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const sesSecret = process.env.SES_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const sesRegion = process.env.SES_REGION || process.env.S3_REGION;
  const missing = [...(!sesKey ? ["S3_ACCESS_KEY_ID (or SES_ACCESS_KEY_ID)"] : []), ...(!sesSecret ? ["S3_SECRET_ACCESS_KEY (or SES_SECRET_ACCESS_KEY)"] : []), ...(!sesRegion ? ["S3_REGION (or SES_REGION)"] : []), ...has("EMAIL_FROM")];
  if (missing.length) {
    bad(`missing: ${missing.join(", ")}`);
    failures++;
  } else {
    const { SESv2Client, GetAccountCommand, GetEmailIdentityCommand, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
    console.log(`  • using the ${process.env.SES_ACCESS_KEY_ID ? "SES" : "S3"} access key`);
    const ses = new SESv2Client({ region: sesRegion, credentials: { accessKeyId: sesKey!, secretAccessKey: sesSecret! } });
    try {
      const acct = await ses.send(new GetAccountCommand({}));
      ok(`account reachable in ${sesRegion}; sending ${acct.SendingEnabled ? "enabled" : "DISABLED"}`);
      if (acct.ProductionAccessEnabled) ok(`production access (quota ${acct.SendQuota?.Max24HourSend}/day)`);
      else {
        bad("SES is in SANDBOX mode: it can only send to verified addresses. Request production access in the SES console before launch.");
        failures++;
      }
      const from = process.env.EMAIL_FROM!.match(/<([^>]+)>/)?.[1] ?? process.env.EMAIL_FROM!;
      const domain = from.split("@")[1];
      for (const identity of [domain, from]) {
        try {
          const id = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: identity }));
          if (id.VerifiedForSendingStatus) {
            ok(`sender identity "${identity}" verified${id.DkimAttributes?.Status === "SUCCESS" ? " (DKIM ok)" : ""}`);
            break;
          }
          bad(`identity "${identity}" exists but is not verified yet (DKIM: ${id.DkimAttributes?.Status ?? "n/a"})`);
        } catch {
          if (identity === from) {
            bad(`neither ${domain} nor ${from} is a verified SES identity — verify the domain in SES and add its DKIM records in Cloudflare`);
            failures++;
          }
        }
      }
      if (testTo) {
        const r = await ses.send(
          new SendEmailCommand({
            FromEmailAddress: process.env.EMAIL_FROM,
            Destination: { ToAddresses: [testTo] },
            Content: { Simple: { Subject: { Data: "LexPraxis website — SES test" }, Body: { Text: { Data: "If you can read this, the website can send email through Amazon SES." } } } },
          }),
        );
        ok(`test email sent to ${testTo} (message ${r.MessageId}) — check the inbox and spam folder`);
      }
    } catch (err) {
      const e = err as { name?: string; message?: string };
      bad(`${e.name ?? "error"} — ${e.message ?? ""}`);
      failures++;
    }
  }
}

console.log(`\n${failures ? `${failures} problem(s) found.` : "All services OK."}`);
process.exit(failures ? 1 : 0);
