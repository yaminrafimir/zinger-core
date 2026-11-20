import SwiftUI

struct WelcomeView: View {
    @State private var mode: Mode = .signIn
    @State private var showServerSettings = false

    enum Mode: String, CaseIterable { case signIn = "Sign In", signUp = "Create Account" }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    header

                    Picker("Mode", selection: $mode.animation()) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) }
                    }
                    .pickerStyle(.segmented)

                    switch mode {
                    case .signIn: SignInForm()
                    case .signUp: SignUpForm()
                    }
                }
                .padding(24)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showServerSettings = true } label: {
                        Image(systemName: "server.rack")
                    }
                    .accessibilityLabel("Server settings")
                }
            }
            .sheet(isPresented: $showServerSettings) {
                NavigationStack { ServerSettingsView() }
            }
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 84, height: 84)
                .background(
                    LinearGradient(colors: [Color.accentColor, Color.accentColor.opacity(0.7)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 22, style: .continuous)
                )
                .shadow(color: Color.accentColor.opacity(0.35), radius: 12, y: 6)
            Text("Zinger")
                .font(.largeTitle.bold())
            Text("Order from shops near you")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 24)
    }
}

// MARK: - Sign in

private struct SignInForm: View {
    @Environment(AppState.self) private var appState
    @State private var identifier = ""
    @State private var password = ""
    @State private var useOTP = false
    @State private var isLoading = false
    @State private var error: String?
    @State private var showReset = false

    var body: some View {
        VStack(spacing: 16) {
            if useOTP {
                OTPFlow(purpose: "LOGIN", identifier: $identifier) { authToken, otp in
                    try await appState.loginWithOTP(authToken: authToken, otp: otp)
                }
            } else {
                VStack(spacing: 12) {
                    IdentifierField(text: $identifier)
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .fieldStyle()
                        .submitLabel(.go)
                        .onSubmit { Task { await signIn() } }
                }
                InlineError(message: error)
                PrimaryButton(title: "Sign In", isLoading: isLoading,
                              isDisabled: identifier.isEmpty || password.isEmpty) { await signIn() }
                Button("Forgot password?") { showReset = true }
                    .font(.footnote)
            }

            Button(useOTP ? "Sign in with password instead" : "Sign in with a one-time code instead") {
                withAnimation { useOTP.toggle(); error = nil }
            }
            .font(.footnote.weight(.medium))
        }
        .sheet(isPresented: $showReset) {
            NavigationStack { ResetPasswordView(identifier: identifier) }
        }
    }

    private func signIn() async {
        if let message = Identifier.validationError(for: identifier) { error = message; return }
        if password.count < AppState.minPasswordLength {
            error = "Password must be at least \(AppState.minPasswordLength) characters."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            try await appState.loginWithPassword(identifier: identifier, password: password)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Sign up

private struct SignUpForm: View {
    @Environment(AppState.self) private var appState
    @State private var identifier = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var passwordError: String?

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 12) {
                SecureField("Create a password", text: $password)
                    .textContentType(.newPassword)
                    .fieldStyle()
                SecureField("Confirm password", text: $confirmation)
                    .textContentType(.newPassword)
                    .fieldStyle()
            }
            InlineError(message: passwordError)

            OTPFlow(purpose: "SIGNUP", identifier: $identifier, sendTitle: "Verify & Continue",
                    validate: validatePassword) { authToken, otp in
                try await appState.signUp(authToken: authToken, otp: otp, password: password, confirmation: confirmation)
            }

            Text("We'll send a verification code to confirm it's you.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func validatePassword() -> Bool {
        if password.count < AppState.minPasswordLength {
            passwordError = "Password must be at least \(AppState.minPasswordLength) characters."
        } else if password != confirmation {
            passwordError = "Passwords don't match."
        } else {
            passwordError = nil
        }
        return passwordError == nil
    }
}

// MARK: - Reset password

struct ResetPasswordView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State var identifier: String
    @State private var password = ""
    @State private var confirmation = ""
    @State private var passwordError: String?
    @State private var done = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if done {
                    ContentUnavailableView("Password updated", systemImage: "checkmark.seal.fill",
                                           description: Text("Sign in with your new password."))
                    PrimaryButton(title: "Done") { dismiss() }
                } else {
                    SecureField("New password", text: $password)
                        .textContentType(.newPassword).fieldStyle()
                    SecureField("Confirm new password", text: $confirmation)
                        .textContentType(.newPassword).fieldStyle()
                    InlineError(message: passwordError)
                    OTPFlow(purpose: "RESET_PASSWORD", identifier: $identifier, sendTitle: "Send Reset Code",
                            confirmTitle: "Reset Password", validate: validatePassword) { authToken, otp in
                        try await appState.resetPassword(authToken: authToken, otp: otp,
                                                         password: password, confirmation: confirmation)
                        withAnimation { done = true }
                    }
                }
            }
            .padding(24)
        }
        .navigationTitle("Reset Password")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
        }
    }

    private func validatePassword() -> Bool {
        if password.count < AppState.minPasswordLength {
            passwordError = "Password must be at least \(AppState.minPasswordLength) characters."
        } else if password != confirmation {
            passwordError = "Passwords don't match."
        } else {
            passwordError = nil
        }
        return passwordError == nil
    }
}

// MARK: - Shared pieces

/// Two-step flow: request a code for an email/mobile, then submit the code.
struct OTPFlow: View {
    let purpose: String
    @Binding var identifier: String
    var sendTitle = "Send Code"
    var confirmTitle = "Continue"
    var validate: () -> Bool = { true }
    let onVerify: (_ authToken: String, _ otp: String) async throws -> Void

    @Environment(AppState.self) private var appState
    @State private var authToken: String?
    @State private var otp = ""
    @State private var isLoading = false
    @State private var error: String?
    @FocusState private var otpFocused: Bool

    var body: some View {
        VStack(spacing: 12) {
            IdentifierField(text: $identifier)
                .disabled(authToken != nil)

            if authToken != nil {
                TextField("6-digit code", text: $otp)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.title3.monospacedDigit())
                    .multilineTextAlignment(.center)
                    .fieldStyle()
                    .focused($otpFocused)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            InlineError(message: error)

            if authToken == nil {
                PrimaryButton(title: sendTitle, isLoading: isLoading, isDisabled: identifier.isEmpty) { await sendCode() }
            } else {
                PrimaryButton(title: confirmTitle, isLoading: isLoading, isDisabled: otp.count < 4) { await verify() }
                HStack {
                    Button("Change \(Identifier.field(for: identifier))") {
                        withAnimation { authToken = nil; otp = ""; error = nil }
                    }
                    Spacer()
                    Button("Resend code") { Task { await sendCode() } }
                }
                .font(.footnote)
            }
        }
    }

    private func sendCode() async {
        if let message = Identifier.validationError(for: identifier) { error = message; return }
        guard validate() else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await appState.requestOTP(purpose: purpose, identifier: identifier)
            withAnimation { authToken = token; error = nil }
            otpFocused = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func verify() async {
        guard let authToken, validate() else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            try await onVerify(authToken, otp.trimmingCharacters(in: .whitespaces))
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct IdentifierField: View {
    @Binding var text: String

    var body: some View {
        TextField("Email or 10-digit mobile", text: $text)
            .textContentType(.username)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .fieldStyle()
    }
}

extension View {
    func fieldStyle() -> some View {
        padding(14)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
