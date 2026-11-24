import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// supabase/setup.sql is what a person pastes into the Supabase SQL editor. It must always be exactly the
// migrations, in order, so nobody sets up a database that is missing a table or a privacy rule.
describe("supabase/setup.sql", () => {
  const dir = join(process.cwd(), "supabase");
  const migrations = readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  const setup = readFileSync(join(dir, "setup.sql"), "utf8");

  it("contains every migration, trimmed, in order", () => {
    let from = 0;
    for (const f of migrations) {
      const text = readFileSync(join(dir, "migrations", f), "utf8").trim();
      const at = setup.indexOf(text, from);
      expect(at, `${f} is missing or out of order in setup.sql: regenerate it`).toBeGreaterThanOrEqual(from);
      from = at + text.length;
    }
  });

  it("turns row level security on for every table it creates", () => {
    const created = [...setup.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(0);
    for (const t of created) expect(setup, `RLS missing for ${t}`).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
  });

  it("has no policy that lets the public read swipes or another member's private answers", () => {
    expect(setup).not.toMatch(/on public\.swipes for select/);
    expect(setup).not.toMatch(/on public\.tiebreak_votes for select/);
    expect(setup).toMatch(/on public\.plan_member_private for select using \(\s*exists \(select 1 from public\.plan_members m where m\.id = member_id and m\.user_id = auth\.uid\(\)\)/);
  });
});
