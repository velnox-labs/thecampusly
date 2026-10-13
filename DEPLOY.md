# Campusly: publish checklist

## 1. Firebase console (project: thecampusly), one time
1. **Authentication > Sign-in method**: enable **Email/Password** and **Google**.
2. **Authentication > Settings > Authorised domains**: add your live domain (for example `yourapp.vercel.app` or `thecampusly.web.app`).
3. **Firestore Database > Create database** (production mode, nearest region).
4. **Firestore > Rules**: paste `firestore.rules` and **Publish**. This keeps every user's data private.
5. Optional: restrict the browser API key to your domain(s) in Google Cloud Console > Credentials.

## 2. Upload everything in this folder (keep the same structure)
```
auth.html  index.html (the app shell)  home.html  attendance.html  schedule.html  tasks.html  more.html
campusly-firebase.js   pwa.js   sw.js   manifest.webmanifest   offline.html   pwa-check.html
icons/ (icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, favicon-32.png)
firestore.rules   firebase.json   vercel.json
```
- **Firebase Hosting**: `npm i -g firebase-tools`, `firebase login`, `firebase deploy --only hosting,firestore:rules`
- **Vercel / Netlify**: upload the folder as a static site (no build step).
- Must be served over **https** (or localhost). Opening files from disk will not work.

## 3. Installing as an app (PWA)
- **Android / Chrome / Edge**: an "Install Campusly" bar appears on the dashboard, and More > Install app. 
- **iPhone**: Safari > Share > Add to Home Screen (More > Install app shows these steps).
- Pages you have opened keep working offline. Changes made offline upload automatically when the connection returns.

## Install not working? Open `your-site/pwa-check.html`
It tests your live site and shows what is wrong (not https, missing files, manifest, service worker, in-app browser). Common fixes:
- The site must open from an **https://** link (Firebase Hosting or Vercel). Local files and preview links cannot be installed.
- Upload **all** files including the `icons/` folder, `manifest.webmanifest` and `sw.js` in the same folder as the pages.
- **Android**: use Chrome. Menu (⋮) > Install app. If you dismissed the bar, use More > Install app.
- **iPhone**: use Safari only. Share > Add to Home Screen.
- Links opened inside WhatsApp or Instagram cannot install. Open in Chrome or Safari.

## 4. Shipping an update (important)
Installed apps keep the cached files until `sw.js` changes. Every time you deploy new files:
1. Open `sw.js` and change `const VERSION = "campusly-v1";` to `"campusly-v2"` (then v3, and so on).
2. Deploy. Users see "A new version of Campusly is ready. Refresh".

## 5. How it behaves
- Signed-out visitors go to `auth.html`; signed-in visitors skip it.
- Data lives in `users/{uid}` and syncs automatically. Theme stays per device.
- If Firebase cannot load (offline), pages work from the data saved on this device.
