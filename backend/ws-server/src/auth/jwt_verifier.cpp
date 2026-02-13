#include "jwt_verifier.h"
#include <nlohmann/json.hpp>
#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <openssl/ec.h>
#include <openssl/ecdsa.h>
#include <openssl/bn.h>
#include <openssl/bio.h>
#include <openssl/err.h>
#include <openssl/param_build.h>
#include <curl/curl.h>
#include <chrono>
#include <cstring>
#include <algorithm>
#include <iostream>

using json = nlohmann::json;

// ── libcurl write callback ──────────────────────────────────────────────────

static size_t curl_write_cb(char* ptr, size_t size, size_t nmemb, void* userdata) {
  auto* body = static_cast<std::string*>(userdata);
  body->append(ptr, size * nmemb);
  return size * nmemb;
}

// ── Constructor / Destructor ────────────────────────────────────────────────

JwtVerifier::JwtVerifier(const std::string& supabase_url, const std::string& legacy_secret)
  : legacy_secret_(legacy_secret) {
  load_jwks(supabase_url);
}

JwtVerifier::~JwtVerifier() {
  if (ec_pubkey_) {
    EVP_PKEY_free(ec_pubkey_);
    ec_pubkey_ = nullptr;
  }
}

// ── JWKS Fetching ───────────────────────────────────────────────────────────

void JwtVerifier::load_jwks(const std::string& supabase_url) {
  std::string jwks_url = supabase_url + "/auth/v1/.well-known/jwks.json";
  std::cout << "[jwt] fetching JWKS from " << jwks_url << std::endl;

  CURL* curl = curl_easy_init();
  if (!curl) {
    std::cerr << "[jwt] ERROR: curl_easy_init failed" << std::endl;
    return;
  }

  std::string body;
  curl_easy_setopt(curl, CURLOPT_URL, jwks_url.c_str());
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curl_write_cb);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &body);
  curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
  curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);

  CURLcode res = curl_easy_perform(curl);
  long http_code = 0;
  curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
  curl_easy_cleanup(curl);

  if (res != CURLE_OK || http_code != 200) {
    std::cerr << "[jwt] ERROR: JWKS fetch failed: "
              << curl_easy_strerror(res) << " HTTP " << http_code << std::endl;
    return;
  }

  try {
    auto jwks = json::parse(body);
    auto& keys = jwks["keys"];
    if (!keys.is_array() || keys.empty()) {
      std::cerr << "[jwt] ERROR: JWKS has no keys" << std::endl;
      return;
    }

    // Find the EC P-256 key for ES256 verification
    for (auto& key : keys) {
      std::string kty = key.value("kty", "");
      std::string crv = key.value("crv", "");
      std::string alg = key.value("alg", "");

      if (kty == "EC" && crv == "P-256") {
        std::string x_b64 = key.value("x", "");
        std::string y_b64 = key.value("y", "");
        std::string kid   = key.value("kid", "");

        if (x_b64.empty() || y_b64.empty()) {
          std::cerr << "[jwt] ERROR: EC key missing x or y" << std::endl;
          continue;
        }

        auto x_bytes = base64url_decode(x_b64);
        auto y_bytes = base64url_decode(y_b64);

        ec_pubkey_ = build_ec_key(x_bytes, y_bytes);
        if (ec_pubkey_) {
          std::cout << "[jwt] loaded EC P-256 public key (kid: " << kid << ")" << std::endl;
        } else {
          std::cerr << "[jwt] ERROR: failed to build EC key" << std::endl;
        }
        break;
      }
    }

    if (!ec_pubkey_) {
      std::cerr << "[jwt] WARNING: no EC P-256 key found in JWKS, ES256 verification disabled" << std::endl;
    }
  } catch (const std::exception& e) {
    std::cerr << "[jwt] ERROR: JWKS parse failed: " << e.what() << std::endl;
  }
}

EVP_PKEY* JwtVerifier::build_ec_key(const std::string& x_bytes, const std::string& y_bytes) {
  if (x_bytes.size() != 32 || y_bytes.size() != 32) {
    std::cerr << "[jwt] ERROR: EC key x/y must be 32 bytes each, got "
              << x_bytes.size() << "/" << y_bytes.size() << std::endl;
    return nullptr;
  }

  // Build uncompressed point: 0x04 || x || y
  std::vector<unsigned char> pub_point(65);
  pub_point[0] = 0x04;
  std::memcpy(pub_point.data() + 1,  x_bytes.data(), 32);
  std::memcpy(pub_point.data() + 33, y_bytes.data(), 32);

  // Use OSSL_PARAM_BLD to construct the key
  OSSL_PARAM_BLD* bld = OSSL_PARAM_BLD_new();
  if (!bld) return nullptr;

  OSSL_PARAM_BLD_push_utf8_string(bld, "group", "prime256v1", 0);
  OSSL_PARAM_BLD_push_octet_string(bld, "pub", pub_point.data(), pub_point.size());

  OSSL_PARAM* params = OSSL_PARAM_BLD_to_param(bld);
  OSSL_PARAM_BLD_free(bld);
  if (!params) return nullptr;

  EVP_PKEY_CTX* ctx = EVP_PKEY_CTX_new_from_name(nullptr, "EC", nullptr);
  if (!ctx) {
    OSSL_PARAM_free(params);
    return nullptr;
  }

  EVP_PKEY* pkey = nullptr;
  if (EVP_PKEY_fromdata_init(ctx) <= 0 ||
      EVP_PKEY_fromdata(ctx, &pkey, EVP_PKEY_PUBLIC_KEY, params) <= 0) {
    unsigned long err = ERR_get_error();
    char buf[256];
    ERR_error_string_n(err, buf, sizeof(buf));
    std::cerr << "[jwt] OpenSSL EC key build error: " << buf << std::endl;
    pkey = nullptr;
  }

  EVP_PKEY_CTX_free(ctx);
  OSSL_PARAM_free(params);
  return pkey;
}

