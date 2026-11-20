# Zinger web app (iPhone, no Mac needed)

A customer app that runs in Safari and installs to the iPhone home screen. It is one file (`index.html`) with no build step, and the Zinger Core server hosts it from `public/app/`.

It has the same features as the native app in `ios/`: sign in or sign up (password or one-time code), browse shops and menus, a cart, checkout, order tracking with cancel and rating, profile, signed-in devices, and a demo mode with sample shops.

## Put it on your iPhone
1. Run your Zinger Core server so it's reachable on the internet at an `api.` address, e.g. `https://api.yourshop.com`. In production, set `RAILS_SERVE_STATIC_FILES=1` so Rails serves `public/`.
2. On your iPhone, open **Safari** and go to `https://api.yourshop.com/app/`.
3. Tap **Share** → **Add to Home Screen** → **Add**.

Zinger now has its own icon and opens full-screen like a normal app. Because the page comes from the same address as the API, it connects automatically, with no CORS setup.

To try it before your server is ready, tap **Try the demo with sample shops** on the sign-in screen. Any password with 6+ characters works, and the one-time code is `123456`.

## Notes
- Use HTTPS in production. Safari only treats the site as a home-screen app with full features over HTTPS.
- If you host the page somewhere else (a different domain), set the server address in the app under **Profile → Server**, and allow that origin in `config/initializers/cors.rb`, which is currently disabled in production.
- Uploads such as shop photos load from wherever `Core::Storage` serves them.
