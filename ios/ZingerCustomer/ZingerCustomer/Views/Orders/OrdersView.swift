import SwiftUI

struct OrdersView: View {
    @Environment(AppState.self) private var appState
    @State private var orders: [Order] = []
    @State private var nextPageToken: String?
    @State private var isLoading = false
    @State private var loadedOnce = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if let error, orders.isEmpty {
                    ErrorStateView(message: error) { await reload() }
                } else if orders.isEmpty && !loadedOnce {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if orders.isEmpty {
                    ContentUnavailableView("No orders yet", systemImage: "bag",
                                           description: Text("Orders you place will show up here."))
                } else {
                    List {
                        ForEach(orders) { order in
                            NavigationLink(value: order) { OrderRow(order: order) }
                                .onAppear { if order == orders.last { Task { await loadMore() } } }
                        }
                        if isLoading { HStack { Spacer(); ProgressView(); Spacer() } }
                    }
                }
            }
            .navigationTitle("Orders")
            .navigationDestination(for: Order.self) { order in
                OrderDetailView(order: order) { updated in
                    if let index = orders.firstIndex(where: { $0.id == updated.id }) { orders[index] = updated }
                }
            }
            .refreshable { await reload() }
            // Refresh whenever the tab appears so a newly placed order is listed.
            .onAppear { Task { await reload() } }
        }
    }

    private func reload() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false; loadedOnce = true }
        do {
            let response = try await appState.orders(nextPageToken: nil)
            orders = response.orders.filter { $0.orderStatus != .created }
            nextPageToken = response.nextPageToken
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadMore() async {
        guard !isLoading, let token = nextPageToken else { return }
        isLoading = true
        defer { isLoading = false }
        if let response = try? await appState.orders(nextPageToken: token) {
            let known = Set(orders.map(\.id))
            orders += response.orders.filter { !known.contains($0.id) && $0.orderStatus != .created }
            nextPageToken = response.nextPageToken
        }
    }
}

private struct OrderRow: View {
    let order: Order

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: order.orderStatus.symbol)
                .font(.title2)
                .foregroundStyle(order.orderStatus.color)
                .frame(width: 36)
            VStack(alignment: .leading, spacing: 3) {
                Text("Order #\(order.shortId)").font(.headline)
                Text(order.items?.map(\.itemName).compactMap { $0 }.joined(separator: ", ") ?? "")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(order.displayDate).font(.caption).foregroundStyle(.tertiary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(Money.format(order.total)).font(.subheadline.weight(.semibold).monospacedDigit())
                StatusBadge(status: order.orderStatus)
            }
        }
        .padding(.vertical, 4)
    }
}

struct StatusBadge: View {
    let status: OrderStatus

    var body: some View {
        Text(status.title)
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.color.opacity(0.15), in: Capsule())
            .foregroundStyle(status.color)
    }
}

extension OrderStatus {
    var color: Color {
        switch self {
        case .created: return .gray
        case .placed: return .blue
        case .deliveryPending: return .orange
        case .delivered: return .green
        case .cancelled: return .red
        case .unknown: return .gray
        }
    }
}
