# SharePoint / OneDrive — Why "Loading..." Never Goes Away

## What you are seeing

If the page shows **header, legend, and layout** but:

- Week stays on **"Loading..."**
- Booking table is empty (only the blue **Seat** header)
- Orange **"JavaScript did not run"** banner stays visible

then **SharePoint is not running your JavaScript at all**. This is not a bug in the booking logic — the browser never executes `<script>` in that viewer.

Your screenshot matches this: static HTML/CSS loads; JS does not.

---

## Root cause (most common)

### 1. SharePoint / OneDrive **sandboxed file viewer** (primary)

Opening `.html` from a document library (clicking the file in SharePoint) often loads it inside an iframe like:

```text
Blocked script execution in 'about:srcdoc' because the document's frame is
sandboxed and the 'allow-scripts' permission is not set.
```

**No amount of `localStorage` or `renderTable()` fixes inside the HTML will help** if scripts are blocked.

### 2. **Embed web part** on modern pages

The default **Embed** web part also sandboxes content and **blocks JavaScript** by design.

### 3. **Content Security Policy (CSP)** on modern SharePoint

Microsoft is tightening CSP. Inline `<script>` blocks and `onclick="..."` handlers may be blocked on site pages even when scripts work elsewhere.

### 4. Other (less common)

| Issue | Symptom |
|--------|---------|
| Only `focal_seat_booking_v3.html` uploaded, not `focal_seat_booking_app.js` | Console: 404 on `.js` file |
| Old file still on SharePoint | Fixes not present |
| `localStorage` blocked | App should still render (in-memory mode) **if JS runs** |

---

## Required files (upload both to the same folder)

| File | Purpose |
|------|---------|
| `focal_seat_booking_v3.html` | UI |
| `focal_seat_booking_app.js` | All application logic |

---

## Working deployment options

### Option A — **Iframe on a SharePoint site page** (same tenant)

1. Upload **both** files to a library (e.g. `Shared Documents` / `Site Assets`).
2. Copy the **direct path** to the HTML file (not the short `:u:` sharing link).
   - Example shape:  
     `https://focalproject.sharepoint.com/sites/VKPer/Shared%20Documents/Seat%20Booking_v2/focal_seat_booking_v3.html`
3. Create or edit a **Site page** → add **Embed** (or edit page source if allowed).
4. Paste an iframe that **allows scripts**:

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  src="PASTE_YOUR_DIRECT_HTML_URL_HERE"
  width="100%"
  height="900"
  style="border:none;"
  title="Seat Booking">
</iframe>
```

5. Publish the page and open **the page URL**, not the raw file preview in the library.

**Note:** Some tenants still block this. If it fails, use Option B or C.

---

### Option B — **Host outside SharePoint** (most reliable)

Host the same two files on:

- **Azure Static Web Apps** / Blob static website  
- **GitHub Pages**  
- Any HTTPS static host  

Then embed that URL in SharePoint with the iframe above, and add the host to **HTML Field Security** (allowed iframe domains) if required:

**Site settings → HTML Field Security → allow your host domain.**

---

### Option C — **Open locally** (testing / single PC)

1. Download both files to the same folder on your PC.  
2. Double-click `focal_seat_booking_v3.html` (or open with Chrome/Edge).  
3. Works without SharePoint restrictions.

---

### Option D — **SharePoint Framework (SPFx)** (enterprise)

For long-term support inside Microsoft 365, rebuild as an **SPFx web part**. Custom HTML+JS in libraries is not a supported pattern for modern CSP.

---

## How to confirm in the browser (F12)

On the broken SharePoint page:

1. Press **F12** → **Console**.
2. If you see **no** `[FocalBooking] Script loaded` message → scripts never ran (viewer/sandbox).
3. If you see `Script loaded` but errors → share the error text (different problem).
4. **Network** tab: check `focal_seat_booking_app.js` — must be **200**, not 404.

---

## Admin / tenant settings (IT)

Sometimes required (varies by tenant):

- `Set-SPOSite -Identity "https://tenant.sharepoint.com/sites/YOURSITE" -DenyAddAndCustomizePages $false`
- Classic: allow custom script (where still applicable)
- Allow iframe domain for your external host (Option B)

Changes can take time to propagate.

---

## Summary

| Open method | JS usually runs? |
|-------------|------------------|
| Click HTML file in document library | **Often NO** |
| `:u:` / Office preview link | **Often NO** |
| Site page + iframe with `allow-scripts` + direct HTML URL | **Sometimes YES** |
| Azure / GitHub / local file | **YES** |

The app code is fine locally because the OS browser runs JavaScript. SharePoint’s **viewer** often does not.
