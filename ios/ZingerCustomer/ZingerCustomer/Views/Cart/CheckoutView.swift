import SwiftUI

struct CheckoutView: View {
    let onPlaced: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(Cart.self) private var cart
    @Environment(\.dismiss) private var dismiss
    @State private var address = Address()
    @State private var isPlacing = false
    @State private var error: String?
    @State private var placedOrder: Order?

    var body: some View {
        Group {
            if let placedOrder {
                OrderPlacedView(order: placedOrder, onDone: onPlaced)
            } else {
                form
            }
        }
        .navigationTitle(placedOrder == nil ? "Checkout" : "")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(isPlacing)
        .onAppear {
            if !address.isComplete {
                address = cart.savedAddress
                if address.name.isEmpty { address.name = appState.profile?.name ?? "" }
            }
        }
    }

    private var form: some View {
        Form {
            Section("Deliver to") {
                TextField("Full name", text: $address.name).textContentType(.name)
                TextField("House no. & street", text: $address.street).textContentType(.fullStreetAddress)
                TextField("Area / locality", text: $address.area).textContentType(.sublocality)
                TextField("City", text: $address.city).textContentType(.addressCity)
                TextField("State", text: $address.state).textContentType(.addressState)
                TextField("PIN code", text: $address.pincode)
                    .textContentType(.postalCode)
                    .keyboardType(.numberPad)
            }

            Section("Order from \(cart.shop?.name ?? "shop")") {
                ForEach(cart.lines) { line in
                    HStack {
                        Text("\(line.quantity)×").monospacedDigit().foregroundStyle(.secondary)
                        Text(line.item.name)
                        Spacer()
                        Text(Money.format(line.subtotal)).monospacedDigit()
                    }
                }
                HStack {
                    Text("Total").bold()
                    Spacer()
                    Text(Money.format(cart.total)).bold().monospacedDigit()
                }
            }

            Section {
                Label("Pay the shop on delivery", systemImage: "banknote")
            } header: {
                Text("Payment")
            }

            if let error {
                Section { InlineError(message: error) }
            }

            Section {
                PrimaryButton(title: "Place Order", isLoading: isPlacing, isDisabled: !address.isComplete) {
                    await placeOrder()
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }.disabled(isPlacing)
            }
        }
    }

    private func placeOrder() async {
        isPlacing = true
        defer { isPlacing = false }
        do {
            let order = try await appState.placeOrder(cart: cart, address: address)
            cart.saveAddress(address)
            cart.clear()
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation { placedOrder = order }
        } catch {
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }
}

private struct OrderPlacedView: View {
    let order: Order
    let onDone: () -> Void
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 88))
                .foregroundStyle(.green)
                .scaleEffect(appeared ? 1 : 0.4)
                .opacity(appeared ? 1 : 0)
            Text("Order placed!").font(.title.bold())
            Text("Order #\(order.shortId) · \(Money.format(order.total))")
                .foregroundStyle(.secondary)
            Text("The shop will confirm it shortly. You can track it in Orders.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
            Spacer()
            PrimaryButton(title: "View My Orders") { onDone() }
                .padding()
        }
        .onAppear {
            withAnimation(.spring(response: 0.45, dampingFraction: 0.6)) { appeared = true }
        }
    }
}
