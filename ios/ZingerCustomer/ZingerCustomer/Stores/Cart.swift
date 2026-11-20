import Foundation
import Observation

/// Local shopping cart. Zinger orders belong to a single shop, so the cart holds items from one shop at a time.
@Observable
@MainActor
final class Cart {
    struct Line: Codable, Hashable, Identifiable {
        let item: Item
        let variant: ItemVariant
        var quantity: Int

        var id: String { "\(item.id)-\(variant.id)" }
        var subtotal: Double { variant.price * Double(quantity) }
    }

    private static let storageKey = "cart.v1"
    private static let addressKey = "cart.lastAddress"

    private(set) var shop: Shop?
    private(set) var lines: [Line] = []
    private(set) var savedAddress: Address

    var count: Int { lines.reduce(0) { $0 + $1.quantity } }
    var total: Double { lines.reduce(0) { $0 + $1.subtotal } }
    var isEmpty: Bool { lines.isEmpty }

    init() {
        savedAddress = Self.loadAddress()
        restore()
    }

    func quantity(of item: Item, variant: ItemVariant) -> Int {
        lines.first { $0.item.id == item.id && $0.variant.id == variant.id }?.quantity ?? 0
    }

    /// Returns false when the item belongs to a different shop than what is already in the cart.
    func canAdd(from shop: Shop) -> Bool {
        self.shop == nil || self.shop?.id == shop.id || lines.isEmpty
    }

    func add(_ item: Item, variant: ItemVariant, from shop: Shop, quantity: Int = 1) {
        if !canAdd(from: shop) { clear() }
        self.shop = shop
        if let index = lines.firstIndex(where: { $0.item.id == item.id && $0.variant.id == variant.id }) {
            lines[index].quantity += quantity
        } else {
            lines.append(Line(item: item, variant: variant, quantity: quantity))
        }
        persist()
    }

    func setQuantity(_ quantity: Int, for line: Line) {
        guard let index = lines.firstIndex(where: { $0.id == line.id }) else { return }
        if quantity <= 0 {
            lines.remove(at: index)
        } else {
            lines[index].quantity = quantity
        }
        if lines.isEmpty { shop = nil }
        persist()
    }

    func remove(at offsets: IndexSet) {
        lines.remove(atOffsets: offsets)
        if lines.isEmpty { shop = nil }
        persist()
    }

    func clear() {
        lines = []
        shop = nil
        persist()
    }

    // MARK: Persistence

    private struct Snapshot: Codable {
        let shop: Shop?
        let lines: [Line]
    }

    private func persist() {
        let data = try? JSONEncoder().encode(Snapshot(shop: shop, lines: lines))
        UserDefaults.standard.set(data, forKey: Self.storageKey)
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        shop = snapshot.shop
        lines = snapshot.lines
    }

    func saveAddress(_ address: Address) {
        savedAddress = address
        UserDefaults.standard.set(try? JSONEncoder().encode(address), forKey: Self.addressKey)
    }

    private static func loadAddress() -> Address {
        guard let data = UserDefaults.standard.data(forKey: addressKey),
              let address = try? JSONDecoder().decode(Address.self, from: data) else { return Address() }
        return address
    }
}
