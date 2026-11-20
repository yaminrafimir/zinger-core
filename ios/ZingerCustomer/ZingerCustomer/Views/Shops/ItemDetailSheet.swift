import SwiftUI

struct ItemDetailSheet: View {
    let item: Item
    let shop: Shop

    @Environment(Cart.self) private var cart
    @Environment(\.dismiss) private var dismiss
    @State private var variantId: String?
    @State private var quantity = 1
    @State private var confirmReplace = false

    private var variants: [ItemVariant] { item.sortedVariants }
    private var selected: ItemVariant? { variants.first { $0.id == variantId } ?? variants.first }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let url = item.coverPhotos?.first?.url ?? item.icon {
                    RemoteImage(url: url, symbol: "fork.knife")
                        .frame(height: 200)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(item.name).font(.title2.bold())
                    if let category = item.category, !category.isEmpty {
                        Text(category.capitalized).font(.subheadline).foregroundStyle(Color.accentColor)
                    }
                    if let description = item.description, !description.isEmpty {
                        Text(description).foregroundStyle(.secondary)
                    }
                }

                if variants.count > 1 {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Choose an option").font(.headline)
                        ForEach(variants) { variant in
                            Button { variantId = variant.id } label: {
                                HStack {
                                    Image(systemName: selected?.id == variant.id ? "largecircle.fill.circle" : "circle")
                                        .foregroundStyle(Color.accentColor)
                                    Text(variant.label.isEmpty ? "Option" : variant.label)
                                    if !variant.isInStock {
                                        Text("Out of stock").font(.caption).foregroundStyle(.red)
                                    }
                                    Spacer()
                                    Text(Money.format(variant.price)).monospacedDigit()
                                }
                                .padding(12)
                                .background(Color(.secondarySystemBackground),
                                            in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .disabled(!variant.isInStock)
                        }
                    }
                }

                if let selected {
                    HStack {
                        Text("Quantity").font(.headline)
                        Spacer()
                        Stepper("\(quantity)", value: $quantity, in: 1...50)
                            .fixedSize()
                    }

                    PrimaryButton(title: "Add \(quantity) · \(Money.format(selected.price * Double(quantity)))",
                                  isDisabled: !selected.isInStock) {
                        if cart.canAdd(from: shop) { add(selected) } else { confirmReplace = true }
                    }
                } else {
                    Text("This item isn't available right now.").foregroundStyle(.secondary)
                }
            }
            .padding(20)
        }
        .confirmationDialog("Start a new cart?", isPresented: $confirmReplace, titleVisibility: .visible) {
            Button("Clear cart and add", role: .destructive) { if let selected { add(selected) } }
        } message: {
            Text("Your cart has items from \(cart.shop?.name ?? "another shop"). Orders can only include one shop.")
        }
        .onAppear {
            variantId = variants.first(where: \.isInStock)?.id ?? variants.first?.id
        }
    }

    private func add(_ variant: ItemVariant) {
        cart.add(item, variant: variant, from: shop, quantity: quantity)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        dismiss()
    }
}
