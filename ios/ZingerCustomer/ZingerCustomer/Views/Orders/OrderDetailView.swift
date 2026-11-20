import SwiftUI

struct OrderDetailView: View {
    @State var order: Order
    var onChange: (Order) -> Void = { _ in }

    @Environment(AppState.self) private var appState
    @State private var isWorking = false
    @State private var error: String?
    @State private var confirmCancel = false
    @State private var rating = 0

    var body: some View {
        List {
            Section {
                VStack(spacing: 14) {
                    StatusTimeline(status: order.orderStatus)
                    StatusBadge(status: order.orderStatus)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }

            Section("Items") {
                ForEach(order.items ?? []) { item in
                    HStack(alignment: .top) {
                        Text("\(item.quantity)×").monospacedDigit().foregroundStyle(.secondary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.itemName ?? "Item")
                            if !item.variantLabel.isEmpty {
                                Text(item.variantLabel).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Text(Money.format(item.totalPrice)).monospacedDigit()
                    }
                }
                if let tax = order.tax, tax > 0 {
                    LabeledContent("Tax", value: Money.format(tax))
                }
                LabeledContent("Total") {
                    Text(Money.format(order.total)).bold().monospacedDigit()
                }
            }

            Section("Details") {
                LabeledContent("Order", value: "#\(order.shortId)")
                if !order.displayDate.isEmpty { LabeledContent("Placed", value: order.displayDate) }
                if let payment = order.paymentStatus {
                    LabeledContent("Payment", value: payment.replacingOccurrences(of: "_", with: " ").capitalized)
                }
            }

            if let address = order.shippingAddr, !address.singleLine.isEmpty {
                Section("Delivery address") {
                    VStack(alignment: .leading, spacing: 2) {
                        if !address.name.isEmpty { Text(address.name).bold() }
                        Text(address.singleLine).foregroundStyle(.secondary)
                    }
                }
            }

            if order.orderStatus.isFinal {
                Section {
                    HStack {
                        ForEach(1...5, id: \.self) { star in
                            Image(systemName: star <= rating ? "star.fill" : "star")
                                .font(.title2)
                                .foregroundStyle(.yellow)
                                .onTapGesture { Task { await rate(star) } }
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .disabled(isWorking)
                } header: {
                    Text("Rate this order")
                }
            }

            if let error { Section { InlineError(message: error) } }

            if order.orderStatus.canCancel {
                Section {
                    Button("Cancel Order", role: .destructive) { confirmCancel = true }
                        .frame(maxWidth: .infinity)
                        .disabled(isWorking)
                }
            }
        }
        .navigationTitle("Order #\(order.shortId)")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await refresh() }
        .onAppear { rating = Int((order.rating ?? 0).rounded()) }
        .confirmationDialog("Cancel this order?", isPresented: $confirmCancel, titleVisibility: .visible) {
            Button("Cancel Order", role: .destructive) { Task { await cancel() } }
            Button("Keep Order", role: .cancel) {}
        }
    }

    private func apply(_ updated: Order) {
        withAnimation { order = updated }
        onChange(updated)
    }

    private func refresh() async {
        do { apply(try await appState.order(id: order.id)) } catch { self.error = error.localizedDescription }
    }

    private func cancel() async {
        isWorking = true
        defer { isWorking = false }
        do {
            apply(try await appState.cancelOrder(id: order.id))
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func rate(_ stars: Int) async {
        let previous = rating
        rating = stars
        isWorking = true
        defer { isWorking = false }
        do {
            apply(try await appState.rateOrder(id: order.id, rating: Double(stars)))
            error = nil
        } catch {
            rating = previous
            self.error = error.localizedDescription
        }
    }
}

private struct StatusTimeline: View {
    let status: OrderStatus
    private let steps: [OrderStatus] = [.placed, .deliveryPending, .delivered]

    var body: some View {
        if status == .cancelled {
            Label("This order was cancelled", systemImage: "xmark.octagon.fill")
                .foregroundStyle(.red)
                .font(.headline)
        } else {
            let current = steps.firstIndex(of: status) ?? -1
            HStack(spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    VStack(spacing: 6) {
                        Image(systemName: index <= current ? "checkmark.circle.fill" : "circle")
                            .font(.title2)
                            .foregroundStyle(index <= current ? Color.accentColor : Color.secondary)
                        Text(step.title)
                            .font(.caption2)
                            .foregroundStyle(index <= current ? Color.primary : Color.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    if index < steps.count - 1 {
                        Rectangle()
                            .fill(index < current ? Color.accentColor : Color.secondary.opacity(0.3))
                            .frame(height: 2)
                            .frame(maxWidth: 40)
                            .offset(y: -10)
                    }
                }
            }
        }
    }
}
