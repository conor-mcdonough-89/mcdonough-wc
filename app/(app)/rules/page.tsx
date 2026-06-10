export const metadata = { title: "Rules — McDonough World Cup Pool" };

export default function RulesPage() {
  return (
    <article className="prose-pool">
      <h1>How the pool works</h1>
      <p className="lead">
        A salary-cap draft pool. Build a 5-team roster from across the tournament, then collect
        points as your teams play through the World Cup.
      </p>

      <Section title="1. The draft">
        <ul>
          <li><strong>Roster size:</strong> 5 teams.</li>
          <li><strong>Budget:</strong> 100 points total. Teams are priced by tier.</li>
          <li><strong>Max 1 team per WC group</strong> (A through L).</li>
          <li><strong>Max 2 teams per confederation</strong> — guarantees at least 3 confederations on every roster.</li>
        </ul>
        <p>
          Picks are independent — no team is ever &ldquo;taken&rdquo; by another player. Save and edit your
          roster freely until kickoff of the opening match. The pool locks at that point and rosters
          freeze for the tournament.
        </p>
      </Section>

      <Section title="2. Prices">
        <table className="tier-table">
          <thead>
            <tr><th>Tier</th><th>Price</th><th>Who</th></tr>
          </thead>
          <tbody>
            <tr><td>S</td><td>43</td><td>The four favourites — France, Spain, Argentina, England</td></tr>
            <tr><td>A</td><td>29</td><td>Title contenders — Portugal, Brazil, Netherlands, Morocco, Belgium, Germany, Croatia, Colombia</td></tr>
            <tr><td>B</td><td>17</td><td>Strong sides — Senegal, Mexico, USA, Uruguay, Japan, Switzerland, Iran, Austria, Ecuador, South Korea, Australia, Egypt</td></tr>
            <tr><td>C</td><td>9</td><td>Mid-pack — Canada, Ivory Coast, Qatar, Algeria, Sweden, Tunisia, Czechia, Türkiye, Norway, Scotland, DR Congo, Bosnia &amp; Herzegovina</td></tr>
            <tr><td>D</td><td>4</td><td>The dozen cheapest — high variance, low cost</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="3. Group-stage scoring">
        <p>Each team on your roster earns points independently. Goals and clean sheets apply <em>regardless</em> of result.</p>
        <table className="score-table">
          <thead><tr><th>Action</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Win</td><td>+4</td></tr>
            <tr><td>Draw</td><td>+2</td></tr>
            <tr><td>Loss</td><td>0</td></tr>
            <tr><td>Each goal scored</td><td>+1</td></tr>
            <tr><td>Clean sheet (0 conceded)</td><td>+1</td></tr>
          </tbody>
        </table>
        <p>Advancing out of the group earns a one-time bonus:</p>
        <table className="score-table">
          <thead><tr><th>Advancement</th><th>Bonus</th></tr></thead>
          <tbody>
            <tr><td>Group winner</td><td>+10</td></tr>
            <tr><td>Runner-up</td><td>+7</td></tr>
            <tr><td>Best third-place qualifier</td><td>+4</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="4. Knockout scoring">
        <p>
          Every knockout win is worth the same flat base, plus a point per goal scored and a clean-sheet
          bonus. The Final carries a small premium; the third-place match a small discount.
          <strong> Losing teams score zero for that match.</strong> There is no underdog multiplier.
        </p>
        <table className="score-table">
          <thead>
            <tr><th>Round</th><th>Win base</th><th>+ per goal</th><th>+ clean sheet</th></tr>
          </thead>
          <tbody>
            <tr><td>Round of 32</td><td>6</td><td>+1</td><td>+1</td></tr>
            <tr><td>Round of 16</td><td>6</td><td>+1</td><td>+1</td></tr>
            <tr><td>Quarter-final</td><td>6</td><td>+1</td><td>+1</td></tr>
            <tr><td>Semi-final</td><td>6</td><td>+1</td><td>+1</td></tr>
            <tr><td>Final (champion)</td><td>8</td><td>+1</td><td>+1</td></tr>
            <tr><td>Third-place match</td><td>4</td><td>+1</td><td>+1</td></tr>
          </tbody>
        </table>
        <h4>Goals, extra time, and penalties</h4>
        <ul>
          <li><strong>Goals scored</strong> count from regulation and extra time. Penalty-shootout kicks do <em>not</em> count.</li>
          <li><strong>Clean sheet</strong> is awarded only if the team concedes no goals in regulation or extra time.</li>
          <li>These bonuses count <strong>only for the winning team.</strong></li>
        </ul>
        <h4>Examples</h4>
        <ul>
          <li>B-tier wins R32 2–0: <code>6 + 2 + 1 = 9 pts</code></li>
          <li>Wins a 0–0 R32 on penalties: <code>6 + 0 + 1 = 7 pts</code></li>
          <li>Wins QF 1–1 on penalties (conceded in regulation): <code>6 + 1 + 0 = 7 pts</code></li>
          <li>Champion wins the Final 2–1: <code>8 + 2 + 0 = 10 pts</code></li>
        </ul>
      </Section>

      <Section title="5. Tiebreakers">
        <p>If two rosters finish on identical totals, in order:</p>
        <ol>
          <li>Higher total from group-stage points alone</li>
          <li>More teams advanced past the group stage</li>
          <li>More total goals scored across all your teams</li>
          <li>Coin flip</li>
        </ol>
      </Section>

      <Section title="6. Quick reference">
        <ul className="quick">
          <li><strong>Budget:</strong> 100 pts</li>
          <li><strong>Roster size:</strong> 5 teams</li>
          <li><strong>Max per group:</strong> 1</li>
          <li><strong>Max per confederation:</strong> 2</li>
          <li><strong>Tier prices:</strong> S 43 · A 29 · B 17 · C 9 · D 4</li>
          <li><strong>KO win:</strong> 6 base (Final 8, 3rd-place 4) + 1/goal + 1 clean sheet, no multiplier</li>
          <li><strong>Lock-in:</strong> kickoff of the opening match, June 11, 2026</li>
        </ul>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold text-neutral-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}
