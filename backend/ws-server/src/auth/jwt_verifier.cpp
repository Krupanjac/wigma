#include "jwt_verifier.h"
#include <nlohmann/json.hpp>
#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <chrono>
#include <cstring>
#include <algorithm>

using json = nlohmann::json;

JwtVerifier::JwtVerifier(std::string secret)
  : secret_(std::move(secret)) {}

std::optional<JwtVerifier::Claims> JwtVerifier::verify(std::string_view token) const {
  // Split into header.payload.signature
  auto dot1 = token.find('.');
  if (dot1 == std::string_view::npos) return std::nullopt;

  auto dot2 = token.find('.', dot1 + 1);
  if (dot2 == std::string_view::npos) return std::nullopt;

  auto header_b64  = token.substr(0, dot1);
  auto payload_b64 = token.substr(dot1 + 1, dot2 - dot1 - 1);
  auto sig_b64     = token.substr(dot2 + 1);

  // Verify HMAC-SHA256 signature
  auto signing_input = token.substr(0, dot2);
  auto expected_sig  = hmac_sha256(signing_input);
  auto actual_sig    = base64url_decode(sig_b64);

  if (expected_sig.size() != actual_sig.size() ||
      !std::equal(expected_sig.begin(), expected_sig.end(), actual_sig.begin())) {
    return std::nullopt;
  }

  // Decode payload
  auto payload_json = base64url_decode(payload_b64);

  try {
    auto j = json::parse(payload_json);

    Claims claims;
    claims.sub  = j.value("sub", "");
    claims.role = j.value("role", "");
    claims.exp  = j.value("exp", int64_t{0});
    claims.iat  = j.value("iat", int64_t{0});

    // Check expiration
    auto now = std::chrono::duration_cast<std::chrono::seconds>(
      std::chrono::system_clock::now().time_since_epoch()
    ).count();

    if (claims.exp > 0 && now > claims.exp) {
      return std::nullopt; // Token expired
    }

    if (claims.sub.empty()) {
      return std::nullopt; // No subject
    }

    return claims;

  } catch (...) {
    return std::nullopt;
  }
}

std::string JwtVerifier::base64url_decode(std::string_view input) {
  // Convert base64url to standard base64
  std::string b64(input);
  std::replace(b64.begin(), b64.end(), '-', '+');
  std::replace(b64.begin(), b64.end(), '_', '/');

  // Add padding
  while (b64.size() % 4 != 0) {
    b64.push_back('=');
  }

  // Decode
  size_t out_len = b64.size() * 3 / 4;
  std::string out(out_len, '\0');

  auto* bio   = BIO_new_mem_buf(b64.data(), static_cast<int>(b64.size()));
  auto* b64f  = BIO_new(BIO_f_base64());
  BIO_set_flags(b64f, BIO_FLAGS_BASE64_NO_NL);
  bio = BIO_push(b64f, bio);

  int decoded_len = BIO_read(bio, out.data(), static_cast<int>(out.size()));
  BIO_free_all(bio);

  if (decoded_len > 0) {
    out.resize(static_cast<size_t>(decoded_len));
  } else {
    out.clear();
  }

  return out;
}

std::string JwtVerifier::hmac_sha256(std::string_view data) const {
  unsigned char result[EVP_MAX_MD_SIZE];
  unsigned int result_len = 0;

  HMAC(EVP_sha256(),
       secret_.data(), static_cast<int>(secret_.size()),
       reinterpret_cast<const unsigned char*>(data.data()),
       data.size(),
       result, &result_len);

  return std::string(reinterpret_cast<char*>(result), result_len);
}
