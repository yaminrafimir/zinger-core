import SwiftUI

struct ShopListView: View {
    @Environment(AppState.self) private var appState
    @State private var shops: [Shop] = []
    @State private var total = 0
    @State private var query = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var loadedOnce = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Shops")
                .navigationDestination(for: Shop.self) { ShopDetailView(shop: $0) }
                .searchable(text: $query, prompt: "Search shops")
                .refreshable { await reload() }
                .task { if !loadedOnce { await reload() } }
                .task(id: query) {
                    // Debounce; the server only searches names longer than 3 characters.
                    guard loadedOnce else { return }
                    try? await Task.sleep(for: .milliseconds(350))
                    guard !Task.isCancelled else { return }
                    await reload()
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let error, shops.isEmpty {
            ErrorStateView(message: error) { await reload() }
        } else if shops.isEmpty && isLoading {
            ProgressView("Finding shops…").frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if shops.isEmpty && loadedOnce {
            ContentUnavailableView(searchTerm.isEmpty ? "No shops yet" : "No results",
                                   systemImage: "storefront",
                                   description: Text(searchTerm.isEmpty
                                                     ? "Shops will appear here once they're open on Zinger."
                                                     : "No shops match “\(query)”."))
        } else {
            List {
                ForEach(shops) { shop in
                    NavigationLink(value: shop) { ShopRow(shop: shop) }
                        .onAppear { if shop == shops.last { Task { await loadMore() } } }
                }
                if isLoading && !shops.isEmpty {
                    HStack { Spacer(); ProgressView(); Spacer() }.listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
        }
    }

    private var searchTerm: String {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        return trimmed.count > 3 ? trimmed : ""
    }

    private func reload() async {
        isLoading = true
        defer { isLoading = false; loadedOnce = true }
        do {
            let response = try await appState.shops(name: searchTerm.isEmpty ? nil : searchTerm, offset: 0)
            shops = response.shops
            total = response.total ?? response.shops.count
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadMore() async {
        guard !isLoading, shops.count < total else { return }
        isLoading = true
        defer { isLoading = false }
        if let response = try? await appState.shops(name: searchTerm.isEmpty ? nil : searchTerm, offset: shops.count) {
            let known = Set(shops.map(\.id))
            shops += response.shops.filter { !known.contains($0.id) }
            total = response.total ?? total
        }
    }
}

private struct ShopRow: View {
    let shop: Shop

    var body: some View {
        HStack(spacing: 14) {
            RemoteImage(url: shop.icon, symbol: "storefront")
                .frame(width: 60, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(shop.name).font(.headline)
                if let area = shop.area, !area.isEmpty {
                    Label(area, systemImage: "mappin.and.ellipse")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let tags = shop.tags, !tags.isEmpty {
                    Text(tags.prefix(3).joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
