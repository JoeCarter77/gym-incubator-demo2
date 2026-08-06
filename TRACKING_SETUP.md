# Link-open tracking → Google Sheet

Every time a prospect opens their mirror page, the page POSTs an event to
`/api/track`, which forwards it to whatever webhook you set in the
`TRACKING_WEBHOOK_URL` environment variable. Point that at a Google Sheet and
you get a live, sortable log of exactly who opened their page and when — perfect
for "did they open it?" follow-up.

Three events are sent:

| event         | fires when                                            |
|---------------|-------------------------------------------------------|
| `page_open`   | the prospect opens the link (once, on load)           |
| `panel4_view` | they scroll to their own live website (Panel 4)       |
| `cta_click`   | they click **Book a trial →**                         |

Each row records: `event`, `first_name`, `company`, `url`, `ts` (ISO time),
`ua` (device/browser), `ref` (referrer), and `ip`.

---

## Setup (about 5 minutes, no code changes needed)

### 1. Create the Sheet
- New Google Sheet, name it e.g. **"Ascend — Link Opens"**.
- Put these headers in row 1, columns A–H:

  `timestamp | event | first_name | company | url | user_agent | referrer | ip`

### 2. Add the Apps Script
- In the Sheet: **Extensions → Apps Script**.
- Delete the placeholder and paste:

```javascript
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // avoid two opens writing the same row
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var d = {};
    try { d = JSON.parse(e.postData.contents); } catch (err) {}
    sheet.appendRow([
      d.ts || new Date().toISOString(),
      d.event || '',
      d.first_name || '',
      d.company || '',
      d.url || '',
      d.ua || '',
      d.ref || '',
      d.ip || ''
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

### 3. Deploy as a Web App
- **Deploy → New deployment → type: Web app**.
- **Execute as:** Me.
- **Who has access:** Anyone.
- Deploy, authorise, and copy the **Web app URL**
  (looks like `https://script.google.com/macros/s/AKfy…/exec`).

### 4. Wire it into Vercel
- Vercel project → **Settings → Environment Variables**.
- Add `TRACKING_WEBHOOK_URL` = the Web app URL from step 3.
- Redeploy (or it takes effect on the next deploy).

That's it. Opens will start landing in the Sheet in real time.

---

## Notes
- **No env var set?** `/api/track` is a silent no-op — the page still works, nothing is logged. Setting the variable is the only switch.
- **Prefer Zapier / Make / GHL instead of a Sheet?** Same deal — paste that
  tool's inbound-webhook URL into `TRACKING_WEBHOOK_URL`. The JSON body shape is
  documented at the top of `api/track.js`.
- **De-duping opens:** the page sends `page_open` once per load. A prospect who
  reopens the link will log another row — that's usually what you want (it shows
  re-engagement), but you can filter/pivot on `first_name`+`company` in the Sheet.
