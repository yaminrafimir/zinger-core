import Foundation

/// A loosely-typed JSON value. The Zinger API returns some free-form fields
/// (addresses, error reasons, meta) whose shape varies, so we decode them generically.
enum JSONValue: Codable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    /// Human-readable rendering, used for addresses and error messages.
    var displayText: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return value.rounded() == value ? String(Int(value)) : String(value)
        case .bool(let value):
            return value ? "Yes" : "No"
        case .array(let values):
            return values.map(\.displayText).filter { !$0.isEmpty }.joined(separator: ", ")
        case .object(let dict):
            return dict.keys.sorted().compactMap { key in
                let text = dict[key]?.displayText ?? ""
                guard !text.isEmpty else { return nil }
                return "\(key.replacingOccurrences(of: "_", with: " ").capitalized): \(text)"
            }.joined(separator: "\n")
        case .null:
            return ""
        }
    }

    var stringValue: String? {
        switch self {
        case .string(let value): return value
        case .number, .bool: return displayText
        default: return nil
        }
    }
}
