import Foundation

struct APIError: LocalizedError, Equatable {
    let status: Int
    let message: String

    var errorDescription: String? { message }
    var isUnauthorized: Bool { status == 401 }
}

/// Every Zinger response is wrapped as `{ success, message, data, reason }`.
private struct Envelope<T: Decodable>: Decodable {
    let message: String?
    let data: T?
    let reason: JSONValue?
}

struct EmptyData: Decodable {}

/// Thin async client for the Zinger customer API (`/v2/...` on the `api` subdomain).
final class APIClient {
    static let defaultBaseURL = "http://api.zinger.pw"
    static let baseURLKey = "zinger.baseURL"

    var baseURL: String {
        let stored = UserDefaults.standard.string(forKey: Self.baseURLKey)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (stored?.isEmpty == false ? stored! : Self.defaultBaseURL).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    /// The raw JWT returned by login/signup. The backend expects it as-is in `Authorization` (no "Bearer").
    var token: String?
    /// Called when the server rejects the token so the app can return to the login screen.
    var onUnauthorized: (() -> Void)?

    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    func get<T: Decodable>(_ path: String, query: [String: String?] = [:]) async throws -> T {
        try await send("GET", path, query: query, body: Optional<[String: JSONValue]>.none)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await send("POST", path, body: body)
    }

    func put<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await send("PUT", path, body: body)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await send("DELETE", path, body: Optional<[String: JSONValue]>.none)
    }

    private func send<T: Decodable, B: Encodable>(_ method: String, _ path: String,
                                                  query: [String: String?] = [:], body: B?) async throws -> T {
        guard var components = URLComponents(string: baseURL + "/v2/" + path) else {
            throw APIError(status: 0, message: "Invalid server address: \(baseURL)")
        }
        let items = query.compactMap { key, value in value.map { URLQueryItem(name: key, value: $0) } }
        if !items.isEmpty { components.queryItems = items }
        guard let url = components.url else {
            throw APIError(status: 0, message: "Invalid server address: \(baseURL)")
        }

        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // Login and signup require a User-Agent; the server stores it with the session.
        request.setValue("ZingerCustomer/1.0 (iPhone; iOS)", forHTTPHeaderField: "User-Agent")
        if let token { request.setValue(token, forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError(status: 0, message: "Couldn't reach the server. Check your connection and the server address in Settings.")
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let envelope = try? decoder.decode(Envelope<T>.self, from: data)

        guard (200..<300).contains(status) else {
            if status == 401, token != nil { onUnauthorized?() }
            throw APIError(status: status, message: Self.errorMessage(envelope?.message, envelope?.reason, status: status))
        }

        if let value = envelope?.data { return value }
        if let empty = EmptyData() as? T { return empty }
        // Decode again without `try?` so a genuine shape mismatch surfaces with detail.
        do {
            let strict = try decoder.decode(Envelope<T>.self, from: data)
            if let value = strict.data { return value }
        } catch {
            throw APIError(status: status, message: "Unexpected response from server (\(error.localizedDescription)).")
        }
        throw APIError(status: status, message: "The server response was empty.")
    }

    private static func errorMessage(_ message: String?, _ reason: JSONValue?, status: Int) -> String {
        var detail = ""
        switch reason {
        case .object(let dict):
            // Validation errors look like { "password": ["is too short"] }
            detail = dict.keys.sorted().compactMap { key in
                let text = dict[key]?.displayText ?? ""
                guard !text.isEmpty else { return nil }
                let field = key.replacingOccurrences(of: "_", with: " ").capitalized
                return "\(field): \(text)"
            }.joined(separator: "\n")
        case .some(let value):
            detail = value.displayText
        case .none:
            break
        }
        let parts = [message, detail.isEmpty ? nil : detail].compactMap { $0 }.filter { !$0.isEmpty }
        if parts.isEmpty {
            return status == 429 ? "Too many requests. Please wait a moment." : "Request failed (HTTP \(status))."
        }
        return parts.joined(separator: "\n")
    }
}
