import SwiftUI

@main
struct ZingerApp: App {
    @State private var appState = AppState()
    @State private var cart = Cart()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .environment(cart)
                .tint(.accentColor)
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isSignedIn {
                MainTabView()
                    .transition(.opacity)
            } else {
                WelcomeView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: appState.isSignedIn)
    }
}

struct MainTabView: View {
    @Environment(Cart.self) private var cart
    @State private var selection: Tab = .shops

    enum Tab: Hashable { case shops, cart, orders, profile }

    var body: some View {
        TabView(selection: $selection) {
            ShopListView()
                .tabItem { Label("Shops", systemImage: "storefront") }
                .tag(Tab.shops)

            CartView(onOrderPlaced: { selection = .orders })
                .tabItem { Label("Cart", systemImage: "cart") }
                .badge(cart.count)
                .tag(Tab.cart)

            OrdersView()
                .tabItem { Label("Orders", systemImage: "bag") }
                .tag(Tab.orders)

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                .tag(Tab.profile)
        }
    }
}
