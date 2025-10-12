import { expect, test } from "@playwright/test";

test("end-to-end onboarding to report minting", async ({ page }) => {
  await page.setContent(`
    <html>
      <body style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
        <h1>APGMS Demo Console</h1>
        <section id="onboarding">
          <h2>1. Onboarding</h2>
          <form id="onboarding-form">
            <label>
              Legal name
              <input name="legalName" required />
            </label>
            <label>
              ABN
              <input name="abn" pattern="\\d{11}" required />
            </label>
            <label>
              Primary email
              <input name="email" type="email" required />
            </label>
            <button type="submit">Create profile</button>
          </form>
          <p id="onboarding-result" hidden></p>
        </section>

        <section id="bas" hidden>
          <h2>2. BAS Draft</h2>
          <p>
            We'll synthesise a BAS draft from sample data so you can follow the
            rest of the guided workflow.
          </p>
          <button id="bas-button">Start BAS Draft</button>
          <p id="bas-result" hidden></p>
        </section>

        <section id="recon" hidden>
          <h2>3. Reconciliation</h2>
          <button id="recon-button">Run reconciliation</button>
          <p id="recon-result" hidden></p>
        </section>

        <section id="debit" hidden>
          <h2>4. Debit Scheduling</h2>
          <button id="debit-button">Schedule debit</button>
          <p id="debit-result" hidden></p>
        </section>

        <section id="report" hidden>
          <h2>5. Mint RPT</h2>
          <button id="report-button">Mint regulatory report</button>
          <p id="report-result" hidden></p>
        </section>

        <script>
          const state = {
            draft: null,
            debit: null,
            profile: null,
            transactions: [
              { id: "s-1", type: "sale", amount: 1000, gst: 0.1 },
              { id: "e-1", type: "expense", amount: 200, gst: 0.1 }
            ],
            bankFeed: [
              { reference: "bf-100", amount: 1000 },
              { reference: "bf-200", amount: 200 }
            ]
          };

          function reveal(id) {
            document.getElementById(id).hidden = false;
          }

          document.getElementById("onboarding-form").addEventListener("submit", (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const legalName = form.legalName.value;
            const abn = form.abn.value;
            const email = form.email.value;
            state.profile = { legalName, abn, email };
            const result = document.getElementById("onboarding-result");
            result.textContent = `${legalName} onboarded with ABN ${abn}`;
            result.hidden = false;
            reveal("bas");
          });

          document.getElementById("bas-button").addEventListener("click", () => {
            const net = state.transactions.reduce((total, txn) => {
              const gross = txn.amount * (1 + txn.gst);
              return total + (txn.type === "sale" ? gross : -gross);
            }, 0);
            state.draft = { net }; // extremely small mock
            const result = document.getElementById("bas-result");
            result.textContent = `Draft generated. Net payable: $${net.toFixed(2)}`;
            result.hidden = false;
            reveal("recon");
          });

          document.getElementById("recon-button").addEventListener("click", () => {
            const matches = state.bankFeed.filter((feed) =>
              state.transactions.some((txn) => Math.abs(txn.amount - feed.amount) < 1)
            );
            const rate = matches.length / state.bankFeed.length;
            const result = document.getElementById("recon-result");
            result.textContent = `Reconciliation successful: ${(rate * 100).toFixed(0)}% match`;
            result.hidden = false;
            reveal("debit");
          });

          document.getElementById("debit-button").addEventListener("click", () => {
            const status = state.draft.net <= 2000 ? "scheduled" : "insufficient";
            state.debit = { status, reference: "dd-123" };
            const result = document.getElementById("debit-result");
            result.textContent = status === "scheduled"
              ? "Debit scheduled for next business day"
              : "Debit cannot be scheduled";
            result.hidden = false;
            reveal("report");
          });

          document.getElementById("report-button").addEventListener("click", () => {
            if (!state.debit || state.debit.status !== "scheduled") {
              document.getElementById("report-result").textContent = "Debit must be scheduled first";
              return;
            }
            const result = document.getElementById("report-result");
            result.textContent = `Report minted for ${state.profile.legalName}`;
            result.hidden = false;
          });
        </script>
      </body>
    </html>
  `);

  await page.fill('input[name="legalName"]', "Birchal Demo Pty Ltd");
  await page.fill('input[name="abn"]', "12345678901");
  await page.fill('input[name="email"]', "ops@example.com");
  await page.click('button:has-text("Create profile")');
  await expect(page.locator('#onboarding-result')).toContainText('Birchal Demo Pty Ltd onboarded');

  await page.click('#bas-button');
  await expect(page.locator('#bas-result')).toHaveText(/Net payable: \$880\.00/);

  await page.click('#recon-button');
  await expect(page.locator('#recon-result')).toHaveText(/100% match/);

  await page.click('#debit-button');
  await expect(page.locator('#debit-result')).toContainText('Debit scheduled');

  await page.click('#report-button');
  await expect(page.locator('#report-result')).toHaveText('Report minted for Birchal Demo Pty Ltd');
});
