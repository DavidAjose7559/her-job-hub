# Her Job Hub — Auto Fill Extension

Auto-fills job application forms using your saved Her Job Hub profile.

## How it works

1. The extension finds your open Her Job Hub tab and reads your Supabase session
2. It fetches your profile (name, email, phone, LinkedIn, resume, etc.) from Supabase
3. When you click **Auto-fill**, it detects and fills form fields on the current job page
4. Cover letter fields are filled with your last AI-generated cover letter

## Install

1. Open **chrome://extensions** in Chrome
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked**
4. Select the `/extension` folder from this repo
5. Pin the extension from the Chrome toolbar puzzle-piece menu

## Usage

1. Open **[Her Job Hub](https://her-job-hub.vercel.app)** in any tab and make sure you are logged in
2. Navigate to a job application page (LinkedIn, Indeed, Greenhouse, Lever, Workday, etc.)
3. Click the **Her Job Hub** extension icon in the toolbar
4. Click **Auto-fill this page**
5. Review the filled fields before submitting

## Supported fields

| Field | Detected by |
|---|---|
| First name | name / id / placeholder / label containing "first", "fname", "given" |
| Last name | name / id / placeholder / label containing "last", "lname", "surname" |
| Full name | autocomplete="name" or "full name" labels |
| Email | type="email" or "email" in any label |
| Phone | type="tel" or "phone", "mobile", "tel" labels |
| LinkedIn URL | "linkedin" in any attribute or label |
| Portfolio / Website | "portfolio", "website" labels |
| City / Location | "city", "location" labels |
| Salary expectation | "salary", "compensation", "pay" labels |
| Cover letter | textareas with "cover letter", "motivation", "why apply" labels |
| Resume text | textareas with "resume", "experience", "background" labels |

## Site-specific support

- **LinkedIn Easy Apply** — fills the slide-in panel fields and cover letter textarea
- **Indeed** — targets `applicant.*` field IDs directly
- **Greenhouse** (boards.greenhouse.io) — targets standard `first_name`, `last_name` field names
- **Lever** (jobs.lever.co) — fills name, email, phone, LinkedIn, portfolio, comments
- **Workday** (myworkdayjobs.com) — uses `data-automation-id` attribute selectors

## Troubleshooting

**"Open Her Job Hub first"** — The extension reads your session from an open Her Job Hub tab. Open `her-job-hub.vercel.app` in any tab, log in, then retry.

**"No fillable fields detected"** — Wait for the application form to fully load, scroll to it, then click Auto-fill again. Some SPAs inject forms dynamically.

**Fields not updating** — The page may use a framework like React that manages input state. The extension dispatches native `input` and `change` events which should trigger React's handlers. If a field still doesn't update, fill it manually.
