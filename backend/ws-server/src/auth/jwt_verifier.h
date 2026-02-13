#pragma once
#include <string>
#include <string_view>
#include <optional>
#include <cstdint>
#include <vector>

// Forward-declare OpenSSL types
struct evp_pkey_st;
typedef struct evp_pkey_st EVP_PKEY;
struct evp_md_st;
typedef struct evp_md_st EVP_MD;

/**
 * JWT token verification for Supabase auth tokens.
 *
 * Supports two verification modes:
 *   1. ES256 (ECDSA P-256) — current Supabase signing method.
 *      Public key is fetched from the JWKS endpoint on construction.
 *   2. HS256 (HMAC-SHA256) — legacy fallback for service/anon keys
 *      and tokens signed before key rotation.
 */
class JwtVerifier {
public:
  /**
   * @param supabase_url  e.g. "https://xyz.supabase.co"
   * @param legacy_secret The HS256 JWT secret (for legacy/service tokens)
   */
  JwtVerifier(const std::string& supabase_url, const std::string& legacy_secret);
  ~JwtVerifier();

  // Non-copyable (owns EVP_PKEY*)
  JwtVerifier(const JwtVerifier&) = delete;
  JwtVerifier& operator=(const JwtVerifier&) = delete;

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
  std::string legacy_secret_;
  EVP_PKEY*   ec_pubkey_ = nullptr;  // ES256 public key from JWKS

  /** Fetch JWKS from Supabase and load the EC public key. */
  void load_jwks(const std::string& supabase_url);

  /** Build an EC P-256 public key from raw x,y coordinates (32 bytes each). */
  static EVP_PKEY* build_ec_key(const std::string& x_bytes, const std::string& y_bytes);

  /** Verify ES256 (ECDSA P-256) signature. */
  bool verify_es256(std::string_view signing_input, std::string_view signature) const;

  /** Verify HS256 (HMAC-SHA256) signature. */
  bool verify_hs256(std::string_view signing_input, std::string_view signature) const;

  /** Base64url decode (RFC 4648 §5). */
  static std::string base64url_decode(std::string_view input);

  /** Decode JWT payload JSON into Claims. */
  static std::optional<Claims> decode_claims(std::string_view payload_b64);
};
