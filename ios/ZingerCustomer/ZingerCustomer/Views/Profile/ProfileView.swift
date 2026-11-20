import SwiftUI

struct ProfileView: View {
    @Environment(AppState.self) private var appState
    @State private var error: String?
    @State private var confirmLogout = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        Text(initials)
                            .font(.title2.bold())
                            .foregroundStyle(.white)
                            .frame(width: 60, height: 60)
                            .background(Color.accentColor.gradient, in: Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text(displayName).font(.title3.bold())
                            if let email = appState.profile?.email, !email.isEmpty {
                                Text(email).font(.subheadline).foregroundStyle(.secondary)
                            }
                            if let mobile = appState.profile?.mobile, !mobile.isEmpty {
                                Text(mobile).font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(.vertical, 6)
                }

                if let error { Section { InlineError(message: error) } }

                Section("Account") {
                    NavigationLink { EditNameView() } label: { Label("Edit name", systemImage: "person.text.rectangle") }
                    NavigationLink { ChangePasswordView() } label: { Label("Change password", systemImage: "key") }
                    NavigationLink { SessionsView() } label: { Label("Signed-in devices", systemImage: "iphone.gen3") }
                }

                Section("App") {
                    NavigationLink { ServerSettingsView() } label: { Label("Server", systemImage: "server.rack") }
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                }

                Section {
                    Button("Sign Out", role: .destructive) { confirmLogout = true }
                        .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Profile")
            .task { await load() }
            .refreshable { await load() }
            .confirmationDialog("Sign out of Zinger?", isPresented: $confirmLogout, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) { Task { await appState.logout() } }
            }
        }
    }

    private var displayName: String {
        if let name = appState.profile?.name, !name.isEmpty { return name }
        return "Welcome!"
    }

    private var initials: String {
        let source = appState.profile?.name?.isEmpty == false ? appState.profile!.name! : (appState.profile?.email ?? "Z")
        let letters = source.split(separator: " ").prefix(2).compactMap(\.first)
        return letters.isEmpty ? "Z" : String(letters).uppercased()
    }

    private func load() async {
        do {
            try await appState.loadProfile()
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct EditNameView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var isSaving = false
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                TextField("Your name", text: $name).textContentType(.name)
            } footer: {
                InlineError(message: error)
            }
            Section {
                PrimaryButton(title: "Save", isLoading: isSaving,
                              isDisabled: name.trimmingCharacters(in: .whitespaces).isEmpty) {
                    isSaving = true
                    defer { isSaving = false }
                    do {
                        try await appState.updateName(name.trimmingCharacters(in: .whitespaces))
                        dismiss()
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
        }
        .navigationTitle("Edit Name")
        .onAppear { name = appState.profile?.name ?? "" }
    }
}

private struct ChangePasswordView: View {
    @Environment(AppState.self) private var appState
    @State private var current = ""
    @State private var new = ""
    @State private var confirmation = ""
    @State private var isSaving = false
    @State private var error: String?
    @State private var saved = false

    var body: some View {
        Form {
            Section {
                SecureField("Current password", text: $current).textContentType(.password)
            }
            Section {
                SecureField("New password", text: $new).textContentType(.newPassword)
                SecureField("Confirm new password", text: $confirmation).textContentType(.newPassword)
            } footer: {
                if saved {
                    Label("Password updated", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                } else {
                    InlineError(message: error)
                }
            }
            Section {
                PrimaryButton(title: "Update Password", isLoading: isSaving,
                              isDisabled: current.isEmpty || new.isEmpty) { await save() }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
        }
        .navigationTitle("Change Password")
    }

    private func save() async {
        saved = false
        guard new.count >= AppState.minPasswordLength else {
            error = "Password must be at least \(AppState.minPasswordLength) characters."
            return
        }
        guard new == confirmation else { error = "Passwords don't match."; return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await appState.changePassword(current: current, new: new, confirmation: confirmation)
            current = ""; new = ""; confirmation = ""
            error = nil
            saved = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct SessionsView: View {
    @Environment(AppState.self) private var appState
    @State private var sessions: [LoginSession] = []
    @State private var error: String?
    @State private var loaded = false

    var body: some View {
        List {
            if let error { Section { InlineError(message: error) } }
            Section {
                ForEach(sessions) { session in
                    HStack(spacing: 12) {
                        Image(systemName: icon(for: session)).font(.title3).frame(width: 30)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text([session.deviceOs, session.browser].compactMap { $0 }
                                    .filter { !$0.isEmpty }.joined(separator: " · ").ifEmpty("Unknown device"))
                                    .font(.body.weight(.medium))
                                if session.currentSession {
                                    Text("This device").font(.caption2.bold())
                                        .padding(.horizontal, 6).padding(.vertical, 2)
                                        .background(Color.accentColor.opacity(0.15), in: Capsule())
                                        .foregroundStyle(Color.accentColor)
                                }
                            }
                            Text([session.loginTime, session.loginIp].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .swipeActions {
                        if !session.currentSession {
                            Button("Sign Out", role: .destructive) { Task { await end(session) } }
                        }
                    }
                }
            } footer: {
                Text("Swipe left on another device to sign it out.")
            }
        }
        .overlay { if !loaded { ProgressView() } }
        .navigationTitle("Devices")
        .task { await load() }
        .refreshable { await load() }
    }

    private func icon(for session: LoginSession) -> String {
        let os = (session.deviceOs ?? "").lowercased()
        if os.contains("ios") || os.contains("iphone") { return "iphone" }
        if os.contains("android") { return "candybarphone" }
        if os.contains("mac") || os.contains("windows") || os.contains("linux") { return "laptopcomputer" }
        return "desktopcomputer"
    }

    private func load() async {
        defer { loaded = true }
        do {
            sessions = try await appState.sessions()
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func end(_ session: LoginSession) async {
        do {
            try await appState.endSession(session.token)
            withAnimation { sessions.removeAll { $0.id == session.id } }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}