// ── Verification ────────────────────────────────────────────────────────────

std::optional<JwtVerifier::Claims> JwtVerifier::verify(std::string_view token) const {
  // Split into header.payload.signature
  auto dot1 = token.find('.');
  if (dot1 == std::string_view::npos) return std::nullopt;

  auto dot2 = token.find('.', dot1 + 1);
  if (dot2 == std::string_view::npos) return std::nullopt;

  auto header_b64  = token.substr(0, dot1);
  auto payload_b64 = token.substr(dot1 + 1, dot2 - dot1 - 1);
  auto sig_b64     = token.substr(dot2 + 1);
  auto signing_input = token.substr(0, dot2);
  auto sig_raw     = base64url_decode(sig_b64);

  // Decode header to determine algorithm
  std::string alg = "HS256";
  try {
    auto header_json = base64url_decode(header_b64);
    auto hdr = json::parse(header_json);
    alg = hdr.value("alg", "HS256");
  } catch (...) {}

  // Verify signature based on algorithm
  bool sig_valid = false;

  if (alg == "ES256") {
    sig_valid = verify_es256(signing_input, sig_raw);
  } else if (alg == "HS256") {
    sig_valid = verify_hs256(signing_input, sig_raw);
  } else {
    // Unknown algorithm — try ES256 first (current), then HS256 (legacy)
    sig_valid = verify_es256(signing_input, sig_raw) ||
                verify_hs256(signing_input, sig_raw);
  }

  if (!sig_valid) {
    std::cerr << "[jwt] signature verification failed (alg=" << alg << ")" << std::endl;
    return std::nullopt;
  }

  return decode_claims(payload_b64);
}

bool JwtVerifier::verify_es256(std::string_view signing_input, std::string_view signature) const {
  if (!ec_pubkey_) return false;
  if (signature.size() != 64) return false; // ES256 = 2×32 bytes (r + s)

  // JWT ES256 signature is r||s (each 32 bytes) — convert to DER for OpenSSL
  BIGNUM* r = BN_bin2bn(reinterpret_cast<const unsigned char*>(signature.data()), 32, nullptr);
  BIGNUM* s = BN_bin2bn(reinterpret_cast<const unsigned char*>(signature.data() + 32), 32, nullptr);
  if (!r || !s) {
    BN_free(r);
    BN_free(s);
    return false;
  }

  ECDSA_SIG* ecdsa_sig = ECDSA_SIG_new();
  ECDSA_SIG_set0(ecdsa_sig, r, s); // Takes ownership of r and s

  // Encode to DER
  int der_len = i2d_ECDSA_SIG(ecdsa_sig, nullptr);
  if (der_len <= 0) {
    ECDSA_SIG_free(ecdsa_sig);
    return false;
  }
  std::vector<unsigned char> der(der_len);
  unsigned char* der_ptr = der.data();
  i2d_ECDSA_SIG(ecdsa_sig, &der_ptr);
  ECDSA_SIG_free(ecdsa_sig);

  // Verify using EVP_DigestVerify
  EVP_MD_CTX* md_ctx = EVP_MD_CTX_new();
  bool valid = false;

  if (EVP_DigestVerifyInit(md_ctx, nullptr, EVP_sha256(), nullptr, ec_pubkey_) == 1) {
    int rc = EVP_DigestVerify(md_ctx,
      der.data(), der.size(),
      reinterpret_cast<const unsigned char*>(signing_input.data()),
      signing_input.size());
    valid = (rc == 1);
  }

  EVP_MD_CTX_free(md_ctx);
  return valid;
}

bool JwtVerifier::verify_hs256(std::string_view signing_input, std::string_view signature) const {
  if (legacy_secret_.empty()) return false;

  unsigned char result[EVP_MAX_MD_SIZE];
  unsigned int result_len = 0;

  HMAC(EVP_sha256(),
       legacy_secret_.data(), static_cast<int>(legacy_secret_.size()),
       reinterpret_cast<const unsigned char*>(signing_input.data()),
       signing_input.size(),
       result, &result_len);

  if (result_len != signature.size()) return false;
  return CRYPTO_memcmp(result, signature.data(), result_len) == 0;
}

std::optional<JwtVerifier::Claims> JwtVerifier::decode_claims(std::string_view payload_b64) {
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

  auto* bio  = BIO_new_mem_buf(b64.data(), static_cast<int>(b64.size()));
  auto* b64f = BIO_new(BIO_f_base64());
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
