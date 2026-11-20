import Foundation
import Observation

/// Holds the signed-in session and exposes the API calls the screens use.
@Observable
@MainActor
final class AppState {
    private static let tokenKey = "session.token"
    static let minPasswordLength = 6

    let api = APIClient()
    private(set) var isSignedIn: Bool
    var profile: Profile?

    init() {
        let token = KeychainStore.get(Self.tokenKey)
        api.token = token
        isSignedIn = token != nil
        api.onUnauthorized = { [weak self] in
            Task { @MainActor in self?.clearSession() }
        }
    }

    // MARK: Auth

    private func signIn(with token: String) {
        KeychainStore.set(token, for: Self.tokenKey)
        api.token = token
        isSignedIn = true
    }

    func clearSession() {
        KeychainStore.set(nil, for: Self.tokenKey)
        api.token = nil
        profile = nil
        isSignedIn = false
    }

    func loginWithPassword(identifier: String, password: String) async throws {
        let id = identifier.trimmingCharacters(in: .whitespaces)
        let body: [String: String] = ["purpose": "PASSWORD", Identifier.field(for: id): id, "password": password]
        let response: TokenResponse = try await api.post("auth/login", body: body)
        signIn(with: response.token)
    }

    /// Purpose is one of SIGNUP, LOGIN, RESET_PASSWORD. Returns the auth_token to pair with the OTP.
    func requestOTP(purpose: String, identifier: String) async throws -> String {
        let id = identifier.trimmingCharacters(in: .whitespaces)
        let body = ["purpose": purpose, Identifier.field(for: id): id]
        let response: OTPResponse = try await api.post("auth/otp", body: body)
        return response.authToken
    }

    func loginWithOTP(authToken: String, otp: String) async throws {
        let body = ["purpose": "OTP", "auth_token": authToken, "otp": otp]
        let response: TokenResponse = try await api.post("auth/login", body: body)
        signIn(with: response.token)
    }

    func signUp(authToken: String, otp: String, password: String, confirmation: String) async throws {
        let body = ["purpose": "PASSWORD", "auth_token": authToken, "otp": otp,
                    "password": password, "password_confirmation": confirmation]
        let response: TokenResponse = try await api.post("auth/signup", body: body)
        signIn(with: response.token)
    }

    func resetPassword(authToken: String, otp: String, password: String, confirmation: String) async throws {
        let body = ["auth_token": authToken, "otp": otp, "password": password, "password_confirmation": confirmation]
        let _: EmptyData = try await api.post("auth/reset_password", body: body)
    }

    func logout() async {
        let _: EmptyData? = try? await api.delete("auth/logout")
        clearSession()
    }

    // MARK: Profile

    func loadProfile() async throws {
        let response: ProfileResponse = try await api.get("user_profile")
        profile = response.profile
    }

    func updateName(_ name: String) async throws {
        let response: ProfileResponse = try await api.put("user_profile/modify", body: ["name": name])
        profile = response.profile
    }

    func changePassword(current: String, new: String, confirmation: String) async throws {
        let body = ["current_password": current, "new_password": new, "confirm_password": confirmation]
        let _: EmptyData = try await api.put("user_profile/reset_password", body: body)
    }

    func sessions() async throws -> [LoginSession] {
        let response: SessionsResponse = try await api.get("user_profile/session")
        return response.sessions
    }

    func endSession(_ token: String) async throws {
        let encoded = token.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? token
        let _: EmptyData = try await api.delete("user_profile/session/\(encoded)")
    }

    // MARK: Catalog

    func shops(name: String?, offset: Int, pageSize: Int = 20) async throws -> ShopListResponse {
        try await api.get("shop", query: [
            "name": name, "offset": String(offset), "page_size": String(pageSize),
        ])
    }

    func shop(id: Int) async throws -> ShopDetail {
        let response: ShopResponse = try await api.get("shop/\(id)")
        return response.shop
    }

    func items(shopId: Int, name: String?, offset: Int, pageSize: Int = 20) async throws -> ItemListResponse {
        try await api.get("shop/\(shopId)/items", query: [
            "name": name, "offset": String(offset), "page_size": String(pageSize),
        ])
    }

    // MARK: Orders

    func orders(nextPageToken: String?) async throws -> OrderListResponse {
        try await api.get("order", query: ["next_page_token": nextPageToken, "sort_order": "DESC"])
    }

    func order(id: String) async throws -> Order {
        let response: OrderResponse = try await api.get("order/\(id)")
        return response.order
    }

    /// Creates the order, then moves it to `placed` so the shop sees it.
    func placeOrder(cart: Cart, address: Address) async throws -> Order {
        let body = CreateOrderBody(
            items: cart.lines.map { .init(itemId: $0.item.id, itemVariantId: $0.variant.id, quantity: $0.quantity) },
            shippingAddr: address,
            billingAddr: address
        )
        let created: OrderResponse = try await api.post("order", body: body)
        return try await updateOrder(id: created.order.id, fields: ["order_status": .string("placed")])
    }

    func cancelOrder(id: String) async throws -> Order {
        try await updateOrder(id: id, fields: ["order_status": .string("cancelled")])
    }

    func rateOrder(id: String, rating: Double) async throws -> Order {
        try await updateOrder(id: id, fields: ["rating": .number(rating)])
    }

    private func updateOrder(id: String, fields: [String: JSONValue]) async throws -> Order {
        let response: OrderResponse = try await api.put("order/\(id)", body: fields)
        return response.order
    }
}

private struct CreateOrderBody: Encodable {
    struct Line: Encodable {
        let itemId: String
        let itemVariantId: String
        let quantity: Int

        enum CodingKeys: String, CodingKey {
            case quantity
            case itemId = "item_id"
            case itemVariantId = "item_variant_id"
        }
    }

    let items: [Line]
    let shippingAddr: Address
    let billingAddr: Address

    enum CodingKeys: String, CodingKey {
        case items
        case shippingAddr = "shipping_addr"
        case billingAddr = "billing_addr"
    }
}
