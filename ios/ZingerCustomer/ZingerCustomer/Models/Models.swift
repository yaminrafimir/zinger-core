import Foundation

// MARK: - Shops

struct Photo: Codable, Hashable, Identifiable {
    let id: Int
    let url: String?
}

/// `Shop#as_json('ui_shop')`
struct Shop: Codable, Hashable, Identifiable {
    let id: Int
    let name: String
    let icon: String?
    let tags: [String]?
    let area: String?
}

/// `Shop#as_json('ui_shop_detail')`
struct ShopDetail: Codable, Hashable, Identifiable {
    let id: Int
    let name: String
    let icon: String?
    let tags: [String]?
    let address: [String: JSONValue]?
    let telephone: String?
    let mobile: String?
    let coverPhotos: [Photo]?
    let openingTime: String?
    let closingTime: String?
    let openNow: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, icon, tags, address, telephone, mobile
        case coverPhotos = "cover_photos"
        case openingTime = "opening_time"
        case closingTime = "closing_time"
        case openNow = "open_now"
    }

    var formattedAddress: String {
        guard let address else { return "" }
        let order = ["number", "street", "area", "city", "state", "pincode"]
        let known = order.compactMap { address[$0]?.stringValue }.filter { !$0.isEmpty }
        let rest = address.keys.filter { !order.contains($0) }.sorted().compactMap { address[$0]?.stringValue }
        return (known + rest).joined(separator: ", ")
    }
}

struct ShopListResponse: Decodable {
    let shops: [Shop]
    let total: Int?
}

struct ShopResponse: Decodable {
    let shop: ShopDetail
}

// MARK: - Items

struct ItemVariant: Codable, Hashable, Identifiable {
    let id: String
    let value: String?
    let price: Double
    let referenceId: String?
    let availability: Int?

    enum CodingKeys: String, CodingKey {
        case id, value, price, availability
        case referenceId = "reference_id"
    }

    var label: String {
        [referenceId?.replacingOccurrences(of: "_", with: " ").capitalized, value]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ": ")
    }

    var isInStock: Bool { availability.map { $0 > 0 } ?? true }
}

/// `Item#as_json('ui_item')`
struct Item: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let itemType: String?
    let category: String?
    let icon: String?
    let description: String?
    let variants: [ItemVariant]?
    let coverPhotos: [Photo]?

    enum CodingKeys: String, CodingKey {
        case id, name, category, icon, description, variants
        case itemType = "item_type"
        case coverPhotos = "cover_photos"
    }

    var sortedVariants: [ItemVariant] { (variants ?? []).sorted { $0.price < $1.price } }
    var startingPrice: Double? { sortedVariants.first?.price }
}

struct ItemListResponse: Decodable {
    let items: [Item]
    let total: Int?
}

// MARK: - Orders

struct Address: Codable, Hashable {
    var name = ""
    var street = ""
    var area = ""
    var city = ""
    var state = ""
    var pincode = ""

    init() {}

    init(from decoder: Decoder) throws {
        // Address fields are stored as free-form JSON on the server, so tolerate numbers/nulls.
        let raw = try [String: JSONValue](from: decoder)
        name = raw["name"]?.stringValue ?? ""
        street = raw["street"]?.stringValue ?? ""
        area = raw["area"]?.stringValue ?? ""
        city = raw["city"]?.stringValue ?? ""
        state = raw["state"]?.stringValue ?? ""
        pincode = raw["pincode"]?.stringValue ?? ""
    }

    var isComplete: Bool {
        ![name, street, area, city, state, pincode].contains { $0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    var singleLine: String {
        [street, area, city, state, pincode].filter { !$0.isEmpty }.joined(separator: ", ")
    }
}

struct OrderItem: Codable, Hashable, Identifiable {
    let id: String
    let itemId: String?
    let itemName: String?
    let itemVariantName: String?
    let itemVariantValue: String?
    let quantity: Int
    let actualPrice: Double?
    let totalPrice: Double?

    enum CodingKeys: String, CodingKey {
        case id, quantity
        case itemId = "item_id"
        case itemName = "item_name"
        case itemVariantName = "item_variant_name"
        case itemVariantValue = "item_variant_value"
        case actualPrice = "actual_price"
        case totalPrice = "total_price"
    }

    var variantLabel: String {
        [itemVariantName?.replacingOccurrences(of: "_", with: " ").capitalized, itemVariantValue]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ": ")
    }
}

struct OrderTransaction: Codable, Hashable, Identifiable {
    let id: String
    let amount: Double?
    let txnStatus: String?
    let txnType: String?
    let paymentMethod: String?

