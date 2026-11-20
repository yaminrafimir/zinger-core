# Zinger for iPhone

A native SwiftUI customer app for Zinger Core. It uses the `/v2` customer API in this repo.

## Features
- **Sign in** with a password or a one-time code, **create an account** (verified by OTP), and **reset a forgotten password**
- **Browse shops**: search, open/closed status, address, tap-to-call
- **Shop menus**: grouped by category, searchable, variant picker (size, etc.), quantity
- **Cart**: one shop at a time (matches how Zinger orders work), saved between launches
- **Checkout**: delivery address (remembered), creates and places the order
- **Orders**: history with status timeline, cancel, 1–5 star rating
- **Profile**: edit name, change password, view and sign out other devices
- **Server setting**: point the app at your own Zinger Core deployment

Requires iOS 17+. Light and dark mode.

## Run it on your iPhone
You need a Mac with **Xcode 15 or newer**. A free Apple ID works for installing on your own phone.

1. Open `ios/ZingerCustomer/ZingerCustomer.xcodeproj` in Xcode.
2. Select the **ZingerCustomer** target → **Signing & Capabilities** → choose your **Team** (add your Apple ID under Xcode → Settings → Accounts if needed). If Xcode reports the bundle ID is taken, change `pw.zinger.customer` to something unique, e.g. `com.yourname.zinger`.
3. Connect your iPhone by USB (or the same Wi-Fi), pick it as the run destination, and press **Run** (⌘R).
4. First run only: on the iPhone, open **Settings → General → VPN & Device Management**, trust your developer certificate, then enable **Developer Mode** if iOS asks.

Apps signed with a free Apple ID expire after 7 days. Press Run again to reinstall. A paid developer account lasts a year and lets you use TestFlight.

## Connect it to your server
On the sign-in screen, tap the server icon (top right). You can also change it later under **Profile → Server**. Enter your customer API address, for example `https://api.yourshop.com`.

- The backend only serves customer routes on the **`api.` subdomain** (`config/routes.rb`), so the host must start with `api.`.
- The default `http://api.zinger.pw` only works in the **Simulator** on a Mac whose `/etc/hosts` maps it to `127.0.0.1` (see the root README). A real iPhone needs a server it can reach.
- Plain HTTP is allowed for development (`Info.plist`). Remove `NSAllowsArbitraryLoads` before an App Store release if your API uses HTTPS.

## Project layout
```
ZingerCustomer/
  App/          App entry, tab bar
  Networking/   API client (JSON envelope + error parsing), Keychain token storage
  Models/       Codable models matching the Rails as_json output
  Stores/       AppState (session + API calls), Cart
  Views/        Auth, Shops, Cart, Orders, Profile, shared components
```
