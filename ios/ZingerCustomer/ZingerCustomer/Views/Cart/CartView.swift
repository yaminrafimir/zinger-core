import SwiftUI

struct CartView: View {
    var onOrderPlaced: () -> Void = {}

    @Environment(Cart.self) private var cart
    @State private var showCheckout = false

    var body: some View {
        NavigationStack {
            Group {
                if cart.isEmpty {
                    ContentUnavailableView("Your cart is empty", systemImage: "cart",
                                           description: Text("Browse shops and tap an item to add it."))
                } else {
                    List {
                        if let shop = cart.shop {
                            Section {
                                HStack(spacing: 12) {
                                    RemoteImage(url: shop.icon, symbol: "storefront")
                                        .frame(width: 40, height: 40)
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    VStack(alignment: .leading) {
                                        Text(shop.name).font(.headline)
                                        if let area = shop.area { Text(area).font(.caption).foregroundStyle(.secondary) }
                                    }
                                }
                            }
                        }

                        Section("Items") {
                            ForEach(cart.lines) { line in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(line.item.name).font(.body.weight(.medium))
                                        if !line.variant.label.isEmpty {
                                            Text(line.variant.label).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Text(Money.format(line.subtotal))
                                            .font(.subheadline.monospacedDigit())
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    QuantityStepper(quantity: line.quantity) { cart.setQuantity($0, for: line) }
                                }
                            }
                            .onDelete { cart.remove(at: $0) }
                        }

                        Section {
                            HStack {
                                Text("Subtotal").font(.headline)
                                Spacer()
                                Text(Money.format(cart.total)).font(.headline.monospacedDigit())
                            }
                        } footer: {
                            Text("Taxes, if any, are added by the shop when your order is confirmed.")
                        }
                    }
                    .safeAreaInset(edge: .bottom) {
                        PrimaryButton(title: "Checkout · \(Money.format(cart.total))") { showCheckout = true }
                            .padding()
                            .background(.bar)
                    }
                }
            }
            .navigationTitle("Cart")
            .toolbar {
                if !cart.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Clear", role: .destructive) { withAnimation { cart.clear() } }
                    }
                }
            }
            .sheet(isPresented: $showCheckout) {
                NavigationStack {
                    CheckoutView {
                        showCheckout = false
                        onOrderPlaced()
                    }
                }
            }
        }
    }
}
