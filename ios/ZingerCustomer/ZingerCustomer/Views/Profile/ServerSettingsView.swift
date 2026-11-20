import SwiftUI

/// Lets the user point the app at their own Zinger deployment.
struct ServerSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage(APIClient.baseURLKey) private var baseURL = APIClient.defaultBaseURL

    var body: some View {
        Form {
            Section {
                TextField("https://api.example.com", text: $baseURL)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } header: {
                Text("Customer API address")
            } footer: {
                Text("The address of your Zinger Core server. The host must start with the `api.` subdomain, e.g. https://api.yourshop.com. The app adds /v2 automatically.")
            }

            Section {
                Button("Reset to default") { baseURL = APIClient.defaultBaseURL }
            }
        }
        .navigationTitle("Server")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
        }
    }
}