    enum CodingKeys: String, CodingKey {
        case id, amount
        case txnStatus = "txn_status"
        case txnType = "txn_type"
        case paymentMethod = "payment_method"
    }
}

enum OrderStatus: String, Codable, CaseIterable {
    case created, placed
    case deliveryPending = "delivery_pending"
    case delivered, cancelled
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = OrderStatus(rawValue: raw) ?? .unknown
    }

    var title: String {
        switch self {
        case .created: return "Draft"
        case .placed: return "Placed"
        case .deliveryPending: return "Out for delivery"
        case .delivered: return "Delivered"
        case .cancelled: return "Cancelled"
        case .unknown: return "Unknown"
        }
    }

    var symbol: String {
        switch self {
        case .created: return "pencil.circle"
        case .placed: return "checkmark.circle"
        case .deliveryPending: return "box.truck"
        case .delivered: return "shippingbox.circle.fill"
        case .cancelled: return "xmark.circle"
        case .unknown: return "questionmark.circle"
        }
    }

    var isFinal: Bool { self == .delivered || self == .cancelled }
    var canCancel: Bool { self == .created || self == .placed }
}

struct Order: Codable, Hashable, Identifiable {
    let id: String
    let shopId: Int?
    let price: Double?
    let tax: Double?
    let orderStatus: OrderStatus
    let paymentStatus: String?
    let shippingAddr: Address?
    let billingAddr: Address?
    let orderPlacedTime: String?
    let rating: Double?
    let createdAt: String?
    let items: [OrderItem]?
    let transactions: [OrderTransaction]?

    enum CodingKeys: String, CodingKey {
        case id, price, tax, rating, items, transactions
        case shopId = "shop_id"
        case orderStatus = "order_status"
        case paymentStatus = "payment_status"
        case shippingAddr = "shipping_addr"
        case billingAddr = "billing_addr"
        case orderPlacedTime = "order_placed_time"
        case createdAt = "created_at"
    }

    var total: Double { (price ?? 0) + (tax ?? 0) }
    var displayDate: String { orderPlacedTime ?? createdAt ?? "" }
    var itemCount: Int { (items ?? []).reduce(0) { $0 + $1.quantity } }
    var shortId: String { String(id.prefix(8)).uppercased() }
}

struct OrderListResponse: Decodable {
    let orders: [Order]
    let total: Int?
    let nextPageToken: String?

    enum CodingKeys: String, CodingKey {
        case orders, total
        case nextPageToken = "next_page_token"
    }
}

struct OrderResponse: Decodable {
    let order: Order
}

// MARK: - Auth & profile

struct TokenResponse: Decodable {
    let token: String
}

struct OTPResponse: Decodable {
    let authToken: String

    enum CodingKeys: String, CodingKey {
        case authToken = "auth_token"
    }
}

struct Profile: Codable, Hashable {
    let name: String?
    let email: String?
    let mobile: String?
}

struct ProfileResponse: Decodable {
    let profile: Profile
}

struct LoginSession: Codable, Hashable, Identifiable {
    let token: String
    let loginIp: String?
    let loginTime: String?
    let deviceOs: String?
    let browser: String?
    let currentSession: Bool

    var id: String { token }

    enum CodingKeys: String, CodingKey {
        case token, browser
        case loginIp = "login_ip"
        case loginTime = "login_time"
        case deviceOs = "device_os"
        case currentSession = "current_session"
    }
}

struct SessionsResponse: Decodable {
    let sessions: [LoginSession]
}

// MARK: - Helpers

enum Money {
    static let formatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    static func format(_ value: Double?) -> String {
        formatter.string(from: NSNumber(value: value ?? 0)) ?? String(format: "%.2f", value ?? 0)
    }
}

/// Email if it contains "@", otherwise a 10-digit mobile number (matches the server's regexes).
enum Identifier {
    static func field(for input: String) -> String {
        input.contains("@") ? "email" : "mobile"
    }

    static func validationError(for input: String) -> String? {
        let value = input.trimmingCharacters(in: .whitespaces)
        if value.isEmpty { return "Enter your email or mobile number." }
        if value.contains("@") {
            return value.range(of: #"^\S+@\S+\.[A-Za-z]+$"#, options: .regularExpression) == nil
                ? "Enter a valid email address." : nil
        }
        return value.range(of: #"^[0-9]{10}$"#, options: .regularExpression) == nil
            ? "Mobile numbers must be 10 digits." : nil
    }
}
