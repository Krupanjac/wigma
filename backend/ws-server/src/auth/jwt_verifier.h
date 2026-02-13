#pragma once
#include <string>
#include <string_view>
#include <optional>

/**
 * JWT token verification for Supabase auth tokens.
 * Verifies HS256 signatures using the Supabase JWT secret.
 */
class JwtVerifier {
public:
  explicit JwtVerifier(std::string secret);

  struct Claims {
    std::string sub;     // User ID (UUID)
    std::string role;    // "authenticated" or "anon"
    int64_t     exp;     // Expiration timestamp
    int64_t     iat;     // Issued-at timestamp
  };

  /**
   * Verify and decode a JWT token.
   * Returns nullopt if signature is invalid or token is expired.
   */
  std::optional<Claims> verify(std::string_view token) const;

private:
  std::string secret_;

  /** Base64url decode (RFC 4648 §5). */
  static std::string base64url_decode(std::string_view input);

  /** HMAC-SHA256 signature. */
  std::string hmac_sha256(std::string_view data) const;
};
