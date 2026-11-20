import SwiftUI

/// Loads a remote image with a tinted placeholder.
struct RemoteImage: View {
    let url: String?
    var symbol = "photo"

    var body: some View {
        if let url, let parsed = URL(string: url), !url.isEmpty {
            AsyncImage(url: parsed, transaction: Transaction(animation: .easeIn(duration: 0.2))) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        ZStack {
            Color.accentColor.opacity(0.12)
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(Color.accentColor.opacity(0.7))
        }
    }
}

struct ErrorStateView: View {
    let message: String
    var retry: (() async -> Void)?

    var body: some View {
        ContentUnavailableView {
            Label("Something went wrong", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            if let retry {
                Button("Try Again") { Task { await retry() } }
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}

struct InlineError: View {
    let message: String?

    var body: some View {
        if let message, !message.isEmpty {
            Label(message, systemImage: "exclamationmark.circle.fill")
                .font(.footnote)
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity, alignment: .leading)
                .transition(.opacity)
        }
    }
}

struct PrimaryButton: View {
    let title: String
    var isLoading = false
    var isDisabled = false
    let action: () async -> Void

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            ZStack {
                Text(title).opacity(isLoading ? 0 : 1)
                if isLoading { ProgressView().tint(.white) }
            }
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(isLoading || isDisabled)
    }
}

struct QuantityStepper: View {
    let quantity: Int
    let onChange: (Int) -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button { onChange(quantity - 1) } label: {
                Image(systemName: quantity <= 1 ? "trash" : "minus")
                    .frame(width: 32, height: 30)
            }
            Text("\(quantity)")
                .font(.subheadline.monospacedDigit().weight(.semibold))
                .frame(minWidth: 24)
            Button { onChange(quantity + 1) } label: {
                Image(systemName: "plus").frame(width: 32, height: 30)
            }
        }
        .buttonStyle(.borderless)
        .background(Color.accentColor.opacity(0.12), in: Capsule())
    }
}

struct TagChips: View {
    let tags: [String]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.accentColor.opacity(0.12), in: Capsule())
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
    }
}
