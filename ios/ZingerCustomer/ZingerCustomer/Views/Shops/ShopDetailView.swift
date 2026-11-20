import SwiftUI

struct ShopDetailView: View {
    let shop: Shop

    @Environment(AppState.self) private var appState
    @Environment(Cart.self) private var cart
    @State private var detail: ShopDetail?
    @State private var items: [Item] = []
    @State private var total = 0
    @State private var query = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var selectedItem: Item?

    var body: some View {
        List {
            Section { header }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)

            if let error, items.isEmpty {
                ErrorStateView(message: error) { await load() }
                    .listRowBackground(Color.clear)
            } else if items.isEmpty && !isLoading {
                ContentUnavailableView(query.count > 3 ? "No matching items" : "Nothing on the menu yet",
                                       systemImage: "basket")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(groupedItems) { group in
                    Section(group.category) {
                        ForEach(group.items) { item in
                            ItemRow(item: item, inCart: quantityInCart(item)) { selectedItem = item }
                                .onAppear { if item == items.last { Task { await loadMore() } } }
                        }
                    }
                }
            }

            if isLoading {
                HStack { Spacer(); ProgressView(); Spacer() }.listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(shop.name)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Search this shop")
        .task { await load() }
        .task(id: query) {
            guard detail != nil else { return }
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await loadItems()
        }
        .refreshable { await load() }
        .sheet(item: $selectedItem) { item in
            ItemDetailSheet(item: item, shop: shop)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .safeAreaInset(edge: .bottom) {
            if !cart.isEmpty && cart.shop?.id == shop.id {
                CartSummaryBar()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .bottomLeading) {
                RemoteImage(url: detail?.coverPhotos?.first?.url ?? shop.icon, symbol: "storefront")
                    .frame(height: 170)
                    .frame(maxWidth: .infinity)
                    .clipped()
                LinearGradient(colors: [.clear, .black.opacity(0.55)], startPoint: .center, endPoint: .bottom)
                HStack(alignment: .bottom, spacing: 12) {
                    RemoteImage(url: shop.icon, symbol: "storefront")
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(.white, lineWidth: 2))
                    Text(shop.name)
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                        .lineLimit(2)
                }
                .padding(14)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            if let detail {
                VStack(alignment: .leading, spacing: 8) {
                    if let open = detail.openNow {
                        HStack(spacing: 6) {
                            Circle().fill(open ? Color.green : Color.red).frame(width: 8, height: 8)
                            Text(open ? "Open now" : "Closed")
                                .font(.subheadline.weight(.semibold))
                            if let opening = detail.openingTime, let closing = detail.closingTime {
                                Text("· \(opening) – \(closing)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    if !detail.formattedAddress.isEmpty {
                        Label(detail.formattedAddress, systemImage: "mappin.and.ellipse")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    if let phone = detail.mobile ?? detail.telephone, !phone.isEmpty,
                       let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                        Link(destination: url) {
                            Label(phone, systemImage: "phone.fill").font(.subheadline)
                        }
                    }
                    if let tags = detail.tags, !tags.isEmpty { TagChips(tags: tags) }
                }
                .padding(.horizontal, 4)
            }
        }
        .padding(.bottom, 8)
    }

    private struct ItemGroup: Identifiable {
        let category: String
        let items: [Item]
        var id: String { category }
    }

    private var groupedItems: [ItemGroup] {
        let groups = Dictionary(grouping: items) { ($0.category?.isEmpty == false ? $0.category! : "Other").capitalized }
        return groups.keys.sorted().map { ItemGroup(category: $0, items: groups[$0] ?? []) }
    }

    private func quantityInCart(_ item: Item) -> Int {
        guard cart.shop?.id == shop.id else { return 0 }
        return cart.lines.filter { $0.item.id == item.id }.reduce(0) { $0 + $1.quantity }
    }

    private func load() async {
        async let detailResult = try? appState.shop(id: shop.id)
        await loadItems()
        detail = await detailResult
    }

    private func loadItems() async {
        isLoading = true
        defer { isLoading = false }
        let name = query.trimmingCharacters(in: .whitespaces)
        do {
            let response = try await appState.items(shopId: shop.id, name: name.count > 3 ? name : nil, offset: 0)
            items = response.items
            total = response.total ?? response.items.count
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadMore() async {
        guard !isLoading, items.count < total else { return }
        isLoading = true
        defer { isLoading = false }
        let name = query.trimmingCharacters(in: .whitespaces)
        if let response = try? await appState.items(shopId: shop.id, name: name.count > 3 ? name : nil, offset: items.count) {
            let known = Set(items.map(\.id))
            items += response.items.filter { !known.contains($0.id) }
        }
    }
}

private struct ItemRow: View {
    let item: Item
    let inCart: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name).font(.headline).foregroundStyle(.primary)
                    if let description = item.description, !description.isEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    HStack(spacing: 8) {
                        if let price = item.startingPrice {
                            Text((item.sortedVariants.count > 1 ? "from " : "") + Money.format(price))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                        }
                        if inCart > 0 {
                            Text("\(inCart) in cart")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 8).padding(.vertical, 2)
                                .background(Color.accentColor, in: Capsule())
                                .foregroundStyle(.white)
                        }
                    }
                }
                Spacer(minLength: 8)
                ZStack(alignment: .bottomTrailing) {
                    RemoteImage(url: item.icon ?? item.coverPhotos?.first?.url, symbol: "fork.knife")
                        .frame(width: 76, height: 76)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(.white, Color.accentColor)
                        .offset(x: 6, y: 6)
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct CartSummaryBar: View {
    @Environment(Cart.self) private var cart

    var body: some View {
        HStack {
            Image(systemName: "cart.fill")
            Text("\(cart.count) item\(cart.count == 1 ? "" : "s")")
            Spacer()
            Text(Money.format(cart.total)).monospacedDigit()
        }
        .font(.headline)
        .foregroundStyle(.white)
        .padding()
        .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.horizontal)
        .padding(.bottom, 6)
        .shadow(color: .black.opacity(0.15), radius: 8, y: 4)
    }
}
